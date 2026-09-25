import 'server-only';
import { randomUUID } from 'node:crypto';
import { getTableColumns } from 'drizzle-orm';
import { getTableConfig, type PgTable } from 'drizzle-orm/pg-core';
import type { z } from 'zod';
import { type AnyBlock, collectInvalidBlocks, parseBlocks } from '@/lib/blocks';
import type { CheckReport, ImportStrategy, TableReport } from '@/lib/importReport';
import { savedBlockCycle } from '@/lib/blockTree';
import { cookieNoticeSchema } from '@/lib/cookies';
import { safeCss } from '@/lib/customCode';
import { integrationsSchema } from '@/lib/integrations';
import { navigationSchema } from '@/lib/navigation';
import { pageAppearanceSchema } from '@/lib/pageAppearance';
import { permalinksSchema } from '@/lib/permalinks';
import { popupsSchema } from '@/lib/popups';
import { projectOptionsSchema, projectTemplateSchema } from '@/lib/projects';
import { normalisePath } from '@/lib/redirectRules';
import { siteSettingsSchema } from '@/lib/siteSettings';
import { themeSchema } from '@/lib/theme';
import { readingMinutes } from '@/lib/utils';
import { seoSchema } from '@/server/api/schemas';
import { checkRow } from '@/server/content/redirectPlan';
import { sanitizeRichText } from '@/server/content/sanitize';

/* ═══════════════════════════════════════════════════════════════════════════
   Checking an archive's rows before any of them is written (T36, 2.20)
   ───────────────────────────────────────────────────────────────────────────
   An archive used to be inserted raw. That was safe only for archives this
   engine wrote; one from a migration script could put a block no page can
   render, unsanitised HTML, or a reference to nothing straight into the
   tables. So every row now passes, in order:

     1. its table's own columns — types, lengths, enums, required fields,
        with the column defaults filling what is missing;
     2. the rules the admin API applies to that kind of content — blocks
        checked and filled, rich text sanitised, reading time recounted,
        slugs and paths in their written form, redirects held to the same
        checks as a typed one, settings to their own schemas;
     3. for a merge, a match against what is here — by id, else by the
        address that is unique per language — so a re-imported row updates
        its twin instead of colliding with it;
     4. every reference, against what will exist afterwards; a missing
        optional one is cleared, a missing required one refuses the row, and
        a refused parent refuses its children.

   Pure apart from the `existing` snapshot handed in, so it is the dry run
   the screen shows and the plan the import then applies — one function,
   both answers.
   ═══════════════════════════════════════════════════════════════════════════ */

export type { CheckReport, ImportStrategy, Rejection, TableReport } from '@/lib/importReport';
export type Action = 'create' | 'update' | 'skip';

export type PreparedRow = {
  /** Position in the archive's table document, from 1, for the report. */
  row: number;
  key: string;
  action: Action;
  values: Record<string, unknown>;
  /** Why a row was changed on the way in (a cleared reference), for the report. */
  notes: string[];
};

export type CheckResult = { report: CheckReport; prepared: Record<string, PreparedRow[]>; urlMap: Record<string, string>; skippedMedia: string[] };

/** What is here already, for a merge — and for references into tables the archive does not carry. */
export type ExistingSnapshot = Record<string, Record<string, unknown>[]>;

type Column = {
  name: string;
  notNull: boolean;
  hasDefault: boolean;
  primary: boolean;
  columnType: string;
  enumValues?: string[];
  length?: number;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SITE_PATH = /^\/[A-Za-z0-9._~\-/%]*$/;
const MEDIA_FILE = /^(?!\/)(?!.*\.\.)[A-Za-z0-9._\-/]{1,300}$/;

/* ── 1. Columns ───────────────────────────────────────────────────────────── */

export function tableColumns(table: PgTable): Record<string, Column> {
  return getTableColumns(table) as unknown as Record<string, Column>;
}

/**
 * One row against its table's columns. Unknown keys are dropped (and named
 * in the report, once per table); a missing value with a default is left to
 * the default; a missing primary key is generated here, so references to the
 * row can be followed before it exists.
 */
export function normaliseRow(
  table: PgTable,
  raw: unknown,
): { ok: true; values: Record<string, unknown>; ignored: string[] } | { ok: false; reason: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, reason: 'Not an object.' };
  const input = raw as Record<string, unknown>;
  const columns = tableColumns(table);
  const values: Record<string, unknown> = {};

  for (const [key, column] of Object.entries(columns)) {
    let value = input[key];
    if (value === undefined || (value === null && column.notNull)) {
      if (column.primary && column.columnType === 'PgUUID') {
        values[key] = randomUUID();
        continue;
      }
      if (column.hasDefault) continue;
      if (value === null || column.notNull) return { ok: false, reason: `${key} is required.` };
      continue;
    }
    if (value === null) {
      values[key] = null;
      continue;
    }
    const problem = checkType(column, value);
    if (typeof problem === 'string') return { ok: false, reason: `${key}: ${problem}` };
    value = problem.value;
    values[key] = value;
  }

  const ignored = Object.keys(input).filter((key) => !(key in columns));
  return { ok: true, values, ignored };
}

