import 'server-only';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { inArray } from 'drizzle-orm';
import { env } from '@/lib/env';
import { uploadKey } from '@/lib/wordpress/content';
import type { WpItem } from '@/lib/wordpress/model';
import { canUploadSvg } from '@/lib/mediaSettings';
import { db, schema } from '@/server/db';
import { getMediaSettings } from '@/server/media/variants';
import { MediaUploadError, deleteStored, saveUpload } from '@/server/media/storage';
import { getPublic } from '@/server/security/outbound';
import type { MediaRef } from './convert';

/* ═══════════════════════════════════════════════════════════════════════════
   Bringing a WordPress site's files across (T37, 2.20)
   ───────────────────────────────────────────────────────────────────────────
   Each file is fetched through `getPublic` (no private addresses, a size
   cap, three redirects at most) and stored through `saveUpload` — the same
   magic-byte check, allowlist and SVG rebuild an editor's upload gets.
   Nothing is fetched twice: a file whose row an earlier run made is reused
   by id, and one this site already holds — the same bytes under any name —
   by checksum. Files written here and then not imported are deleted.
   ═══════════════════════════════════════════════════════════════════════════ */

export type MediaResult = {
  media: Map<number, MediaRef>;
  files: Map<string, string>;
  rows: Record<string, unknown>[];
  /** Files this run wrote — removed again if the import does not go ahead. */
  written: string[];
  failures: { url: string; reason: string }[];
  reused: number;
};

const CONCURRENCY = 4;

export async function downloadMedia(
  attachments: WpItem[],
  strays: string[],
  opts: { id: (key: string | number) => string; attributeTo: string },
): Promise<MediaResult> {
  const result: MediaResult = { media: new Map(), files: new Map(), rows: [], written: [], failures: [], reused: 0 };
  const settings = await getMediaSettings();
  const allowSvg = canUploadSvg(settings, 'admin');

  const jobs = [
    ...attachments.map((a) => ({ wpId: a.id, url: a.attachmentUrl!, alt: a.meta._wp_attachment_image_alt ?? '', caption: a.excerpt, mime: a.mimeType, title: a.title })),
    ...strays.map((url) => ({ wpId: 0, url, alt: '', caption: '', mime: undefined as string | undefined, title: '' })),
  ];
  const ids = jobs.map((job) => opts.id(job.wpId || (uploadKey(job.url) ?? job.url)));
  const earlier = new Map(
    (ids.length ? await db.select({ id: schema.media.id, url: schema.media.url }).from(schema.media).where(inArray(schema.media.id, ids)) : []).map((r) => [r.id, r.url]),
  );
  const byChecksum = new Map(
    (await db.select({ id: schema.media.id, url: schema.media.url, checksum: schema.media.checksum }).from(schema.media))
      .filter((r) => r.checksum)
      .map((r) => [r.checksum!, { id: r.id, url: r.url }]),
  );

  const remember = (job: (typeof jobs)[number], ref: MediaRef) => {
    if (job.wpId) result.media.set(job.wpId, ref);
    const key = uploadKey(job.url);
    if (key) result.files.set(key, ref.url);
  };

  let next = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const index = next++;
      const job = jobs[index]!;
      const rowId = ids[index]!;
      const already = earlier.get(rowId);
      if (already) {
        result.reused++;
        remember(job, { id: rowId, url: already });
        continue;
      }
      // A cut size (photo-300x200.jpg) is fetched as its original first.
      const original = job.url.replace(/-\d+x\d+(?=\.[a-z0-9]+(?:[?#]|$))/i, '');
      let fetched = await getPublic(original, { maxBytes: env.MEDIA_MAX_FILE_BYTES, timeoutMs: 60_000 });
      if (!fetched.ok && original !== job.url) fetched = await getPublic(job.url, { maxBytes: env.MEDIA_MAX_FILE_BYTES, timeoutMs: 60_000 });
      if (!fetched.ok) {
        result.failures.push({ url: job.url, reason: fetched.error });
        continue;
      }
      const checksum = createHash('sha256').update(fetched.body).digest('hex');
      const twin = byChecksum.get(checksum);
      if (twin) {
        result.reused++;
        remember(job, twin);
        continue;
      }
      const name = decodeURIComponent(path.basename(new URL(fetched.url).pathname)) || 'file';
      const type = (job.mime || fetched.contentType.split(';')[0] || '').trim();
      try {
        const stored = await saveUpload(new File([new Uint8Array(fetched.body)], name, { type }), opts.attributeTo, { allowSvg });
        result.written.push(stored.filename);
        byChecksum.set(stored.checksum, { id: rowId, url: stored.url });
        remember(job, { id: rowId, url: stored.url });
        result.rows.push({
          id: rowId,
          ...stored,
          altText: job.alt.slice(0, 300),
          caption: job.caption,
        });
      } catch (error) {
        result.failures.push({ url: job.url, reason: error instanceof MediaUploadError ? error.message : 'The file could not be stored.' });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, worker));
  return result;
}

/** Remove the files a run wrote, when its import did not go ahead. */
export async function discardWritten(filenames: string[]): Promise<void> {
  for (const filename of filenames) await deleteStored(filename).catch(() => undefined);
}
