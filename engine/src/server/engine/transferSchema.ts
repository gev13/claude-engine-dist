import { getTableColumns } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { pageAppearanceSchema } from '@/lib/pageAppearance';
import { projectOptionsSchema } from '@/lib/projects';
import { seoSchema } from '@/server/api/schemas';
import * as schema from '@/server/db/schema';

/* ═══════════════════════════════════════════════════════════════════════════
   The content archive's format, as JSON Schema (T36, 2.20)
   ───────────────────────────────────────────────────────────────────────────
   Written from the table definitions themselves, so the schema a migration
   script is built against is the one the import checks. `npm run
   transfer:schema` writes it to docs/transfer-schema.json, and a test fails
   when the committed copy has drifted from what this produces.
   ═══════════════════════════════════════════════════════════════════════════ */

type Column = { name: string; notNull: boolean; hasDefault: boolean; primary: boolean; columnType: string; enumValues?: string[]; length?: number };

/** In insert order — parents first — as `CONTENT_TABLES` has them. */
const TABLES: [string, PgTable][] = [
  ['media', schema.media],
  ['categories', schema.categories],
  ['pages', schema.pages],
  ['posts', schema.posts],
  ['post_categories', schema.postCategories],
  ['projects', schema.projects],
  ['project_terms', schema.projectTerms],
  ['project_term_links', schema.projectTermLinks],
  ['saved_blocks', schema.savedBlocks],
  ['jobs', schema.jobs],
  ['redirects', schema.redirects],
];

/** Columns an import fills in or rewrites whatever the archive says. */
const DERIVED: Record<string, string[]> = {
  media: ['url'],
  posts: ['readingMinutes'],
};

const NOTES: Record<string, string> = {
  blocks: 'A list of blocks, each { id, type, props, style? } — checked against the block vocabulary (src/lib/blocks.ts); a block that fails refuses the row.',
  tree: 'A list of blocks, as `blocks`.',
  body: 'HTML. Sanitised on import as the editor’s save would; reading time is counted from what is kept.',
  intro: 'HTML, sanitised on import.',
  description: 'HTML where the table is `jobs` (sanitised on import); plain text elsewhere.',
  responsibilities: 'HTML, sanitised on import.',
  benefits: 'HTML, sanitised on import.',
  customCss: 'CSS; @import, url() to other sites and </style are removed.',
  slug: 'Lower case letters, digits and single hyphens.',
  path: 'A site path in its written form: a leading slash, no trailing slash, "/" for the home page.',
  filename: 'Relative to the media folder, e.g. 2026/09/abc.webp; the file itself travels under media/ in the archive.',
  url: 'Derived: /media/<filename>.',
  checksum: 'sha256 of the file, hex. A merge skips a file this site already has with the same checksum.',
  authorId: 'Ignored: re-pointed at whoever imports.',
  uploadedById: 'Ignored: re-pointed at whoever imports.',
  createdById: 'Ignored: re-pointed at whoever imports.',
  updatedById: 'Ignored: re-pointed at whoever imports.',
  readingMinutes: 'Derived from the body on import.',
};

const JSON_SHAPES: Record<string, z.ZodType> = { seo: seoSchema, appearance: pageAppearanceSchema };

function columnSchema(table: string, key: string, column: Column): Record<string, unknown> {
  let out: Record<string, unknown>;
  switch (column.columnType) {
    case 'PgUUID':
      out = { type: 'string', format: 'uuid' };
      break;
    case 'PgVarchar':
    case 'PgText':
    case 'PgChar':
      out = { type: 'string', ...(column.length ? { maxLength: column.length } : {}) };
      break;
    case 'PgInteger':
    case 'PgSmallInt':
    case 'PgBigInt53':
    case 'PgSerial':
      out = { type: 'integer' };
      break;
    case 'PgBoolean':
      out = { type: 'boolean' };
      break;
    case 'PgTimestamp':
    case 'PgDate':
      out = { type: 'string', format: 'date-time' };
      break;
    case 'PgEnumColumn':
      out = { type: 'string', enum: column.enumValues };
      break;
    default: {
      const shape = key === 'options' && table === 'projects' ? projectOptionsSchema : JSON_SHAPES[key];
      out = shape ? stripMeta(z.toJSONSchema(shape, { io: 'input', unrepresentable: 'any' })) : {};
    }
  }
  if (!column.notNull && out.type) out.type = [out.type, 'null'];
  const note = key === 'description' && table !== 'jobs' ? undefined : NOTES[key];
  return note ? { ...out, description: note } : out;
}

function stripMeta(value: Record<string, unknown>): Record<string, unknown> {
  const { $schema: _schema, ...rest } = value;
  return rest;
}

export function transferJsonSchema(): Record<string, unknown> {
  const tables: Record<string, unknown> = {};
  for (const [name, table] of TABLES) {
    const columns = getTableColumns(table) as unknown as Record<string, Column>;
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    for (const [key, column] of Object.entries(columns)) {
      properties[key] = columnSchema(name, key, column);
      if (column.notNull && !column.hasDefault && !column.primary && !(DERIVED[name] ?? []).includes(key)) required.push(key);
    }
    tables[name] = { type: 'array', items: { type: 'object', properties, required, additionalProperties: true } };
  }
  tables.settings = {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'theme, navigation, popups, permalinks, projects, cookies, integrations, or site.* (with an optional :locale).' },
        value: { description: 'Checked against the schema its own admin screen saves with.' },
      },
      required: ['key', 'value'],
    },
  };

  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: 'Engine content archive, format 1',
    description:
      'A .tar.gz holding manifest.json, tables/<table>.json (one JSON array per table) and, optionally, media/<filename>. Keys are the camelCase names below. See docs/transfer-format.md.',
    type: 'object',
    properties: {
      manifest: {
        type: 'object',
        properties: {
          format: { const: 1 },
          kind: { const: 'content' },
          engineVersion: { type: 'string' },
          takenAt: { type: 'string', format: 'date-time' },
          siteName: { type: 'string' },
          includesMedia: { type: 'boolean' },
          includesSettings: { type: 'boolean' },
          tables: { type: 'object', additionalProperties: { type: 'integer', minimum: 0 } },
          digests: { type: 'object', additionalProperties: { type: 'string', description: 'sha256 hex of tables/<name>.json, byte for byte. Optional per table.' } },
        },
        required: ['format', 'kind', 'engineVersion', 'takenAt', 'includesMedia', 'includesSettings', 'tables', 'digests'],
      },
      tables: { type: 'object', properties: tables },
    },
  };
}