function checkType(column: Column, value: unknown): string | { value: unknown } {
  switch (column.columnType) {
    case 'PgUUID':
      return typeof value === 'string' && UUID.test(value) ? { value: value.toLowerCase() } : 'not an id (a uuid).';
    case 'PgVarchar':
    case 'PgText':
    case 'PgChar':
      if (typeof value !== 'string') return 'not text.';
      if (column.length && value.length > column.length) return `longer than ${column.length} characters.`;
      return { value };
    case 'PgInteger':
    case 'PgSmallInt':
    case 'PgBigInt53':
    case 'PgSerial':
      return typeof value === 'number' && Number.isInteger(value) ? { value } : 'not a whole number.';
    case 'PgReal':
    case 'PgDoublePrecision':
      return typeof value === 'number' && Number.isFinite(value) ? { value } : 'not a number.';
    case 'PgBoolean':
      return typeof value === 'boolean' ? { value } : 'not true or false.';
    case 'PgTimestamp':
    case 'PgTimestampString':
    case 'PgDate':
    case 'PgDateString': {
      const date = value instanceof Date ? value : typeof value === 'string' ? new Date(value) : null;
      return date && !Number.isNaN(date.getTime()) ? { value: date } : 'not a date.';
    }
    case 'PgEnumColumn':
      return typeof value === 'string' && (column.enumValues ?? []).includes(value) ? { value } : `must be one of ${(column.enumValues ?? []).join(', ')}.`;
    default:
      // jsonb and anything exotic: any JSON value.
      return { value };
  }
}

/* ── 2. The admin API's rules, per kind of content ────────────────────────── */

type Rule = (values: Record<string, unknown>) => string | null;

function blocksRule(column: string): Rule {
  return (values) => {
    if (values[column] === undefined) return null;
    if (!Array.isArray(values[column])) return `${column} is not a list of blocks.`;
    const problems = collectInvalidBlocks(values[column] as AnyBlock[]);
    if (problems.length > 0) return `${problems[0]}${problems.length > 1 ? ` (and ${problems.length - 1} more)` : ''}.`;
    values[column] = parseBlocks(values[column] as AnyBlock[]);
    return null;
  };
}

function schemaRule(column: string, schema: z.ZodType, label = column): Rule {
  return (values) => {
    if (values[column] === undefined) return null;
    const parsed = schema.safeParse(values[column]);
    if (!parsed.success) return `${label} is not valid (${parsed.error.issues[0]?.path.join('.') || 'value'}: ${parsed.error.issues[0]?.message}).`;
    values[column] = parsed.data;
    return null;
  };
}

const slugRule: Rule = (values) =>
  typeof values.slug === 'string' && !SLUG.test(values.slug) ? `the slug “${values.slug}” is not in its written form (lower case, digits and hyphens).` : null;

function richText(...columns: string[]): Rule {
  return (values) => {
    for (const column of columns) if (typeof values[column] === 'string') values[column] = sanitizeRichText(values[column] as string);
    return null;
  };
}

const cssRule: Rule = (values) => {
  if (typeof values.customCss === 'string') values.customCss = safeCss(values.customCss);
  return null;
};

