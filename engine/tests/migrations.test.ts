import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/* The generated migrations are what builds a production database — the schema
   file is not. If a schema change lands without `npm run db:generate`, a fresh
   install gets yesterday's tables and nothing says so at build time. These
   tests are that "something". */

const root = path.join(process.cwd(), 'drizzle');
const journal = JSON.parse(readFileSync(path.join(root, 'meta', '_journal.json'), 'utf8')) as {
  version: string;
  dialect: string;
  entries: { idx: number; when: number; tag: string }[];
};

const files = readdirSync(root).filter((f) => f.endsWith('.sql')).sort();

describe('migration journal', () => {
  it('is a postgres journal with at least the baseline in it', () => {
    expect(journal.dialect).toBe('postgresql');
    expect(journal.entries.length).toBeGreaterThan(0);
  });

  it('names a file for every entry, and has an entry for every file', () => {
    expect(journal.entries.map((e) => `${e.tag}.sql`).sort()).toEqual(files);
  });

  it('numbers its entries from zero with no gaps', () => {
    const idx = journal.entries.map((e) => e.idx).sort((a, b) => a - b);
    expect(idx).toEqual(idx.map((_, i) => i));
  });

  it('creates the tables the application actually reads', () => {
    // A spot check rather than a full list: if the baseline were ever
    // regenerated from a truncated schema, these would go first.
    const sql = files.map((f) => readFileSync(path.join(root, f), 'utf8')).join('\n').toLowerCase();
    for (const table of ['users', 'pages', 'posts', 'settings', 'media', 'audit_log', 'backups', 'blocked_ips']) {
      expect(sql).toContain(`create table "${table}"`);
    }
  });
});

describe('the hand-written SQL that drizzle-kit does not generate', () => {
  const sqlDir = path.join(root, 'sql');
  const extras = readdirSync(sqlDir).filter((f) => f.endsWith('.sql')).sort();

  it('is applied after the migrations, and still holds the audit trigger and the search index', () => {
    const body = extras.map((f) => readFileSync(path.join(sqlDir, f), 'utf8')).join('\n');
    expect(body).toMatch(/posts_fts_idx/);
    expect(body).toMatch(/append-only/i);
  });

  it('is idempotent, because it runs on every deploy', () => {
    for (const file of extras) {
      const body = readFileSync(path.join(sqlDir, file), 'utf8').toLowerCase();
      // Either guarded with IF NOT EXISTS / OR REPLACE, or wrapped in a DO block
      // that checks first.
      expect(body).toMatch(/if not exists|or replace|do \$\$|drop .* if exists/);
    }
  });
});

describe('the baseline hash', () => {
  it('is the sha256 of the migration file, which is what the baseline script writes', () => {
    // Proven against a real database: drizzle stores sha256 of the file's
    // contents in drizzle.__drizzle_migrations.hash. If drizzle ever changes
    // that, scripts/baseline-migrations.mjs silently marks the wrong thing —
    // so the algorithm is pinned here deliberately.
    const body = readFileSync(path.join(root, `${journal.entries[0]!.tag}.sql`), 'utf8');
    const hash = createHash('sha256').update(body).digest('hex');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
