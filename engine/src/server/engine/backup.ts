import 'server-only';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { desc, eq, getTableColumns } from 'drizzle-orm';
import { z } from 'zod';
import { env } from '@/lib/env';
import { ENGINE_VERSION, isVersion } from '@/lib/version';
import { db } from '@/server/db';
import * as schema from '@/server/db/schema';
import { backups } from '@/server/db/schema';

/* ═══════════════════════════════════════════════════════════════════════════
   Backups, export and import (package 6, phase C)
   ───────────────────────────────────────────────────────────────────────────
   An archive is a `tar.gz` holding one JSON document per table and a copy of
   the media directory. No database binaries are needed — the rows are read
   through the same connection the site uses — so a backup works wherever the
   site does, including a hosted database with no `pg_dump` on the box.

   `tar` is invoked through execFile with a fixed argument list: no shell, and
   nothing from a request ever reaches the command line. File names are
   generated here, never supplied.
   ═══════════════════════════════════════════════════════════════════════════ */

const run = promisify(execFile);

/** Written and restored in this order: parents before the rows that reference them. */
export const BACKUP_TABLES = [
  'users',
  'media',
  'pages',
  'categories',
  'posts',
  'post_categories',
  // 2.14 — projects reference media and users; the links reference both ends.
  'projects',
  'project_terms',
  'project_term_links',
  // 2.15 — saved blocks reference users; their usage index references them.
  'saved_blocks',
  'saved_block_usage',
  /* Jobs reference media and users, so they come after both; applications
     reference jobs, so they come after those. */
  'jobs',
  'applications',
  'settings',
  'enquiries',
  'newsletter_subscribers',
  'form_submissions',
  'content_revisions',
  'redirects',
  'not_found_log',
  'blocked_ips',
] as const;

export type BackupTable = (typeof BACKUP_TABLES)[number];

/**
 * Deliberately outside the archive: sessions, reset tokens, rate limits, the
 * audit log, and the backup list itself. The first three are short-lived
 * secrets that should not be restorable; the audit log is append-only by
 * design, so restoring one over another site's would be rewriting history;
 * and the backup list has to survive a restore, or the safety copy taken
 * moments earlier would be erased by the very archive it protects against.
 */
export const EXCLUDED_TABLES = ['refresh_tokens', 'password_reset_tokens', 'rate_limits', 'audit_log', 'backups'] as const;

/** The drizzle table object for a name, so the writer stays declarative. */
const TABLE_OBJECTS: Record<BackupTable, unknown> = {
  users: schema.users,
  media: schema.media,
  pages: schema.pages,
  categories: schema.categories,
  posts: schema.posts,
  post_categories: schema.postCategories,
  projects: schema.projects,
  project_terms: schema.projectTerms,
  project_term_links: schema.projectTermLinks,
  saved_blocks: schema.savedBlocks,
  saved_block_usage: schema.savedBlockUsage,
  jobs: schema.jobs,
  applications: schema.applications,
  settings: schema.settings,
  enquiries: schema.enquiries,
  newsletter_subscribers: schema.newsletterSubscribers,
  form_submissions: schema.formSubmissions,
  content_revisions: schema.contentRevisions,
  redirects: schema.redirects,
  not_found_log: schema.notFoundLog,
  blocked_ips: schema.blockedIps,
};

export const manifestSchema = z.object({
  /** Bumped when the archive layout changes; a restore refuses what it cannot read. */
  format: z.literal(1),
  engineVersion: z.string(),
  takenAt: z.string(),
  includesMedia: z.boolean(),
  tables: z.record(z.string(), z.number().int().nonnegative()),
  /** sha256 of each table document, so a tampered archive fails before it is applied. */
  digests: z.record(z.string(), z.string()),
});

export type Manifest = z.output<typeof manifestSchema>;

const digest = (text: string) => createHash('sha256').update(text).digest('hex');

export function backupDir(): string {
  return path.resolve(process.cwd(), env.BACKUP_DIR);
}

/** Generated here; a caller never names a file. */
function newArchiveName(): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `engine-${ENGINE_VERSION}-${stamp}.tar.gz`;
}

/** Only ever a name this module generated: no separators, no traversal. */
export function isSafeArchiveName(name: string): boolean {
  return /^engine-[0-9A-Za-z.\-]+\.tar\.gz$/.test(name) && !name.includes('/') && !name.includes('..');
}

export function archivePath(filename: string): string | null {
  if (!isSafeArchiveName(filename)) return null;
  const full = path.join(backupDir(), filename);
  return full.startsWith(backupDir() + path.sep) ? full : null;
}

/* ── Writing ──────────────────────────────────────────────────────────────── */

