#!/usr/bin/env node
/**
 * Mark an existing database as already at the migration baseline.
 *
 * Until now the schema was created by `drizzle-kit push`, which writes no
 * migration history. The moment generated migrations exist, `drizzle-kit
 * migrate` on one of those databases tries to apply the baseline and dies on
 * "relation already exists" — every table it wants to create is there.
 *
 * This records the migrations as applied, without running them, but only when
 * the schema is genuinely already in place. It does nothing at all to:
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

const root = path.join(process.cwd(), 'drizzle');
const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });

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

  for (const entry of entries) {
    const body = await readFile(path.join(root, `${entry.tag}.sql`), 'utf8');
    const hash = createHash('sha256').update(body).digest('hex');
    await sql`insert into drizzle.__drizzle_migrations (hash, created_at) values (${hash}, ${entry.when})`;
    console.log(`  baselined  ${entry.tag}`);
  }

  console.log(`\nThis database is recorded as already at ${entries.at(-1)?.tag}.\n`);
} catch (error) {
  console.error('\nCould not baseline migrations:', error.message);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 }).catch(() => {});
}