export const TABLE_RULES: Record<string, Rule[]> = {
  media: [
    (values) => {
      const filename = values.filename;
      if (typeof filename !== 'string' || !MEDIA_FILE.test(filename)) return 'its file name is not a safe relative path.';
      if (values.url !== undefined && values.url !== `/media/${filename}`) return `its url must be /media/${filename}.`;
      values.url = `/media/${filename}`;
      if (values.checksum != null && !/^[0-9a-f]{64}$/.test(String(values.checksum))) return 'its checksum is not a sha256.';
      return null;
    },
  ],
  categories: [slugRule],
  pages: [
    slugRule,
    (values) => {
      if (typeof values.path !== 'string') return null;
      const path = normalisePath(values.path);
      if (path !== values.path || !SITE_PATH.test(path)) return `the path “${values.path}” is not in its written form (${path}).`;
      return null;
    },
    blocksRule('blocks'),
    schemaRule('seo', seoSchema, 'The SEO fields'),
    schemaRule('appearance', pageAppearanceSchema, 'The colours'),
    cssRule,
  ],
  posts: [
    slugRule,
    blocksRule('blocks'),
    schemaRule('seo', seoSchema, 'The SEO fields'),
    schemaRule('appearance', pageAppearanceSchema, 'The colours'),
    cssRule,
    (values) => {
      // Sanitised as the editor's save would, and the reading time counted from what is kept.
      if (typeof values.body === 'string') {
        values.body = sanitizeRichText(values.body);
        values.readingMinutes = readingMinutes(values.body as string);
      }
      return null;
    },
  ],
  projects: [slugRule, blocksRule('blocks'), schemaRule('seo', seoSchema, 'The SEO fields'), schemaRule('options', projectOptionsSchema, 'The options'), cssRule, richText('intro')],
  project_terms: [slugRule],
  saved_blocks: [
    blocksRule('tree'),
    (values) => (values.mode !== undefined && values.mode !== 'synced' && values.mode !== 'template' ? 'its mode must be synced or template.' : null),
  ],
  jobs: [slugRule, schemaRule('seo', seoSchema, 'The SEO fields'), richText('description', 'responsibilities', 'benefits')],
};

/** A redirect is held to the checks a typed one meets; its fields come back in their stored form. */
export function redirectRule(allowRegex: boolean): Rule {
  return (values) => {
    const matchType = (values.matchType as 'exact' | 'prefix' | 'regex' | undefined) ?? 'exact';
    const query = typeof values.matchQuery === 'string' && values.matchQuery ? `?${values.matchQuery}` : '';
    const status = values.status === 302 ? 302 : 301;
    const checked = checkRow(
      { from: `${String(values.fromPath ?? '')}${query}`, to: String(values.toPath ?? ''), status, matchType, keepRest: values.keepRest === true },
      { allowRegex },
    );
    if ('reason' in checked) return checked.reason;
    Object.assign(values, { fromPath: checked.rule.fromPath, matchQuery: checked.rule.matchQuery, toPath: checked.rule.toPath, keepRest: checked.rule.keepRest, matchType: checked.rule.matchType, status });
    return null;
  };
}

/* ── Settings ─────────────────────────────────────────────────────────────── */

const SETTING_SCHEMAS: Record<string, z.ZodType> = {
  theme: themeSchema,
  navigation: navigationSchema,
  popups: popupsSchema,
  permalinks: permalinksSchema,
  projects: projectTemplateSchema,
  cookies: cookieNoticeSchema,
  integrations: integrationsSchema,
};

/**
 * One portable setting against the schema its own screen saves with. Blocks
 * inside a popup or the project template are checked too — the settings
 * screens refuse a block that would vanish, and so does this.
 */
export function checkSetting(key: string, value: unknown): { ok: true; value: unknown } | { ok: false; reason: string } {
  const base = key.split(':')[0]!;
  if (base.startsWith('site.')) {
    const field = base.slice('site.'.length) as keyof typeof siteSettingsSchema.shape;
    const schema = siteSettingsSchema.shape[field];
    if (!schema) return { ok: false, reason: `${key} is not a setting this engine knows.` };
    const parsed = schema.safeParse(value);
    return parsed.success ? { ok: true, value: parsed.data } : { ok: false, reason: `${key}: ${parsed.error.issues[0]?.message ?? 'not valid'}.` };
  }
  const schema = SETTING_SCHEMAS[base];
  if (!schema) return { ok: false, reason: `${key} is not a setting that travels.` };
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, reason: `${key} is not valid (${issue?.path.join('.') || 'value'}: ${issue?.message}).` };
  }
  let data = parsed.data as Record<string, unknown> | unknown[];
  const blockLists: AnyBlock[][] =
    base === 'popups' && Array.isArray(data)
      ? (data as { blocks?: AnyBlock[] }[]).map((popup) => popup.blocks ?? [])
      : base === 'projects' && data && typeof data === 'object'
        ? [((data as { cta?: AnyBlock[] }).cta ?? []) as AnyBlock[]]
        : [];
  for (const blocks of blockLists) {
    const problems = collectInvalidBlocks(blocks);
    if (problems.length > 0) return { ok: false, reason: `${key}: ${problems[0]}.` };
  }
  if (base === 'popups' && Array.isArray(data)) data = (data as { blocks?: AnyBlock[] }[]).map((popup) => ({ ...popup, blocks: parseBlocks(popup.blocks ?? []) }));
  if (base === 'projects' && data && !Array.isArray(data)) data = { ...data, cta: parseBlocks(((data as { cta?: AnyBlock[] }).cta ?? []) as AnyBlock[]) };
  return { ok: true, value: data };
}

