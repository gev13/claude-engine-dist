import 'server-only';
import {
  collapseChains,
  isReservedFrom,
  isSafeTarget,
  normalisePath,
  parseFrom,
  parseTo,
  regexProblem,
  type ImportRow,
  type MatchType,
  type RedirectRule,
} from '@/lib/redirectRules';
import type { Redirect } from '@/server/db/schema';

/* ═══════════════════════════════════════════════════════════════════════════
   Deciding what a set of redirect writes will do, before any of it happens
   ───────────────────────────────────────────────────────────────────────────
   One function for a single rule typed into the screen and for 150 rows of a
   CSV, so both are held to the same checks: a safe target, a path the engine
   does not own, a pattern that cannot hang the server (administrators only),
   no duplicates in the file, no loops — and chains settled into one hop,
   including chains through rules that already exist.

   The plan is also the dry run: the import screen shows it, row by row, and
   only a second call with `dryRun: false` writes it.
   ═══════════════════════════════════════════════════════════════════════════ */

export type PlannedRule = RedirectRule & { note: string; line?: number };

export type RowVerdict =
  | { line: number; from: string; to: string; action: 'create' | 'update'; rule: PlannedRule; existingId?: string }
  | { line: number; from: string; to: string; action: 'skip' | 'error'; reason: string };

export type Plan = {
  rows: RowVerdict[];
  /** Existing rules whose target moves because a chain through them was collapsed. */
  retargeted: { id: string; fromPath: string; toPath: string }[];
  counts: { create: number; update: number; skip: number; error: number };
};

type Existing = Pick<Redirect, 'id' | 'fromPath' | 'toPath' | 'matchType' | 'matchQuery' | 'keepRest' | 'status' | 'isActive'>;

const key = (rule: Pick<RedirectRule, 'fromPath' | 'matchType' | 'matchQuery'>) =>
  `${rule.matchType}|${rule.fromPath}|${rule.matchQuery}`;

/** One typed or imported row, checked on its own. */
export function checkRow(
  input: { from: string; to: string; status: 301 | 302; note?: string; matchType?: MatchType; keepRest?: boolean },
  opts: { allowRegex: boolean },
): { rule: PlannedRule } | { reason: string } {
  const shape = parseFrom(input.from, input.matchType);
  const written = parseTo(input.to, shape.matchType);
  const to = written.toPath;

  if (!input.from.trim()) return { reason: 'There is no “from” path.' };
  if (shape.matchType === 'regex') {
    if (!opts.allowRegex) return { reason: 'Only an administrator can write a pattern rule.' };
    const problem = regexProblem(shape.fromPath);
    if (problem) return { reason: problem };
  } else if (isReservedFrom(shape.fromPath)) {
    return { reason: `${shape.fromPath} belongs to the engine and cannot be redirected.` };
  }
  if (!isSafeTarget(to)) return { reason: 'The target must be a site path or a full http(s) URL.' };
  if (
    shape.matchType === 'exact' &&
    !shape.matchQuery &&
    !/^https?:/i.test(to) &&
    normalisePath(to) === shape.fromPath &&
    !to.includes('?')
  ) {
    return { reason: 'A redirect cannot point at the path it comes from.' };
  }

  return {
    rule: {
      ...shape,
      keepRest: shape.matchType === 'prefix' ? Boolean(input.keepRest) || written.keepRest : false,
      toPath: to,
      status: input.status,
      isActive: true,
      note: (input.note ?? '').slice(0, 300),
    },
  };
}

/**
 * The plan for a set of rows against what is stored.
 *
 * `onDuplicate` decides what a row whose "from" already has a rule does:
 * `update` repoints it (the import default — re-running a corrected file is
 * the common case), `skip` leaves it alone.
 */
export function planWrites(
  rows: ImportRow[],
  existing: Existing[],
  opts: { allowRegex: boolean; onDuplicate: 'update' | 'skip' },
): Plan {
  const byKey = new Map(existing.map((row) => [key({ ...row, matchType: row.matchType as MatchType }), row]));
  const seen = new Set<string>();
  const verdicts: RowVerdict[] = [];

  for (const row of rows) {
    const checked = checkRow(row, opts);
    if ('reason' in checked) {
      verdicts.push({ line: row.line, from: row.from, to: row.to, action: 'error', reason: checked.reason });
      continue;
    }
    const k = key(checked.rule);
    if (seen.has(k)) {
      verdicts.push({ line: row.line, from: row.from, to: row.to, action: 'skip', reason: 'The same “from” appears earlier in this file.' });
      continue;
    }
    seen.add(k);
    const stored = byKey.get(k);
    if (stored && opts.onDuplicate === 'skip') {
      verdicts.push({ line: row.line, from: row.from, to: row.to, action: 'skip', reason: 'A rule for this path already exists.' });
      continue;
    }
    if (stored && stored.toPath === checked.rule.toPath && stored.status === checked.rule.status) {
      verdicts.push({ line: row.line, from: row.from, to: row.to, action: 'skip', reason: 'Already exactly this.' });
      continue;
    }
    verdicts.push({
      line: row.line,
      from: row.from,
      to: row.to,
      action: stored ? 'update' : 'create',
      rule: { ...checked.rule, line: row.line },
      existingId: stored?.id,
    });
  }

  /* Chains and loops, over the rules as they will be after the write. */
  const incoming = verdicts.filter((v): v is Extract<RowVerdict, { rule: PlannedRule }> => 'rule' in v);
  const replaced = new Set(incoming.map((v) => v.existingId).filter(Boolean));
  const kept: PlannedRule[] = existing
    .filter((row) => !replaced.has(row.id))
    .map((row) => ({
      fromPath: row.fromPath,
      toPath: row.toPath,
      matchType: row.matchType as MatchType,
      matchQuery: row.matchQuery,
      keepRest: row.keepRest,
      status: row.status === 302 ? 302 : 301,
      isActive: row.isActive,
      note: '',
    }));
  const all = [...kept, ...incoming.map((v) => v.rule)];
  const { rules, loops } = collapseChains(all);

  if (loops.length > 0) {
    /* Name the rows that take part, so the person fixing the file knows
       where to look — "a loop somewhere" is not something anybody can act on. */
    for (const verdict of incoming) {
      const loop = loops.find((line) => line.split(' → ').includes(verdict.rule.fromPath));
      if (loop) {
        const index = verdicts.indexOf(verdict);
        verdicts[index] = { line: verdict.line, from: verdict.from, to: verdict.to, action: 'error', reason: `This makes a loop: ${loop}` };
      }
    }
  }

  // Settled targets for the rows still going ahead, and for stored rules a chain now runs through.
  const settled = new Map(rules.map((rule, index) => [index, rule]));
  const retargeted: Plan['retargeted'] = [];
  existing
    .filter((row) => !replaced.has(row.id))
    .forEach((row, index) => {
      const after = settled.get(index);
      if (after && after.toPath !== row.toPath && loops.length === 0) {
        retargeted.push({ id: row.id, fromPath: row.fromPath, toPath: after.toPath });
      }
    });
  incoming.forEach((verdict, index) => {
    const after = settled.get(kept.length + index);
    if (after && 'rule' in verdict) verdict.rule.toPath = after.toPath;
  });

  const counts = { create: 0, update: 0, skip: 0, error: 0 };
  for (const verdict of verdicts) counts[verdict.action]++;
  return { rows: verdicts, retargeted, counts };
}
