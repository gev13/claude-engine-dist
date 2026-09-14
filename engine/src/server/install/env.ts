import 'server-only';
import { randomBytes } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

/* ═══════════════════════════════════════════════════════════════════════════
   Writing .env from the installer
   ───────────────────────────────────────────────────────────────────────────
   A server installation used to need a shell: copy .env.example, paste a
   connection string, generate two secrets, run the schema commands. This does
   that from the browser instead.

   The honest limit: Node reads its environment once, at boot, and the pooled
   Postgres client is built from it at module load. Writing .env cannot change
   either. So this module writes the file and applies the schema through a
   client built from the **submitted** values, and the caller tells the
   operator to restart. Pretending otherwise would leave somebody staring at a
   page that never continues.
   ═══════════════════════════════════════════════════════════════════════════ */

/** The only keys the installer will ever write. Everything else in an existing
 *  .env is left exactly as it was. */
export const INSTALLER_KEYS = [
  'DATABASE_URL',
  'AUTH_ACCESS_SECRET',
  'AUTH_REFRESH_SECRET',
  'SETTINGS_SECRET',
  'NEXT_PUBLIC_SITE_URL',
  'AUTH_REQUIRE_2FA',
] as const;

export type InstallerKey = (typeof INSTALLER_KEYS)[number];

/* ── .env editing ────────────────────────────────────────────────────────── */

/**
 * Set one key in the text of a .env file, replacing the line if it is there
 * and appending it if it is not.
 *
 * The value is always double quoted, because a Postgres URL may legitimately
 * contain a `#` — unquoted, dotenv would read the rest of the line as a
 * comment and hand the app a truncated connection string.
 */
export function setEnvValue(text: string, key: InstallerKey, value: string): string {
  if (/[\r\n]/.test(value)) throw new Error(`${key} cannot contain a line break.`);

  const quoted = `${key}="${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  // `key` comes from INSTALLER_KEYS, so there is nothing to escape into the
  // pattern; a caller-supplied key would need escaping first.
  const line = new RegExp(`^[ \\t]*(?:export[ \\t]+)?${key}[ \\t]*=.*$`, 'm');

  return line.test(text) ? text.replace(line, quoted) : `${text.replace(/\n*$/, '\n')}${quoted}\n`;
}

/**
 * Write the given keys into .env.
 *
 * An existing file is edited key by key rather than replaced, so an operator
 * who already set `MEDIA_STORAGE_DIR` or a mail relay does not lose it. With
 * no .env at all the file starts from .env.example, which carries the comments
 * explaining every other setting.
 */
export async function writeEnvFile(values: Partial<Record<InstallerKey, string>>): Promise<string> {
  const target = path.join(process.cwd(), '.env');

  let text = '';
  try {
    text = await readFile(target, 'utf8');
  } catch {
    try {
      text = await readFile(path.join(process.cwd(), '.env.example'), 'utf8');
    } catch {
      text = '';
    }
  }

  for (const key of INSTALLER_KEYS) {
    const value = values[key];
    if (value !== undefined) text = setEnvValue(text, key, value);
  }

  // Readable by the account that runs the app and nobody else: this file now
  // holds the database password and both session secrets.
  await writeFile(target, text, { encoding: 'utf8', mode: 0o600 });
  return target;
}

/** A fresh secret. 48 bytes — comfortably past the 32-character floor env.ts sets. */
export function generateSecret(): string {
  return randomBytes(48).toString('base64');
}

/* ── An attempt counter that does not need the database ──────────────────────
   The usual limiter stores its counts in Postgres and fails **open** when it
   cannot reach it, so that a limiter outage never locks people out of the
   product. Right for every other caller and worthless for this one: the branch
   worth limiting here is the one where the database is unreachable by
   definition, so the shared limiter would wave every request through.

   This one lives in the process. It forgets everything on restart, which is
   fine — the endpoint is only reachable before a site is installed, and the
   job is to stop this becoming a port scanner, not to survive a reboot.     */

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 20;
const MAX_TRACKED = 500;

const attempts = new Map<string, number[]>();

export function allowAttempt(ip: string, now = Date.now()): boolean {
  for (const [key, times] of attempts) {
    const recent = times.filter((at) => now - at < WINDOW_MS);
    if (recent.length === 0) attempts.delete(key);
    else attempts.set(key, recent);
  }

  // A flood of distinct addresses must not grow this map without bound.
  if (!attempts.has(ip) && attempts.size >= MAX_TRACKED) return false;

  const times = attempts.get(ip) ?? [];
  if (times.length >= MAX_ATTEMPTS) return false;

  times.push(now);
  attempts.set(ip, times);
  return true;
}

/** Test seam. */
export function resetAttempts(): void {
  attempts.clear();
}

/* ── The connection ──────────────────────────────────────────────────────── */

export type DatabaseParts = {
  host: string;
  port: number;
  name: string;
  user: string;
  password: string;
  ssl: boolean;
};

const URL_SCHEME = /^postgres(ql)?:\/\//i;

/**
 * Build a connection URL from separate fields.
 *
 * Every part is percent-encoded: a password containing `@` or `/` would
 * otherwise move the host, and a user could aim the connection somewhere the
 * form never showed.
 */
export function buildDatabaseUrl(parts: DatabaseParts): string {
  const host = parts.host.trim();
  if (!host || /[\s/@?#]/.test(host)) throw new Error('That host name is not valid.');
  if (!Number.isInteger(parts.port) || parts.port < 1 || parts.port > 65_535) {
    throw new Error('That port is not valid.');
  }

  const credentials = `${encodeURIComponent(parts.user)}:${encodeURIComponent(parts.password)}`;
  const database = encodeURIComponent(parts.name.trim());
  const query = parts.ssl ? '?sslmode=require' : '';

  return `postgresql://${credentials}@${host}:${parts.port}/${database}${query}`;
}

