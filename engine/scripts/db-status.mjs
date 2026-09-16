#!/usr/bin/env node
/**
 * What state is this database actually in?
 *
 * The question you need answered when an update has gone wrong, and the one
 * that is awkward to ask by hand: `DATABASE_URL` lives in `.env` rather than
 * the shell, so `psql "$DATABASE_URL"` quietly connects to the wrong place —
 * or to nothing — and tells you something untrue about your own site.
 *
 * This reads the app's own configuration, reports the schema and the
 * migration history, and **never prints the connection string**, which has a
 * password in it and tends to end up pasted into a chat window.
 *
 *   npm run db:status
 */

import 'dotenv/config';
import postgres from 'postgres';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('\nDATABASE_URL is not set — is there a .env in this directory?\n');
  process.exit(1);
}

const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });

/** Where the connection points, with the password removed. */
function describeTarget(raw) {
  try {
    const parsed = new URL(raw);
    return `${parsed.hostname}:${parsed.port || 5432}${parsed.pathname} as ${parsed.username || '?'}`;
  } catch {
    return 'an unparseable DATABASE_URL';
  }
}

try {
  console.log(`\nDatabase: ${describeTarget(url)}\n`);

  const tables = await sql`
    select table_name from information_schema.tables
    where table_schema = 'public' order by table_name`;
  console.log(`Tables: ${tables.length}`);

  /* The three things a 2.0.0 site needs and a 1.2.0 one does not. Named
     rather than counted, because "21 tables" means nothing to anybody. */
  const present = new Set(tables.map((t) => t.table_name));
  for (const name of ['jobs', 'applications']) {
    console.log(`  ${name.padEnd(14)} ${present.has(name) ? 'yes' : 'NO'}`);
  }
  const [{ exists: localised }] = await sql`
    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'pages' and column_name = 'locale'
    ) as exists`;
  console.log(`  ${'pages.locale'.padEnd(14)} ${localised ? 'yes' : 'NO'}`);

  const [{ exists: hasJournal }] = await sql`
    select exists (
      select 1 from information_schema.tables
      where table_schema = 'drizzle' and table_name = '__drizzle_migrations'
    ) as exists`;

  console.log('');
  if (!hasJournal) {
    console.log('Migration history: none.');
    console.log('  This database was built with `drizzle-kit push`. The migrator');
    console.log('  cannot run against it until `npm run db:baseline` records what');
    console.log('  is already here.');
  } else {
    const [{ count }] = await sql`select count(*)::int as count from drizzle.__drizzle_migrations`;
    let total = 0;
    try {
      const journal = JSON.parse(
        await readFile(path.join(process.cwd(), 'drizzle', 'meta', '_journal.json'), 'utf8'),
      );
      total = journal.entries.length;
    } catch {
      /* Reported without the total rather than not at all. */
    }
    console.log(`Migration history: ${count} recorded${total ? ` of ${total} shipped` : ''}.`);
    if (total && count < total) {
      console.log('  Behind. Run `npm run db:migrate` to apply the rest.');
    } else if (total && count === total) {
      console.log('  Up to date.');
    }
  }
  console.log('');
} catch (error) {
  console.error('\nCould not read the database:', error instanceof Error ? error.message : error, '\n');
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 }).catch(() => {});
}