/**
 * Take a backup. Rows are read table by table and written as JSON; the media
 * directory is copied in whole. Returns the row describing it.
 */
export async function createBackup(options: {
  reason?: string;
  includeMedia?: boolean;
  createdById?: string | null;
}): Promise<typeof backups.$inferSelect> {
  const filename = newArchiveName();
  const includesMedia = options.includeMedia !== false;

  const [row] = await db
    .insert(backups)
    .values({
      filename,
      reason: (options.reason ?? 'manual').slice(0, 120),
      engineVersion: ENGINE_VERSION,
      includesMedia,
      status: 'running',
      createdById: options.createdById ?? null,
    })
    .returning();
  if (!row) throw new Error('The backup could not be recorded.');

  const staging = path.join(backupDir(), `.staging-${row.id}`);

  try {
    await mkdir(path.join(staging, 'tables'), { recursive: true });

    const counts: Record<string, number> = {};
    const digests: Record<string, string> = {};

    for (const table of BACKUP_TABLES) {
      const rows = await db.select().from(TABLE_OBJECTS[table] as never);
      const text = JSON.stringify(rows, null, 0);
      await writeFile(path.join(staging, 'tables', `${table}.json`), text, 'utf8');
      counts[table] = rows.length;
      digests[table] = digest(text);
    }

    const manifest: Manifest = {
      format: 1,
      engineVersion: ENGINE_VERSION,
      takenAt: new Date().toISOString(),
      includesMedia,
      tables: counts,
      digests,
    };
    await writeFile(path.join(staging, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

    // The media directory is copied rather than listed: it is files, not rows.
    const args = ['-czf', path.join(backupDir(), filename), '-C', staging, 'manifest.json', 'tables'];
    if (includesMedia) {
      const mediaRoot = path.resolve(process.cwd(), env.MEDIA_STORAGE_DIR);
      const exists = await stat(mediaRoot).then(
        () => true,
        () => false,
      );
      if (exists) args.push('-C', path.dirname(mediaRoot), path.basename(mediaRoot));
    }

    await run('tar', args, { timeout: 10 * 60_000, maxBuffer: 1024 * 1024 });

    const size = await stat(path.join(backupDir(), filename)).then((s) => s.size);
    const [done] = await db
      .update(backups)
      .set({ status: 'ready', byteSize: size, contents: counts, finishedAt: new Date() })
      .where(eq(backups.id, row.id))
      .returning();
    return done ?? row;
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'The backup failed.';
    const [failed] = await db
      .update(backups)
      .set({ status: 'failed', error: reason.slice(0, 500), finishedAt: new Date() })
      .where(eq(backups.id, row.id))
      .returning();
    return failed ?? row;
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

/* ── Reading ──────────────────────────────────────────────────────────────── */

export async function listBackups(limit = 50) {
  return db.select().from(backups).orderBy(desc(backups.createdAt)).limit(limit);
}

/** Read and validate an archive's manifest without unpacking the whole thing. */
export async function readManifest(filename: string): Promise<Manifest | null> {
  const full = archivePath(filename);
  if (!full) return null;
  const staging = path.join(backupDir(), `.peek-${digest(filename).slice(0, 12)}`);
  try {
    await mkdir(staging, { recursive: true });
    await run('tar', ['-xzf', full, '-C', staging, 'manifest.json'], { timeout: 60_000 });
    const parsed = manifestSchema.safeParse(JSON.parse(await readFile(path.join(staging, 'manifest.json'), 'utf8')));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

/** Whether this engine can restore that archive, and why not when it cannot. */
export function restoreRefusal(manifest: Manifest): string | null {
  if (manifest.format !== 1) return 'This archive was written by a different version of the backup format.';
  if (!isVersion(manifest.engineVersion)) return 'This archive does not say which engine wrote it.';
  return null;
}

export async function deleteBackup(filename: string): Promise<boolean> {
  const full = archivePath(filename);
  if (!full) return false;
  await rm(full, { force: true });
  await db.delete(backups).where(eq(backups.filename, filename));
  return true;
}

/* ── Restoring ────────────────────────────────────────────────────────────── */

export type RestoreOutcome =
  | { ok: true; replaced: Record<string, number>; backupTaken: string }
  | { ok: false; error: string };

/**
 * JSON has no date type, so every timestamp left the archive as a string and
 * has to become a `Date` again before it is inserted — the driver calls
 * `toISOString()` on whatever it is given.
 *
 * Which columns those are comes from the schema itself (`dataType === 'date'`)
 * rather than from guessing at ISO-looking strings: a text column that happens
 * to hold a date is left exactly as it was written.
 */
function reviveRows(table: unknown, rows: unknown[]): unknown[] {
  const columns = getTableColumns(table as Parameters<typeof getTableColumns>[0]);
  const dateKeys = Object.entries(columns)
    .filter(([, column]) => (column as { dataType?: string }).dataType === 'date')
    .map(([key]) => key);
  if (dateKeys.length === 0) return rows;

  return rows.map((row) => {
    if (!row || typeof row !== 'object') return row;
    const copy = { ...(row as Record<string, unknown>) };
    for (const key of dateKeys) {
      const value = copy[key];
      if (typeof value === 'string' && value !== '') {
        const date = new Date(value);
        if (!Number.isNaN(date.getTime())) copy[key] = date;
      }
    }
    return copy;
  });
}

/**
 * Put an archive back.
 *
 * Order of operations matters more here than anywhere else in the engine:
 *
 *   1. the archive is unpacked and every table document checked against its
 *      digest, so a truncated or edited archive is refused before anything is
 *      touched;
 *   2. a fresh backup of the site as it stands is taken, because the honest
 *      failure mode of a restore is "that was the wrong archive";
 *   3. the rows are replaced inside one transaction, parents first, so a
 *      failure halfway leaves the database as it was.
 *
 * Sessions are not in the archive, so everybody signed in stays signed in
 * against rows that may have changed under them — the caller signs sessions
 * out afterwards.
 */
export async function restoreBackup(filename: string, options: { createdById?: string | null } = {}): Promise<RestoreOutcome> {
  const full = archivePath(filename);
  if (!full) return { ok: false, error: 'That is not a backup this site wrote.' };

  const exists = await stat(full).then(
    () => true,
    () => false,
  );
  if (!exists) return { ok: false, error: 'That archive is no longer on disk.' };

  const staging = path.join(backupDir(), `.restore-${digest(filename).slice(0, 12)}`);

  try {
    await mkdir(staging, { recursive: true });
    await run('tar', ['-xzf', full, '-C', staging], { timeout: 10 * 60_000, maxBuffer: 1024 * 1024 });

    const manifestText = await readFile(path.join(staging, 'manifest.json'), 'utf8');
    const parsed = manifestSchema.safeParse(JSON.parse(manifestText));
    if (!parsed.success) return { ok: false, error: 'That archive has no manifest this engine can read.' };

    const refusal = restoreRefusal(parsed.data);
    if (refusal) return { ok: false, error: refusal };

    // Read and verify everything before a single row is written.
    const documents: Partial<Record<BackupTable, unknown[]>> = {};
    for (const table of BACKUP_TABLES) {
      const file = path.join(staging, 'tables', `${table}.json`);
      const text = await readFile(file, 'utf8').catch(() => null);
      if (text === null) continue;

      const expected = parsed.data.digests[table];
      if (expected && digest(text) !== expected) {
        return { ok: false, error: `The archive has been altered since it was written (${table}).` };
      }
      const rows: unknown = JSON.parse(text);
      if (!Array.isArray(rows)) return { ok: false, error: `The archive's ${table} document is not a list of rows.` };
      documents[table] = rows;
    }

    // Step 2: what is here now, before it is replaced.
    const safety = await createBackup({ reason: `before restoring ${filename}`, createdById: options.createdById ?? null });
    if (safety.status !== 'ready') {
      return { ok: false, error: 'A backup of the current site could not be taken, so nothing was restored.' };
    }

    const replaced: Record<string, number> = {};

    await db.transaction(async (tx) => {
      // Children first on the way out, parents first on the way back in.
      for (const table of [...BACKUP_TABLES].reverse()) {
        if (!documents[table]) continue;
        await tx.delete(TABLE_OBJECTS[table] as never);
      }
      for (const table of BACKUP_TABLES) {
        const rows = documents[table];
        if (!rows || rows.length === 0) {
          replaced[table] = 0;
          continue;
        }
        const revived = reviveRows(TABLE_OBJECTS[table], rows);
        // In batches: one statement per table would exceed the parameter limit.
        for (let i = 0; i < revived.length; i += 200) {
          await tx.insert(TABLE_OBJECTS[table] as never).values(revived.slice(i, i + 200) as never);
        }
        replaced[table] = revived.length;
      }
    });

    return { ok: true, replaced, backupTaken: safety.filename };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'The restore failed.';
    return { ok: false, error: reason.slice(0, 400) };
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

/** Archives on disk that no row knows about — after a restore from elsewhere, say. */
export async function orphanArchives(): Promise<string[]> {
  try {
    const [onDisk, rows] = await Promise.all([readdir(backupDir()), db.select({ filename: backups.filename }).from(backups)]);
    const known = new Set(rows.map((row) => row.filename));
    return onDisk.filter((name) => isSafeArchiveName(name) && !known.has(name));
  } catch {
    return [];
  }
}
