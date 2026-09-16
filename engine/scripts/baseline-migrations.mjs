#!/usr/bin/env node
/**
 * Mark an existing database as already at the migration baseline.
 *
 * Until now the schema was created by `drizzle-kit push`, which writes no
 * migration history. The moment generated migrations exist, `drizzle-kit
 * migrate` on one of those databases tries to apply the baseline and dies on
 * "relation already exists" — every table it wants to create is there.
 *
 * This records migrations as applied, without running them — but **only the
 * ones whose objects are already there**. That distinction is the whole
 * safety of this script, and it was missing: it used to baseline the entire
 * journal, so the moment a release added a migration, running it on an
 * un-migrated database told the migrator that the new tables existed when
 * they did not. There was then no way to apply them.
 *
 * So each migration is probed: the first table or column it creates is looked
 * up, and baselining stops at the first one that is genuinely absent. What is
 * there is recorded; what is not is left for the migrator to apply.
 *
 * It does nothing at all to:
 *
 *   • a fresh database — there is no schema to baseline, so the migrator
 *     should run normally and create it;
 *   • a database that already has migration history — it is being managed
 *     properly and must not be touched.
 *
 * Safe to run every deploy; it is a no-op after the first.
 */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import 'dotenv/config';
import postgres from 'postgres';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

/**
 * The first object a migration creates, as something we can look up.
 *
 * Deliberately the *first*: a migration applies as one transaction, so if its
 * opening statement landed the rest did too.
 */
function probeFor(body) {
  const table = body.match(/CREATE TABLE(?: IF NOT EXISTS)?\s+"?([A-Za-z0-9_]+)"?/i);
  if (table) return { kind: 'table', table: table[1] };

  const column = body.match(/ALTER TABLE\s+"?([A-Za-z0-9_]+)"?\s+ADD COLUMN(?: IF NOT EXISTS)?\s+"?([A-Za-z0-9_]+)"?/i);
  if (column) return { kind: 'column', table: column[1], column: column[2] };

  const type = body.match(/CREATE TYPE\s+"?(?:public"?\."?)?([A-Za-z0-9_]+)"?/i);
  if (type) return { kind: 'type', type: type[1] };

  /* `ALTER TYPE ... ADD VALUE` is not idempotent — re-running it fails on
     "label already exists" — so an enum-only migration has to be probed like
     any other rather than left to the migrator. */
  const label = body.match(
    /ALTER TYPE\s+"?(?:public"?\."?)?([A-Za-z0-9_]+)"?\s+ADD VALUE(?: IF NOT EXISTS)?\s+'([^']+)'/i,
  );
  if (label) return { kind: 'label', type: label[1], label: label[2] };

  return null;
}

const describe = (probe) =>
  probe.kind === 'table'
    ? `table ${probe.table}`
    : probe.kind === 'column'
      ? `${probe.table}.${probe.column}`
      : probe.kind === 'label'
        ? `${probe.type} value '${probe.label}'`
        : `type ${probe.type}`;

const root = path.join(process.cwd(), 'drizzle');
const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });

/** Does the thing a migration would have created already exist? */
async function exists(probe) {
  if (probe.kind === 'table') {
    const [row] = await sql`
      select exists (
        select 1 from information_schema.tables
        where table_schema = 'public' and table_name = ${probe.table}
      ) as exists`;
    return row.exists;
  }
  if (probe.kind === 'column') {
    const [row] = await sql`
      select exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = ${probe.table} and column_name = ${probe.column}
      ) as exists`;
    return row.exists;
  }
  if (probe.kind === 'label') {
    const [row] = await sql`
      select exists (
        select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
        where t.typname = ${probe.type} and e.enumlabel = ${probe.label}
      ) as exists`;
    return row.exists;
  }
  const [row] = await sql`
    select exists (select 1 from pg_type where typname = ${probe.type}) as exists`;
  return row.exists;
}

try {
  const journal = JSON.parse(await readFile(path.join(root, 'meta', '_journal.json'), 'utf8'));
  const entries = [...journal.entries].sort((a, b) => a.idx - b.idx);

  // Is there a schema here at all? `users` is created by the baseline, so its
  // presence means somebody has already built this database.
  const [{ exists: hasSchema }] = await sql`
    select exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = 'users'
    ) as exists`;

  if (!hasSchema) {
    console.log('  no schema yet — nothing to baseline, the migrator will create it');
    process.exit(0);
  }

  // The migrator's own bookkeeping table, created exactly as it creates it.
  await sql.unsafe(`create schema if not exists "drizzle"`);
  await sql.unsafe(`
    create table if not exists "drizzle"."__drizzle_migrations" (
      id serial primary key,
      hash text not null,
      created_at bigint
    )`);

  const [{ count }] = await sql`select count(*)::int as count from drizzle.__drizzle_migrations`;
  if (count > 0) {
    console.log(`  ${count} migration(s) already recorded — nothing to do`);
    process.exit(0);
  }

  let baselined = 0;

  for (const entry of entries) {
    const body = await readFile(path.join(root, `${entry.tag}.sql`), 'utf8');
    const probe = probeFor(body);

    /* No probe means nothing to verify — an index-only or data-only
       migration. Those are cheap and idempotent enough to leave to the
       migrator rather than claim. */
    if (!probe) {
      console.log(`  stopping at ${entry.tag} — nothing in it to verify`);
      break;
    }

    if (!(await exists(probe))) {
      console.log(`  stopping at ${entry.tag} — ${describe(probe)} is not there yet`);
      break;
    }

    const hash = createHash('sha256').update(body).digest('hex');
    await sql`insert into drizzle.__drizzle_migrations (hash, created_at) values (${hash}, ${entry.when})`;
    console.log(`  baselined  ${entry.tag}  (${describe(probe)} already exists)`);
    baselined += 1;
  }

  if (baselined === 0) {
    console.log('\nNothing was already in place — the migrator will apply everything.\n');
  } else {
    console.log(
      `\n${baselined} migration(s) recorded as already applied. ` +
        `Run \`npm run db:migrate\` to apply the rest.\n`,
    );
  }
} catch (error) {
  console.error('\nCould not baseline migrations:', error.message);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 }).catch(() => {});
}
