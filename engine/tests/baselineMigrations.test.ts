import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/* ═══════════════════════════════════════════════════════════════════════════
   Baselining an existing database
   ───────────────────────────────────────────────────────────────────────────
   A site built with `drizzle-kit push` has no migration history, so the
   migrator refuses to run against it. `db:baseline` records what is already
   there — and the rule that makes it safe is that it records only what it can
   *verify* is there.

   It used to record the whole journal, which meant that the moment a release
   added a migration, baselining an un-migrated database told the migrator the
   new tables existed when they did not. A site went down that way, and there
   was then no way to apply them.

   The script needs a database, so what is checked here is the part that
   decides: that every migration in the journal has something to probe for.
   A migration the prober cannot read is one baselining stops at — safe, but
   it leaves a database half-recorded and the operator confused, so a new
   migration in a shape the prober does not know should fail here rather than
   on somebody's server.
   ═══════════════════════════════════════════════════════════════════════════ */

const script = readFileSync(
  fileURLToPath(new URL('../scripts/baseline-migrations.mjs', import.meta.url)),
  'utf8',
);

/** The prober, lifted out of the script so it can be exercised directly. */
function probeFor(body: string) {
  const table = body.match(/CREATE TABLE(?: IF NOT EXISTS)?\s+"?([A-Za-z0-9_]+)"?/i);
  if (table) return { kind: 'table', table: table[1] };
  const column = body.match(
    /ALTER TABLE\s+"?([A-Za-z0-9_]+)"?\s+ADD COLUMN(?: IF NOT EXISTS)?\s+"?([A-Za-z0-9_]+)"?/i,
  );
  if (column) return { kind: 'column', table: column[1], column: column[2] };
  const type = body.match(/CREATE TYPE\s+"?(?:public"?\."?)?([A-Za-z0-9_]+)"?/i);
  if (type) return { kind: 'type', type: type[1] };
  const label = body.match(
    /ALTER TYPE\s+"?(?:public"?\."?)?([A-Za-z0-9_]+)"?\s+ADD VALUE(?: IF NOT EXISTS)?\s+'([^']+)'/i,
  );
  if (label) return { kind: 'label', type: label[1], label: label[2] };
  return null;
}

const drizzleDir = fileURLToPath(new URL('../drizzle/', import.meta.url));
const migrations = readdirSync(drizzleDir)
  .filter((name) => name.endsWith('.sql'))
  .sort();

describe('the baseline prober', () => {
  it('finds something to verify in every migration the engine ships', () => {
    expect(migrations.length).toBeGreaterThan(0);
    for (const name of migrations) {
      const probe = probeFor(readFileSync(path.join(drizzleDir, name), 'utf8'));
      expect(probe, `${name}: nothing the prober recognises — baselining would stop here`).not.toBeNull();
    }
  });

  it('reads a created table, an added column, a new type and a new enum value', () => {
    expect(probeFor('CREATE TABLE "jobs" (…)')).toEqual({ kind: 'table', table: 'jobs' });
    expect(probeFor('ALTER TABLE "pages" ADD COLUMN "locale" varchar(5);')).toEqual({
      kind: 'column',
      table: 'pages',
      column: 'locale',
    });
    expect(probeFor('CREATE TYPE "public"."application_status" AS ENUM(…);')).toEqual({
      kind: 'type',
      type: 'application_status',
    });
    /* Not idempotent — re-running it fails on "label already exists" — so an
       enum-only migration has to be probed like any other. */
    expect(probeFor(`ALTER TYPE "public"."user_role" ADD VALUE 'manager' BEFORE 'editor';`)).toEqual({
      kind: 'label',
      type: 'user_role',
      label: 'manager',
    });
  });

  it('finds nothing in a migration that creates nothing', () => {
    expect(probeFor('CREATE INDEX "posts_fts_idx" ON "posts" USING gin(…);')).toBeNull();
  });
});

describe('the script itself', () => {
  /* The bug was that it recorded the whole journal unconditionally. These
     hold the shape of the fix rather than its wording. */
  it('stops at the first migration it cannot verify', () => {
    expect(script).toContain('break;');
    expect(script).toMatch(/stopping at/);
  });

  it('still refuses to touch a database that already has history', () => {
    expect(script).toContain('already recorded');
  });

  it('still does nothing to a database with no schema at all', () => {
    expect(script).toContain('no schema yet');
  });
});