/* ── 3. Matching, for a merge ─────────────────────────────────────────────── */

/**
 * Each table's second key — what is unique per language — for a row whose id
 * is new here. Saved blocks have none: two with one name are allowed, so only
 * their id can say they are the same block. The join tables are their keys.
 */
export const NATURAL_KEYS: Record<string, string[] | null> = {
  media: ['filename'],
  categories: ['locale', 'slug'],
  pages: ['locale', 'path'],
  posts: ['locale', 'slug'],
  post_categories: ['postId', 'categoryId'],
  projects: ['locale', 'slug'],
  project_terms: ['locale', 'taxonomy', 'slug'],
  project_term_links: ['projectId', 'termId'],
  saved_blocks: null,
  jobs: ['locale', 'slug'],
  redirects: ['fromPath', 'matchType', 'matchQuery'],
};

/**
 * References the database does not declare but the content relies on: a
 * page's parent. Optional, so a missing one is cleared rather than refusing
 * the page.
 */
const SOFT_REFERENCES: Record<string, { column: string; target: string; nullable: boolean }[]> = {
  pages: [{ column: 'parentId', target: 'pages', nullable: true }],
};

/** Join tables: no id of their own, only the pair. */
const JOIN_TABLES = new Set(['post_categories', 'project_term_links']);

/** The defaults a natural key relies on when a row leaves them out. */
const KEY_DEFAULTS: Record<string, unknown> = { locale: 'en', matchType: 'exact', matchQuery: '' };

const naturalKey = (table: string, values: Record<string, unknown>): string | null => {
  const columns = NATURAL_KEYS[table];
  if (!columns) return null;
  return columns.map((column) => String(values[column] ?? KEY_DEFAULTS[column] ?? '')).join('|');
};

/** How a row is named in the report: its address where it has one. */
function describe(table: string, values: Record<string, unknown>, index: number): string {
  if (table === 'pages' && typeof values.path === 'string') return values.path;
  if (typeof values.slug === 'string') return values.slug;
  if (table === 'media' && typeof values.filename === 'string') return values.filename;
  if (table === 'redirects' && typeof values.fromPath === 'string') return values.fromPath;
  if (typeof values.name === 'string') return values.name;
  if (typeof values.key === 'string') return values.key;
  return `row ${index}`;
}

/**
 * Columns that follow from others, filled in when an archive leaves them
 * out — a media row's address is its file name under /media/.
 */
function derive(table: string, raw: unknown): unknown {
  if (table === 'media' && raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const row = raw as Record<string, unknown>;
    if (row.url === undefined && typeof row.filename === 'string') return { ...row, url: `/media/${row.filename}` };
  }
  return raw;
}

/* ── 4. The whole archive ─────────────────────────────────────────────────── */

export type CheckInput = {
  strategy: ImportStrategy;
  /** Content tables in insert order, parents first, with their table objects. */
  tables: { name: string; table: PgTable }[];
  documents: Record<string, unknown[]>;
  existing: ExistingSnapshot;
  /** Whether a media row's file is available — in the archive or already here. */
  hasFile: (filename: string) => boolean;
  /** Pattern redirects are an administrator's to write, here as on the Redirects screen. */
  allowRegex: boolean;
  /**
   * A merge row that lands on an address this site already has under another
   * id: update ours (the default), or leave ours alone and point the
   * archive's references at it. The WordPress importer asks first.
   */
  whenAddressMatches?: 'update' | 'skip';
};