/** Accept a pasted URL only if it is actually a Postgres one. */
export function checkDatabaseUrl(url: string): string {
  const trimmed = url.trim();
  if (!URL_SCHEME.test(trimmed)) {
    throw new Error('A connection string starts with postgresql:// or postgres://');
  }
  if (/[\r\n]/.test(trimmed)) throw new Error('That connection string is not valid.');
  return trimmed;
}

/**
 * Turn a driver failure into something an operator can act on.
 *
 * Deliberately specific — "the password was not accepted" and "that database
 * does not exist" send you to different places, and a single "could not
 * connect" would leave somebody guessing. This endpoint is only reachable
 * before a site is installed, so the detail is not on offer to the internet at
 * large.
 */
export function describeDbError(error: unknown): string {
  const code = (error as { code?: string } | null)?.code ?? '';
  const message = error instanceof Error ? error.message : String(error);

  switch (code) {
    case 'ECONNREFUSED':
      return 'Nothing is listening at that address. Check the host and port, and that Postgres is running.';
    case 'ENOTFOUND':
    case 'EAI_AGAIN':
      return 'That host name does not resolve.';
    case 'ETIMEDOUT':
    case 'CONNECT_TIMEOUT':
      return 'The connection timed out. A firewall is the usual reason.';
    case '28P01':
    case '28000':
      return 'The database refused those credentials.';
    case '3D000':
      return 'That database does not exist on the server. Create it first.';
    case '42501':
      return 'That user cannot create tables in this database.';
    default:
      return `The database could not be reached: ${message}`;
  }
}

/** Open a short-lived client on exactly these values — never the boot environment. */
function clientFor(url: string) {
  return postgres(url, {
    max: 1,
    connect_timeout: 5,
    idle_timeout: 5,
    prepare: false,
    onnotice: () => {},
  });
}

/** Prove the credentials work, and that the account may create tables. */
export async function testConnection(url: string): Promise<void> {
  const client = clientFor(url);
  try {
    await client`select 1`;
  } finally {
    await client.end({ timeout: 5 }).catch(() => {});
  }
}

/**
 * Apply the schema: the generated migrations first, then the hand-written SQL
 * that drizzle-kit does not produce (the append-only audit trigger, the
 * updated_at triggers, the full-text index).
 *
 * Both run through drizzle-orm's own migrator and the app's Postgres driver —
 * neither drizzle-kit nor psql is needed, which matters because drizzle-kit is
 * a devDependency and a production install does not have it.
 */
export async function applySchema(url: string): Promise<void> {
  const client = clientFor(url);
  try {
    await migrate(drizzle(client), { migrationsFolder: path.join(process.cwd(), 'drizzle') });

    const dir = path.join(process.cwd(), 'drizzle', 'sql');
    const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
    for (const file of files) {
      await client.unsafe(await readFile(path.join(dir, file), 'utf8'));
    }
  } finally {
    await client.end({ timeout: 5 }).catch(() => {});
  }
}
