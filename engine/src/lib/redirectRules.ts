/* ═══════════════════════════════════════════════════════════════════════════
   Redirect rules — exact, prefix, pattern and query
   ───────────────────────────────────────────────────────────────────────────
   Pure: no database, no request. The middleware, the page routes, the import
   screen and the tests all run the same functions, so a rule that previews as
   matching is a rule that matches.

     • exact    — `/old-page`                       (what there always was)
     • prefix   — `/portfolio-tag/*` → `/projects`   (and optionally keep the
                  rest of the path: `/old/a/b` → `/new/a/b`)
     • regex    — `^/(\d{4})/(.*)$` → `/archive/$2`  (administrators only)
     • query    — any of the above plus a query to match: `/?s=*` →
                  `/blog?q=$1`. A `*` value is captured, in order, as $1…$9.

   **Content wins.** A path or prefix rule is consulted only where a route
   would otherwise 404, so a redirect can never hide a live page. Query rules
   are the exception, and necessarily: `/?s=term` *is* the home page as far
   as routing is concerned, so they are matched by the middleware before any
   route runs.
   ═══════════════════════════════════════════════════════════════════════════ */

export const MATCH_TYPES = ['exact', 'prefix', 'regex'] as const;
export type MatchType = (typeof MATCH_TYPES)[number];

export const MATCH_TYPE_LABELS: Record<MatchType, string> = {
  exact: 'This exact path',
  prefix: 'This path and everything under it',
  regex: 'A regular expression',
};

export type RedirectRule = {
  id?: string;
  fromPath: string;
  matchType: MatchType;
  /** `s=*`, `lang=en&page=*` — empty for a rule that ignores the query. */
  matchQuery: string;
  /** Prefix rules only: append what followed the prefix to the target. */
  keepRest: boolean;
  toPath: string;
  status: 301 | 302;
  isActive: boolean;
};

/** Paths a rule may never claim: the engine's own, which no redirect should shadow. */
const RESERVED_FROM = ['/admin', '/api', '/_next', '/media', '/install', '/preview'];

/** Leading slash, no trailing slash, query and hash dropped. */
export function normalisePath(input: string): string {
  const trimmed = (input ?? '').trim().split('?')[0]!.split('#')[0]!;
  if (!trimmed || trimmed === '/') return '/';
  const withSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withSlash.replace(/\/+$/, '') || '/';
}

/**
 * A redirect target may be a site-relative path or a full URL.
 *
 * The value is handed to `redirect()`, which will happily send a visitor
 * anywhere — including to a `javascript:` URL in some contexts — so the
 * grammar is an allowlist rather than a sanity check. `$1`…`$9` are allowed
 * as they stand: they are replaced with *encoded* captures, never raw text.
 */
