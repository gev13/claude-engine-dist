import 'server-only';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { promisify } from 'node:util';
import { getTableColumns, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { env } from '@/lib/env';
import { ENGINE_VERSION } from '@/lib/version';
import { db, schema } from '@/server/db';
import { backupDir, createBackup } from './backup';

const run = promisify(execFile);

/* ═══════════════════════════════════════════════════════════════════════════
   Content export and import
   ───────────────────────────────────────────────────────────────────────────
   A backup is a full copy of one site, for putting that site back. This is a
   different thing: a portable archive of what a site *says*, for moving it to
   another site — staging to production, a rebuild, a copy for a colleague.

   So it carries no people. Not the accounts, and not the visitors either:
   enquiries, newsletter sign-ups and form submissions are personal data that
   belong to the site they were given to, and copying them somewhere else is
   not ours to do. Use a backup if you want those; that is what it is for.

   Two consequences follow from leaving accounts out, and both are honest
   limitations rather than bugs:

     • **Authorship cannot survive.** Eight columns point at `users`. On import
       every one is re-pointed at the administrator doing the import, because
       the ids in the archive name people who do not exist here.
     • **Revisions cannot survive.** They describe edits to content that is
       being replaced, by authors who are not here. They are cleared.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Written and inserted in this order: parents before the rows that need them. */
export const CONTENT_TABLES = [
  'media',
  'categories',
  'pages',
  'posts',
  'post_categories',
  /* Jobs are content — an open role is something a site says. Applications are
     NOT, and are deliberately absent: an applicant sent their CV to one
     company for one job, and carrying that to another site is the same
     mistake as carrying somebody's contact enquiries. */
  'jobs',
  'redirects',
] as const;

export type ContentTable = (typeof CONTENT_TABLES)[number];

const TABLE_OBJECTS: Record<ContentTable, unknown> = {
  media: schema.media,
  categories: schema.categories,
  pages: schema.pages,
  posts: schema.posts,
  post_categories: schema.postCategories,
  jobs: schema.jobs,
  redirects: schema.redirects,
};

/**
 * Columns naming a person. Every one is rewritten on import — the ids in the
 * archive belong to another site's accounts.
 */
const USER_COLUMNS: Partial<Record<ContentTable | 'settings', string[]>> = {
  media: ['uploadedById'],
  pages: ['authorId'],
  posts: ['authorId'],
  jobs: ['authorId'],
  redirects: ['createdById'],
  settings: ['updatedById'],
};

/* ── Which settings may travel ────────────────────────────────────────────── */

/**
 * The look and structure of a site travel; its identity and its secrets do not.
 *
 * `mail` is the sharp one: the SMTP password inside it is encrypted with *this*
 * site's key, so on another site it is not merely wrong, it is unreadable.
 * `security` is a policy about this site's attackers. `install.completed` would
 * tell the destination it had already been installed, and `engine.update*` is
 * one site's record of what it last checked.
 */
export const PORTABLE_SETTING_KEYS = ['theme', 'navigation', 'popups', 'permalinks'] as const;
const PORTABLE_SETTING_PREFIX = 'site.';

export const NEVER_EXPORTED_SETTING_KEYS = [
  'mail',
  'security',
  'install.completed',
  'engine.update',
  'engine.update.run',
] as const;

export function isPortableSettingKey(key: string): boolean {
  if ((NEVER_EXPORTED_SETTING_KEYS as readonly string[]).includes(key)) return false;
  if ((PORTABLE_SETTING_KEYS as readonly string[]).includes(key)) return true;
  return key.startsWith(PORTABLE_SETTING_PREFIX);
}

/* ── The archive ──────────────────────────────────────────────────────────── */

export const contentManifestSchema = z.object({
  format: z.literal(1),
  /** Distinguishes this from a backup archive, which has the same shape. */
  kind: z.literal('content'),
  engineVersion: z.string(),
  takenAt: z.string(),
  siteName: z.string().default(''),
  includesMedia: z.boolean(),
  includesSettings: z.boolean(),
  tables: z.record(z.string(), z.number().int().nonnegative()),
  digests: z.record(z.string(), z.string()),
});

export type ContentManifest = z.output<typeof contentManifestSchema>;

const digest = (text: string) => createHash('sha256').update(text).digest('hex');

/** Content archives sit beside backups but are named apart, so neither lists the other. */
export function isSafeContentName(name: string): boolean {
  return /^content-[0-9A-Za-z.\-]+\.tar\.gz$/.test(name) && !name.includes('/') && !name.includes('..');
}

export function contentArchivePath(filename: string): string | null {
  if (!isSafeContentName(filename)) return null;
  const full = path.join(backupDir(), filename);
  return full.startsWith(backupDir() + path.sep) ? full : null;
}

function newContentName(): string {
  return `content-${ENGINE_VERSION}-${new Date().toISOString().replace(/[:.]/g, '-')}.tar.gz`;
}

function mediaDir(): string {
  return path.resolve(process.cwd(), env.MEDIA_STORAGE_DIR);
}

/* ── Export ───────────────────────────────────────────────────────────────── */

export type ExportResult = { ok: true; filename: string; bytes: number; tables: Record<string, number> } | { ok: false; error: string };

export async function exportContent(options: { includeMedia?: boolean; includeSettings?: boolean } = {}): Promise<ExportResult> {
  const includeMedia = options.includeMedia ?? true;
  const includeSettings = options.includeSettings ?? true;

  const filename = newContentName();
  const staging = path.join(backupDir(), `.export-${digest(filename).slice(0, 12)}`);

  try {
    await mkdir(path.join(staging, 'tables'), { recursive: true });

    const tables: Record<string, number> = {};
    const digests: Record<string, string> = {};

    for (const table of CONTENT_TABLES) {
      const rows = await db.select().from(TABLE_OBJECTS[table] as never);
      const text = JSON.stringify(rows, null, 0);
      await writeFile(path.join(staging, 'tables', `${table}.json`), text, 'utf8');
      tables[table] = rows.length;
      digests[table] = digest(text);
    }

    if (includeSettings) {
      const all = await db.select().from(schema.settings);
      const portable = all.filter((row) => isPortableSettingKey(row.key));
      const text = JSON.stringify(portable, null, 0);
      await writeFile(path.join(staging, 'tables', 'settings.json'), text, 'utf8');
      tables.settings = portable.length;
      digests.settings = digest(text);
    }

    if (includeMedia) {
      const from = mediaDir();
      const there = await stat(from).then(
        (s) => s.isDirectory(),
        () => false,
      );
      if (there) await cp(from, path.join(staging, 'media'), { recursive: true });
    }

    let siteName = '';
    try {
      const [row] = await db.select().from(schema.settings).where(inArray(schema.settings.key, ['site.name'])).limit(1);
      // `value` is not necessarily text, and the name is only a courtesy in the
      // manifest — so take it when it is a string and shrug otherwise.
      if (typeof row?.value === 'string') siteName = row.value.slice(0, 120);
    } catch {
      /* never a requirement */
    }

    const manifest: ContentManifest = {
      format: 1,
      kind: 'content',
      engineVersion: ENGINE_VERSION,
      takenAt: new Date().toISOString(),
      siteName,
      includesMedia: includeMedia,
      includesSettings: includeSettings,
      tables,
      digests,
    };
    await writeFile(path.join(staging, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

    await run('tar', ['-czf', path.join(backupDir(), filename), '-C', staging, '.'], {
      timeout: 10 * 60_000,
      maxBuffer: 1024 * 1024,
    });

    const written = await stat(path.join(backupDir(), filename));
    return { ok: true, filename, bytes: written.size, tables };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message.slice(0, 400) : 'The export failed.' };
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

/**
 * Content archives have no table of their own — they are files, often destined
 * for another machine entirely. So the list is the directory.
 */
export async function listContentArchives(): Promise<{ filename: string; bytes: number; createdAt: string }[]> {
  try {
    const names = (await readdir(backupDir())).filter(isSafeContentName);
    const rows = await Promise.all(
      names.map(async (filename) => {
        const info = await stat(path.join(backupDir(), filename)).catch(() => null);
        return info ? { filename, bytes: info.size, createdAt: info.mtime.toISOString() } : null;
      }),
    );
    return rows
      .filter((row): row is { filename: string; bytes: number; createdAt: string } => row !== null)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

export async function deleteContentArchive(filename: string): Promise<boolean> {
  const full = contentArchivePath(filename);
  if (!full) return false;
  try {
    await rm(full, { force: true });
    return true;
  } catch {
    return false;
  }
}

/* ── Accepting an archive from elsewhere ──────────────────────────────────── */

/** 2 GiB. A content archive is mostly media, and media is why it is large. */
export const MAX_IMPORT_BYTES = 2 * 1024 * 1024 * 1024;

/**
 * Write an uploaded archive to disk without holding it in memory.
 *
 * Streamed rather than buffered: `arrayBuffer()` on a two-gigabyte upload is a
 * way to stop the site rather than a way to read a file.
 */
export async function receiveArchive(file: File): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  if (file.size > MAX_IMPORT_BYTES) return { ok: false, error: 'That archive is larger than the 2 GB limit.' };
  if (file.size <= 0) return { ok: false, error: 'That file is empty.' };

  const target = path.join(backupDir(), `.upload-${createHash('sha256').update(`${Date.now()}${file.name}`).digest('hex').slice(0, 16)}.tar.gz`);
  await mkdir(backupDir(), { recursive: true });

  try {
    await pipeline(Readable.fromWeb(file.stream() as Parameters<typeof Readable.fromWeb>[0]), createWriteStream(target));
    return { ok: true, path: target };
  } catch (error) {
    await rm(target, { force: true });
    return { ok: false, error: error instanceof Error ? error.message.slice(0, 200) : 'The upload could not be saved.' };
  }
}

/**
 * Refuse an archive that would write outside the directory it is unpacked into.
 *
 * `restoreBackup` never has to do this — it only ever reads an archive this
 * site wrote. An import does not have that luxury: the file arrived from
 * somewhere else, and a tar entry named `../../etc/anything` escapes the
 * staging directory. So the entries are listed and judged before a single one
 * is extracted.
 */
export function unsafeEntries(listing: string): string[] {
  return listing
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((name) => {
      if (path.isAbsolute(name)) return true;
      if (name.startsWith('~')) return true;
      // Any path that climbs, at any depth: `../x`, `a/../../x`.
      return name.split('/').includes('..');
    });
}

/* ── Import ───────────────────────────────────────────────────────────────── */

export type ImportOutcome =
  | { ok: true; applied: Record<string, number>; backupTaken: string; attributedTo: string }
  | { ok: false; error: string };

/** JSON has no date type; the schema says which columns must become Dates again. */
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

/** Re-point every column naming a person at the administrator doing the import. */
export function reattribute(rows: unknown[], columns: string[] | undefined, userId: string): unknown[] {
  if (!columns || columns.length === 0) return rows;
  return rows.map((row) => {
    if (!row || typeof row !== 'object') return row;
    const copy = { ...(row as Record<string, unknown>) };
    for (const column of columns) {
      if (column in copy) copy[column] = copy[column] === null ? null : userId;
    }
    return copy;
  });
}

/**
 * Read an archive's manifest without applying anything, so the screen can say
 * what is in it before somebody commits to replacing their site with it.
 */
export async function inspectArchive(archive: string): Promise<{ ok: true; manifest: ContentManifest } | { ok: false; error: string }> {
  const staging = path.join(backupDir(), `.inspect-${digest(archive).slice(0, 12)}`);
  try {
    await mkdir(staging, { recursive: true });
    const listing = await run('tar', ['-tzf', archive], { timeout: 60_000, maxBuffer: 8 * 1024 * 1024 });
    const bad = unsafeEntries(listing.stdout);
    if (bad.length > 0) return { ok: false, error: `That archive contains unsafe paths (${bad[0]}).` };

    await run('tar', ['-xzf', archive, '-C', staging, './manifest.json'], { timeout: 60_000, maxBuffer: 1024 * 1024 });
    const text = await readFile(path.join(staging, 'manifest.json'), 'utf8');
    const parsed = contentManifestSchema.safeParse(JSON.parse(text));
    if (!parsed.success) {
      return { ok: false, error: 'That is not a content export this engine can read. A full backup is restored from the Backups screen instead.' };
    }
    return { ok: true, manifest: parsed.data };
  } catch {
    return { ok: false, error: 'That file is not a readable archive.' };
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

/**
 * Replace this site's content with an archive's.
 *
 * Same order of operations as a restore, for the same reason: verify, take a
 * safety copy, then replace inside one transaction so a failure halfway leaves
 * the site as it was.
 *
 * Settings are handled differently from every other table. The archive holds
 * only the portable keys, and only those are removed before they are written
 * back — deleting the whole table would take `install.completed` and the mail
 * configuration with it, which would leave a working site looking uninstalled
 * and unable to send.
 */
export async function importContent(archive: string, options: { attributeTo: string; createdById?: string | null }): Promise<ImportOutcome> {
  const staging = path.join(backupDir(), `.import-${digest(archive).slice(0, 12)}`);

  try {
    const listing = await run('tar', ['-tzf', archive], { timeout: 60_000, maxBuffer: 8 * 1024 * 1024 });
    const bad = unsafeEntries(listing.stdout);
    if (bad.length > 0) return { ok: false, error: `That archive contains unsafe paths (${bad[0]}).` };

    await mkdir(staging, { recursive: true });
    await run('tar', ['-xzf', archive, '-C', staging], { timeout: 10 * 60_000, maxBuffer: 1024 * 1024 });

    const manifestText = await readFile(path.join(staging, 'manifest.json'), 'utf8').catch(() => null);
    if (manifestText === null) return { ok: false, error: 'That archive has no manifest.' };

    const parsed = contentManifestSchema.safeParse(JSON.parse(manifestText));
    if (!parsed.success) {
      return { ok: false, error: 'That is not a content export. A full backup is restored from the Backups screen.' };
    }

    // Read and verify everything before a single row is written.
    const documents: Record<string, unknown[]> = {};
    for (const table of [...CONTENT_TABLES, 'settings']) {
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

    const safety = await createBackup({ reason: 'before importing content', createdById: options.createdById ?? null });
    if (safety.status !== 'ready') {
      return { ok: false, error: 'A backup of the current site could not be taken, so nothing was imported.' };
    }

    const applied: Record<string, number> = {};

    await db.transaction(async (tx) => {
      // Revisions describe content that is about to stop existing, written by
      // people this site does not have.
      await tx.delete(schema.contentRevisions);

      for (const table of [...CONTENT_TABLES].reverse()) {
        if (!documents[table]) continue;
        await tx.delete(TABLE_OBJECTS[table] as never);
      }

      for (const table of CONTENT_TABLES) {
        const rows = documents[table];
        if (!rows || rows.length === 0) {
          applied[table] = 0;
          continue;
        }
        const prepared = reviveRows(TABLE_OBJECTS[table], reattribute(rows, USER_COLUMNS[table], options.attributeTo));
        for (let i = 0; i < prepared.length; i += 200) {
          await tx.insert(TABLE_OBJECTS[table] as never).values(prepared.slice(i, i + 200) as never);
        }
        applied[table] = prepared.length;
      }

      // Only the keys the archive actually carries, and only if they are ones
      // we would have exported — an edited archive cannot smuggle in `mail`.
      const settingsRows = (documents.settings ?? []).filter(
        (row): row is Record<string, unknown> =>
          Boolean(row) && typeof row === 'object' && typeof (row as { key?: unknown }).key === 'string' && isPortableSettingKey((row as { key: string }).key),
      );
      if (settingsRows.length > 0) {
        const keys = settingsRows.map((row) => row.key as string);
        await tx.delete(schema.settings).where(inArray(schema.settings.key, keys));
        const prepared = reviveRows(schema.settings, reattribute(settingsRows, USER_COLUMNS.settings, options.attributeTo));
        await tx.insert(schema.settings).values(prepared as never);
      }
      applied.settings = settingsRows.length;
    });

    // Files last, and merged rather than replaced: a file the archive does not
    // carry may still belong to this site, and the rows decide what is shown.
    const incoming = path.join(staging, 'media');
    const hasMedia = await stat(incoming).then(
      (s) => s.isDirectory(),
      () => false,
    );
    if (hasMedia) await cp(incoming, mediaDir(), { recursive: true, force: true });

    return { ok: true, applied, backupTaken: safety.filename, attributedTo: options.attributeTo };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message.slice(0, 400) : 'The import failed.' };
  } finally {
    await rm(staging, { recursive: true, force: true });
    await rm(archive, { force: true });
  }
}