export function checkArchive(input: CheckInput): CheckResult {
  const { strategy, tables, documents, existing } = input;
  const report: CheckReport = { strategy, tables: {}, rejected: [], notes: [] };
  const prepared: Record<string, PreparedRow[]> = {};
  const idMap = new Map<string, string>();
  const urlMap: Record<string, string> = {};
  const skippedMedia: string[] = [];
  const carried = new Set(tables.filter((t) => documents[t.name]).map((t) => t.name));

  const reject = (table: string, row: number, key: string, reason: string) => report.rejected.push({ table, row, key, reason });

  // Passes 1–3, table by table in insert order.
  for (const { name, table } of tables) {
    const rows = documents[name];
    if (!rows) continue;
    const tableReport: TableReport = { total: rows.length, create: 0, update: 0, skip: 0, failed: 0, ignoredColumns: [] };
    report.tables[name] = tableReport;
    const ignored = new Set<string>();
    const rules = [...(TABLE_RULES[name] ?? []), ...(name === 'redirects' ? [redirectRule(input.allowRegex)] : [])];
    const here = existing[name] ?? [];
    const byId = new Map(here.filter((r) => typeof r.id === 'string').map((r) => [r.id as string, r]));
    const byKey = new Map(here.map((r) => [naturalKey(name, r), r]));
    const byChecksum = name === 'media' ? new Map(here.filter((r) => typeof r.checksum === 'string' && r.checksum).map((r) => [r.checksum as string, r])) : null;
    const seenKeys = new Set<string>();
    const seenIds = new Set<string>();
    const out: PreparedRow[] = [];

    rows.forEach((given, i) => {
      const index = i + 1;
      const raw = derive(name, given);
      const normal = normaliseRow(table, raw);
      if (!normal.ok) return reject(name, index, describe(name, (raw ?? {}) as Record<string, unknown>, index), normal.reason);
      normal.ignored.forEach((key) => ignored.add(key));
      const values = normal.values;
      const label = describe(name, values, index);

      for (const rule of rules) {
        const problem = rule(values);
        if (problem) return reject(name, index, label, problem);
      }

      // One row per address, and one per id, within the archive itself.
      const nk = naturalKey(name, values);
      if (nk !== null) {
        if (seenKeys.has(nk)) return reject(name, index, label, 'the same address appears earlier in this archive.');
        seenKeys.add(nk);
      }
      if (typeof values.id === 'string') {
        if (seenIds.has(values.id)) return reject(name, index, label, 'the same id appears earlier in this archive.');
        seenIds.add(values.id);
      }

      let action: Action = 'create';
      if (strategy === 'merge') {
        if (JOIN_TABLES.has(name)) {
          // Decided after references are remapped, below.
        } else {
          const sameId = typeof values.id === 'string' ? byId.get(values.id) : undefined;
          const sameKey = nk !== null ? byKey.get(nk) : undefined;
          if (sameId) {
            action = 'update';
            if (sameKey && sameKey.id !== sameId.id) return reject(name, index, label, 'its address belongs to a different row here.');
          } else if (sameKey) {
            // The same thing under another id: it becomes that row, and everything pointing at it follows.
            idMap.set(values.id as string, sameKey.id as string);
            values.id = sameKey.id;
            action = input.whenAddressMatches === 'skip' ? 'skip' : 'update';
          } else if (byChecksum && typeof values.checksum === 'string' && byChecksum.has(values.checksum)) {
            // The same file under another name: keep ours, point the archive's references at it.
            const twin = byChecksum.get(values.checksum)!;
            idMap.set(values.id as string, twin.id as string);
            urlMap[`/media/${values.filename as string}`] = twin.url as string;
            skippedMedia.push(values.filename as string);
            values.id = twin.id;
            action = 'skip';
          }
        }
      }
      // A file already here under another name needs nothing from the archive.
      if (name === 'media' && action !== 'skip' && !input.hasFile(values.filename as string)) {
        return reject(name, index, label, 'its file is neither in the archive nor on this site.');
      }
      out.push({ row: index, key: label, action, values, notes: [] });
    });

    tableReport.ignoredColumns = [...ignored].sort();
    prepared[name] = out;
  }

  // Remap: references to a row that became another, and media addresses that moved.
  const urlEntries = Object.entries(urlMap);
  if (idMap.size > 0 || urlEntries.length > 0) {
    for (const rows of Object.values(prepared)) {
      for (const entry of rows) {
        for (const [key, value] of Object.entries(entry.values)) {
          if (typeof value === 'string' && idMap.has(value) && key !== 'id') entry.values[key] = idMap.get(value);
          else if (value && typeof value === 'object' && !(value instanceof Date)) entry.values[key] = remapJson(value, idMap, urlEntries);
          else if (typeof value === 'string' && urlEntries.length && value.includes('/media/')) entry.values[key] = remapText(value, urlEntries);
        }
      }
    }
  }

  // Pass 4: references, until nothing more is refused (a refused parent refuses its children).
  const foreignKeys = new Map(
    tables.map(({ name, table }) => [
      name,
      getTableConfig(table)
        .foreignKeys.map((fk) => {
          const ref = fk.reference();
          const column = Object.entries(tableColumns(table)).find(([, c]) => c.name === ref.columns[0]!.name)?.[0];
          return { column: column!, target: getTableConfig(ref.foreignTable).name, nullable: !ref.columns[0]!.notNull };
        })
        .filter((fk) => fk.column && fk.target !== 'users')
        .concat(SOFT_REFERENCES[name] ?? []),
    ]),
  );
  const idsOf = (target: string) => {
    const ids = new Set<string>();
    for (const entry of prepared[target] ?? []) if (typeof entry.values.id === 'string') ids.add(entry.values.id);
    // What stays here: everything in a merge, and a table the archive does not replace.
    if (strategy === 'merge' || !carried.has(target)) for (const row of existing[target] ?? []) if (typeof row.id === 'string') ids.add(row.id);
    return ids;
  };
  for (let round = 0; round < 6; round++) {
    let refused = 0;
    const known = new Map<string, Set<string>>();
    const idsIn = (target: string) => known.get(target) ?? known.set(target, idsOf(target)).get(target)!;
    for (const { name } of tables) {
      const fks = foreignKeys.get(name) ?? [];
      if (!fks.length || !prepared[name]) continue;
      prepared[name] = prepared[name]!.filter((entry) => {
        for (const fk of fks) {
          const value = entry.values[fk.column];
          if (value == null || idsIn(fk.target).has(value as string)) continue;
          if (fk.nullable) {
            entry.values[fk.column] = null;
            entry.notes.push(`${fk.column} pointed at nothing here and was cleared.`);
            continue;
          }
          reject(name, entry.row, entry.key, `it belongs to a ${fk.target.replace(/_/g, ' ').replace(/s$/, '')} that is not in the archive or on this site.`);
          refused++;
          return false;
        }
        return true;
      });
    }
    if (refused === 0) break;
  }

  // Saved blocks may not contain themselves, through any chain, in the set as it will be.
  if (prepared.saved_blocks) {
    const trees = new Map<string, AnyBlock[]>();
    if (strategy === 'merge') for (const row of existing.saved_blocks ?? []) trees.set(row.id as string, (row.tree ?? []) as AnyBlock[]);
    for (const entry of prepared.saved_blocks) trees.set(entry.values.id as string, (entry.values.tree ?? []) as AnyBlock[]);
    prepared.saved_blocks = prepared.saved_blocks.filter((entry) => {
      const problem = savedBlockCycle(entry.values.id as string, (entry.values.tree ?? []) as AnyBlock[], (id) => trees.get(id));
      if (problem) reject('saved_blocks', entry.row, entry.key, problem);
      return !problem;
    });
  }

  // Join rows in a merge: a pair already here is left alone.
  if (strategy === 'merge') {
    for (const name of JOIN_TABLES) {
      const here = new Set((existing[name] ?? []).map((row) => naturalKey(name, row)));
      for (const entry of prepared[name] ?? []) entry.action = here.has(naturalKey(name, entry.values)) ? 'skip' : 'create';
    }
  }

  for (const [name, rows] of Object.entries(prepared)) {
    const t = report.tables[name]!;
    for (const entry of rows) {
      t[entry.action]++;
      for (const note of entry.notes) report.notes.push({ table: name, row: entry.row, key: entry.key, note });
    }
  }
  for (const rejection of report.rejected) report.tables[rejection.table]!.failed++;
  report.rejected.sort((a, b) => tables.findIndex((t) => t.name === a.table) - tables.findIndex((t) => t.name === b.table) || a.row - b.row);

  return { report, prepared, urlMap, skippedMedia };
}

function remapText(text: string, urls: [string, string][]): string {
  let out = text;
  for (const [from, to] of urls) out = out.split(from).join(to);
  return out;
}

/** Ids and media addresses inside JSON — a block's picture, a page's share image id. */
function remapJson(value: unknown, ids: Map<string, string>, urls: [string, string][]): unknown {
  if (typeof value === 'string') {
    if (ids.has(value)) return ids.get(value);
    return urls.length && value.includes('/media/') ? remapText(value, urls) : value;
  }
  if (Array.isArray(value)) return value.map((item) => remapJson(item, ids, urls));
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, remapJson(v, ids, urls)]));
  }
  return value;
}