export function isSafeTarget(value: string): boolean {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return false;

  // `//evil.com` and `/\evil.com` are protocol-relative: they look like site
  // paths and silently send the visitor to another origin. That is an open
  // redirect, so a site path must have exactly one leading slash.
  if (/^\/[/\\]/.test(trimmed)) return false;

  return /^\/[A-Za-z0-9\-._~!$&'()*+,;=:@%/?#]*$/.test(trimmed) || /^https?:\/\/[^\s<>"]+$/.test(trimmed);
}

export function isReservedFrom(path: string): boolean {
  return RESERVED_FROM.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

/* ── Reading what somebody typed ─────────────────────────────────────────── */

/**
 * Turn a typed or imported "from" into a rule's shape.
 *
 *   `/old`            → exact  /old
 *   `/old/*`          → prefix /old
 *   `/?s=*`           → exact  /      + query s=*
 *   `^/(\d+)/(.*)$`   → regex (only when the caller says it may be one)
 */
export function parseFrom(
  raw: string,
  hint?: MatchType,
): { fromPath: string; matchType: MatchType; matchQuery: string } {
  const value = (raw ?? '').trim();
  if (hint === 'regex' || (!hint && value.startsWith('^'))) {
    return { fromPath: value, matchType: 'regex', matchQuery: '' };
  }
  const [pathPart = '', ...queryParts] = value.split('?');
  const query = queryParts.join('?').replace(/#.*$/, '');
  let path = pathPart;
  let matchType: MatchType = hint === 'prefix' ? 'prefix' : 'exact';
  if (/\/\*$/.test(path) || path === '*') {
    matchType = 'prefix';
    path = path.replace(/\/?\*$/, '');
  }
  return { fromPath: normalisePath(path), matchType, matchQuery: normaliseQuery(query) };
}

/** `b=2&a=*` → `a=*&b=2`, empties dropped — one spelling per meaning, so duplicates are findable. */
export function normaliseQuery(query: string): string {
  return query
    .split('&')
    .map((pair) => pair.trim())
    .filter((pair) => pair && pair.includes('=') && /^[A-Za-z0-9_.\-[\]]+=/.test(pair))
    .sort()
    .join('&');
}

/** How a rule reads back in the list and in an export: the same notation `parseFrom` accepts. */
export function describeFrom(rule: Pick<RedirectRule, 'fromPath' | 'matchType' | 'matchQuery'>): string {
  if (rule.matchType === 'regex') return rule.fromPath;
  const path = rule.matchType === 'prefix' ? `${rule.fromPath === '/' ? '' : rule.fromPath}/*` : rule.fromPath;
  return rule.matchQuery ? `${path}?${rule.matchQuery}` : path;
}

/**
 * A target, as written: `/new/*` on a prefix rule means "keep the rest of the
 * path" — the same notation as the "from" side, so a CSV round-trips it.
 */
export function describeTo(rule: Pick<RedirectRule, 'toPath' | 'matchType' | 'keepRest'>): string {
  return rule.matchType === 'prefix' && rule.keepRest ? `${rule.toPath.replace(/\/+$/, '')}/*` : rule.toPath;
}

/** Split a written target into the target and its keep-the-rest flag. */
export function parseTo(raw: string, matchType: MatchType): { toPath: string; keepRest: boolean } {
  const value = (raw ?? '').trim();
  if (matchType === 'prefix' && /\/\*$/.test(value)) {
    return { toPath: value.replace(/\/\*$/, '') || '/', keepRest: true };
  }
  return { toPath: value, keepRest: false };
}

/* ── Regular expressions that cannot hang a server ───────────────────────── */

/**
 * Whether a pattern is safe to run against every missed path.
 *
 * JavaScript cannot time out a regular expression, so the guard has to be
 * about the pattern: no quantified group that itself contains a quantifier
 * (`(a+)+`, `(.*)*` — the shapes behind catastrophic backtracking), no
 * back-references, no lookbehind, and a length cap. Paths are also capped at
 * 400 characters before a pattern ever sees them. That rules out patterns
 * nobody needs for a redirect, which is the right trade.
 */
export function regexProblem(source: string): string | null {
  if (!source || source.length > 200) return 'A pattern of 1–200 characters';
  if (/\\[1-9]/.test(source)) return 'Back-references are not allowed';
  if (/\(\?<[=!]/.test(source)) return 'Lookbehind is not allowed';
  try {
    new RegExp(source);
  } catch {
    return 'That is not a valid regular expression';
  }

  // Walk the groups: a group that contains a quantifier must not be quantified itself.
  const stack: { quantified: boolean }[] = [];
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (char === '\\') {
      i++;
      continue;
    }
    if (char === '[') {
      // Skip a character class whole — its contents are literal.
      const end = source.indexOf(']', i + 1);
      if (end === -1) break;
      i = end;
      if (isQuantifier(source, i + 1) && stack.length) stack[stack.length - 1]!.quantified = true;
      continue;
    }
    if (char === '(') {
      stack.push({ quantified: false });
      // `(?:`, `(?=`, `(?!`, `(?<name>` — the `?` names the group, it repeats nothing.
      if (source[i + 1] === '?') {
        const named = /^\(\?<[A-Za-z_][A-Za-z0-9_]*>/.exec(source.slice(i));
        i += named ? named[0].length - 1 : 2;
      }
      continue;
    }
    if (char === ')') {
      const group = stack.pop();
      const quantifiedAfter = isQuantifier(source, i + 1);
      // `(a+)?` is fine — at most once. `(a+)+`, `(a+)*`, `(a+){2,}` are the shapes that backtrack.
      if (group?.quantified && isUnbounded(source, i + 1)) {
        return 'A repeated group may not contain its own repetition — (a+)+ can hang a server';
      }
      if ((group?.quantified || quantifiedAfter) && stack.length) stack[stack.length - 1]!.quantified = true;
      continue;
    }
    if (isQuantifier(source, i) && stack.length) stack[stack.length - 1]!.quantified = true;
  }
  return null;
}

function isUnbounded(source: string, index: number): boolean {
  const char = source[index];
  return char === '*' || char === '+' || (char === '{' && /^\{\d+,\}/.test(source.slice(index)));
}

function isQuantifier(source: string, index: number): boolean {
  const char = source[index];
  return char === '*' || char === '+' || char === '?' || (char === '{' && /^\{\d+(,\d*)?\}/.test(source.slice(index)));
}

/* ── Matching ────────────────────────────────────────────────────────────── */

const MAX_PATH = 400;

/** The query's captures in order, or null when the query does not match. */
export function matchQuery(pattern: string, params: URLSearchParams): string[] | null {
  if (!pattern) return [];
  const captures: string[] = [];
  for (const pair of pattern.split('&')) {
    const [key = '', expected = ''] = pair.split('=');
    const actual = params.get(key);
    if (actual === null) return null;
    if (expected === '*') captures.push(actual);
    else if (actual !== expected) return null;
  }
  return captures;
}

/** Put encoded captures into a target. Anything past the captures becomes nothing. */
export function substitute(target: string, captures: string[]): string {
  return target.replace(/\$([1-9])/g, (_, n: string) => {
    const value = captures[Number(n) - 1];
    return value === undefined ? '' : encodeURIComponent(value).replace(/%2F/gi, '/');
  });
}

/**
 * Where a rule sends this path and query, or null when it does not apply.
 *
 * `path` is normalised (leading slash, no trailing slash).
 */
export function applyRule(rule: RedirectRule, path: string, search: URLSearchParams = new URLSearchParams()): string | null {
  if (!rule.isActive || path.length > MAX_PATH) return null;
  const query = matchQuery(rule.matchQuery, search);
  if (query === null) return null;

  if (rule.matchType === 'exact') {
    return path === rule.fromPath ? substitute(rule.toPath.trim(), query) : null;
  }

  if (rule.matchType === 'prefix') {
    const base = rule.fromPath === '/' ? '' : rule.fromPath;
    if (path !== rule.fromPath && !path.startsWith(`${base}/`)) return null;
    const rest = path.slice(base.length).replace(/^\//, '');
    const target = substitute(rule.toPath.trim(), [rest, ...query]);
    if (!rule.keepRest || !rest) return target;
    const [targetPath = '', targetQuery] = target.split('?');
    const joined = `${targetPath.replace(/\/+$/, '')}/${rest}`;
    return targetQuery !== undefined ? `${joined}?${targetQuery}` : joined;
  }

  if (regexProblem(rule.fromPath)) return null;
  const match = new RegExp(rule.fromPath).exec(path);
  if (!match) return null;
  return substitute(rule.toPath.trim(), [...match.slice(1).map((value) => value ?? ''), ...query]);
}

/**
 * The first rule that applies, most specific first: exact paths, then
 * prefixes longest-first (so `/shop/sale/*` beats `/shop/*`), then patterns
 * in the order they were written. A rule that would send a path to itself is
 * skipped — that is a loop, not a redirect.
 */
export function pickRule<T extends RedirectRule>(
  rules: T[],
  path: string,
  search?: URLSearchParams,
): { rule: T; to: string } | null {
  const order = (rule: RedirectRule) => (rule.matchType === 'exact' ? 0 : rule.matchType === 'prefix' ? 1 : 2);
  const sorted = [...rules].sort(
    (a, b) =>
      order(a) - order(b) ||
      (a.matchType === 'prefix' ? b.fromPath.length - a.fromPath.length : 0) ||
      // A rule that also checks the query is more specific than one that does not.
      b.matchQuery.length - a.matchQuery.length,
  );
  for (const rule of sorted) {
    const to = applyRule(rule, path, search);
    if (!to || !isSafeTarget(to)) continue;
    if (!/^https?:/i.test(to) && normalisePath(to) === path && !to.includes('?')) continue;
    return { rule, to };
  }
  return null;
}

/* ── Chains and loops ────────────────────────────────────────────────────── */

/**
 * Settle a set of exact rules before they are written: A→B plus B→C becomes
 * A→C (one hop is faster, and a search engine gives up on long chains), and
 * a set that loops back on itself is refused with the loop spelled out.
 *
 * Only exact, query-free, on-site rules take part — a prefix or a pattern
 * does not name one destination path to follow.
 */
export function collapseChains<T extends RedirectRule>(rules: T[]): { rules: T[]; loops: string[] } {
  const exact = new Map<string, T>();
  for (const rule of rules) {
    if (rule.isActive && rule.matchType === 'exact' && !rule.matchQuery) exact.set(rule.fromPath, rule);
  }

  const loops = new Set<string>();
  const out = rules.map((rule) => {
    if (!exact.has(rule.fromPath) || exact.get(rule.fromPath) !== rule) return rule;
    const seen = [rule.fromPath];
    let target = rule.toPath.trim();
    for (let hop = 0; hop < 20; hop++) {
      if (/^https?:/i.test(target) || target.includes('$')) break;
      const next = exact.get(normalisePath(target));
      if (!next) break;
      if (seen.includes(next.fromPath)) {
        loops.add([...seen, next.fromPath].join(' → '));
        break;
      }
      seen.push(next.fromPath);
      target = next.toPath.trim();
    }
    if (normalisePath(target) === rule.fromPath && !/^https?:/i.test(target)) loops.add(`${rule.fromPath} → ${rule.fromPath}`);
    return target === rule.toPath.trim() ? rule : { ...rule, toPath: target };
  });

  return { rules: out, loops: [...loops] };
}

/* ── CSV ─────────────────────────────────────────────────────────────────── */

/** RFC 4180 with the usual tolerance: CRLF or LF, quoted cells, doubled quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const source = text.replace(/^﻿/, '');

  for (let i = 0; i < source.length; i++) {
    const char = source[i]!;
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') quoted = false;
      else cell += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[i + 1] === '\n') i++;
      row.push(cell);
      if (row.some((value) => value.trim() !== '')) rows.push(row);
      row = [];
      cell = '';
    } else cell += char;
  }
  row.push(cell);
  if (row.some((value) => value.trim() !== '')) rows.push(row);
  return rows;
}

export type ImportRow = {
  line: number;
  from: string;
  to: string;
  status: 301 | 302;
  note: string;
  matchType: MatchType;
};

/**
 * Read an import file: the engine's own `from,to,status,note`, or Yoast's
 * redirect export (`Origin, Target, Type, Format`), told apart by the header.
 * A file with no header is read as the engine's columns.
 */
export function readRedirectCsv(text: string): { rows: ImportRow[]; problems: { line: number; message: string }[] } {
  const table = parseCsv(text);
  const problems: { line: number; message: string }[] = [];
  if (table.length === 0) return { rows: [], problems: [{ line: 0, message: 'The file is empty.' }] };

  const head = table[0]!.map((cell) => cell.trim().toLowerCase());
  const yoast = head.includes('origin') && head.includes('target');
  const hasHeader = yoast || head.includes('from') || head.includes('to');
  const col = (names: string[], fallback: number) => {
    const index = head.findIndex((cell) => names.includes(cell));
    return hasHeader ? index : fallback;
  };
  const fromCol = col(['from', 'origin', 'source'], 0);
  const toCol = col(['to', 'target', 'destination'], 1);
  const statusCol = col(['status', 'type', 'code'], 2);
  const noteCol = col(['note', 'notes', 'comment'], 3);
  const formatCol = hasHeader ? head.indexOf('format') : -1;

  const rows: ImportRow[] = [];
  table.slice(hasHeader ? 1 : 0).forEach((cells, index) => {
    const line = index + (hasHeader ? 2 : 1);
    const get = (at: number) => (at >= 0 ? (cells[at] ?? '').trim() : '');
    const from = get(fromCol);
    const to = get(toCol);
    if (!from && !to) return;
    const code = Number(get(statusCol) || 301);
    if (code !== 301 && code !== 302 && code !== 307 && code !== 308) {
      problems.push({ line, message: `Status ${get(statusCol)} — only 301 and 302 are offered.` });
      return;
    }
    const format = get(formatCol).toLowerCase();
    rows.push({
      line,
      from: yoast && !from.startsWith('/') && format !== 'regex' ? `/${from}` : from,
      to: yoast && to && !/^(https?:|\/)/i.test(to) ? `/${to}` : to,
      status: code === 302 || code === 307 ? 302 : 301,
      note: get(noteCol).slice(0, 300),
      matchType: format === 'regex' ? 'regex' : parseFrom(from).matchType,
    });
  });
  return { rows, problems };
}
