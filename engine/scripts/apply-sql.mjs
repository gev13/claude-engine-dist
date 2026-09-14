#!/usr/bin/env node
/**
 * Applies the hand-written SQL in drizzle/sql/ that drizzle-kit does not
 * generate: the append-only audit triggers, updated_at triggers, and the
 * full-text index. Runs through the app's own Postgres client so it works
 * without psql installed.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import 'dotenv/config';
import postgres from 'postgres';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set. Copy .env.example to .env first.');
  process.exit(1);
}

const dir = join(process.cwd(), 'drizzle', 'sql');
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

const sql = postgres(url, { max: 1, onnotice: () => {} });

try {
  for (const file of files) {
    const body = readFileSync(join(dir, file), 'utf8');
    await sql.unsafe(body);
    console.log(`  applied  ${file}`);
  }
  console.log('\nSQL applied.\n');
} catch (error) {
  console.error('\nFailed to apply SQL:', error.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
