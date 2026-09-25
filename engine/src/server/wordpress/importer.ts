import 'server-only';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from '@/lib/env';
import type { CheckReport } from '@/lib/importReport';
import { localeConfig } from '@/lib/locales';
import { uploadKey } from '@/lib/wordpress/content';
import { analyse, type WpAnalysis, type WpSite } from '@/lib/wordpress/model';
import { backupDir } from '@/server/engine/backup';
import { checkDocuments, importDocuments } from '@/server/engine/transfer';
import { getMediaSettings, refreshVariants } from '@/server/media/variants';
import { getPermalinks } from '@/server/routing/config';
import { convertSite, type WpMapping, wantedAttachments, wpUuid } from './convert';
import { discardWritten, downloadMedia } from './media';

/* ═══════════════════════════════════════════════════════════════════════════
   Importing from WordPress, end to end (T37, 2.20)
   ───────────────────────────────────────────────────────────────────────────
   Read once (a WXR file, or the REST API), keep what was read on this server
   for a day under a random token, and let the screen ask two questions of
   it: what would this mapping do (checked, nothing fetched, nothing
   written), and do it. Doing it fetches the files, converts, and hands the
   rows to the content import as a merge — its checks, its backup, its
   transaction.
   ═══════════════════════════════════════════════════════════════════════════ */

const TOKEN = /^[a-f0-9]{24}$/;
const DAY = 24 * 60 * 60 * 1000;

const stagedPath = (token: string) => path.join(backupDir(), `.wp-${token}.json`);

/** Keep a site that was read, for the screen's later questions. Older ones are cleared on the way. */
export async function stageSite(site: WpSite): Promise<{ token: string; analysis: WpAnalysis }> {
  await mkdir(backupDir(), { recursive: true });
  for (const name of await readdir(backupDir()).catch(() => [] as string[])) {
    if (!/^\.wp-[a-f0-9]{24}\.json$/.test(name)) continue;
    const info = await stat(path.join(backupDir(), name)).catch(() => null);
    if (info && Date.now() - info.mtimeMs > DAY) await rm(path.join(backupDir(), name), { force: true });
  }
  const token = randomBytes(12).toString('hex');
  await writeFile(stagedPath(token), JSON.stringify(site), { mode: 0o600 });
  return { token, analysis: analyse(site) };
}

export async function loadStaged(token: string): Promise<WpSite | null> {
  if (!TOKEN.test(token)) return null;
  const text = await readFile(stagedPath(token), 'utf8').catch(() => null);
  return text ? (JSON.parse(text) as WpSite) : null;
}

export async function dropStaged(token: string): Promise<void> {
  if (TOKEN.test(token)) await rm(stagedPath(token), { force: true });
}

const mediaRoot = () => path.resolve(process.cwd(), env.MEDIA_STORAGE_DIR);

export type WpPreview = { report: CheckReport; media: { files: number; strays: number }; redirects: number };

/** What a mapping would do: converted and checked, with nothing fetched and nothing written. */
export async function previewImport(site: WpSite, mapping: WpMapping, user: { id: string; allowRegex: boolean }): Promise<WpPreview> {
  const permalinks = await getPermalinks();
  const { documents } = convertSite(site, mapping, {
    permalinks,
    locale: localeConfig().defaultLocale,
    media: new Map(),
    files: new Map(),
    mediaRows: [],
  });
  const report = await checkDocuments(documents, {
    strategy: 'merge',
    allowRegex: user.allowRegex,
    attributeTo: user.id,
    hasFile: () => true,
    whenAddressMatches: mapping.existing,
  });
  const wanted = wantedAttachments(site, mapping, uploadKey);
  return { report, media: { files: wanted.attachments.length, strays: wanted.strays.length }, redirects: documents.redirects?.length ?? 0 };
}

export type WpImportOutcome =
  | { ok: true; report: CheckReport; backupTaken: string; media: { stored: number; reused: number; failures: { url: string; reason: string }[] } }
  | { ok: false; error: string; report?: CheckReport };

export async function runImport(
  site: WpSite,
  mapping: WpMapping,
  options: { userId: string; allowRegex: boolean; onInvalid: 'abort' | 'skip' },
): Promise<WpImportOutcome> {
  const permalinks = await getPermalinks();
  const wanted = wantedAttachments(site, mapping, uploadKey);
  const media = await downloadMedia(wanted.attachments, wanted.strays, { id: (key) => wpUuid(site.url, 'media', key), attributeTo: options.userId });

  const { documents } = convertSite(site, mapping, {
    permalinks,
    locale: localeConfig().defaultLocale,
    media: media.media,
    files: media.files,
    mediaRows: media.rows,
  });

  const root = mediaRoot();
  const outcome = await importDocuments(documents, {
    strategy: 'merge',
    onInvalid: options.onInvalid,
    attributeTo: options.userId,
    createdById: options.userId,
    allowRegex: options.allowRegex,
    hasFile: (filename) => existsSync(path.join(root, filename)),
    whenAddressMatches: mapping.existing,
  }).catch((error: unknown) => ({ ok: false as const, error: error instanceof Error ? error.message.slice(0, 400) : 'The import failed.' }));

  if (!outcome.ok) {
    await discardWritten(media.written);
    return outcome;
  }

  // Picture sizes, when the site makes them — the same as an upload gets.
  const settings = await getMediaSettings();
  if (settings.responsive) for (const row of media.rows) void refreshVariants(row.id as string, row.filename as string, { avif: settings.avif });

  return { ok: true, report: outcome.report, backupTaken: outcome.backupTaken, media: { stored: media.rows.length, reused: media.reused, failures: media.failures } };
}
