import 'server-only';
import { unlink } from 'node:fs/promises';
import { and, eq, inArray, sql } from 'drizzle-orm';
import sharp from 'sharp';
import { MEDIA_SETTING_KEY, resolveMediaSettings, type MediaSettings, type MediaVariant } from '@/lib/mediaSettings';
import { RESPONSIVE_WIDTHS, isResizable, variantFilename, widthsFor, type VariantFormat } from '@/lib/responsive';
import { db } from '@/server/db';
import { media, settings } from '@/server/db/schema';
import { resolveStoredPath } from './storage';

/* ═══════════════════════════════════════════════════════════════════════════
   Smaller copies of a picture (T18, 2.17)
   ───────────────────────────────────────────────────────────────────────────
   Written beside the original under names `lib/responsive.ts` derives, so
   the media route finds them without a lookup, and recorded on the media
   row for the library to show. Made when a picture is uploaded while
   responsive images are on, and for everything already in the library by
   Media → Generate sizes, which runs in the background one picture at a
   time and reports how far it has got.
   ═══════════════════════════════════════════════════════════════════════════ */

const FORMATS: VariantFormat[] = ['webp', 'avif'];

export async function getMediaSettings(): Promise<MediaSettings> {
  try {
    const [row] = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, MEDIA_SETTING_KEY)).limit(1);
    return resolveMediaSettings(row?.value);
  } catch {
    return resolveMediaSettings(undefined);
  }
}

/** Remove every copy a picture could have. A missing one is not an error. */
export async function deleteVariants(filename: string): Promise<void> {
  for (const width of RESPONSIVE_WIDTHS) {
    for (const format of FORMATS) {
      const absolute = resolveStoredPath(variantFilename(filename, width, format));
      if (!absolute) continue;
      await unlink(absolute).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== 'ENOENT') throw error;
      });
    }
  }
}

/**
 * Make the copies one picture should have — WebP, and AVIF when asked —
 * replacing any it had. Never wider than the original; a picture narrower
 * than the smallest width gets none, and is served as it is.
 */
export async function generateVariants(filename: string, options: { avif: boolean }): Promise<MediaVariant[]> {
  if (!isResizable(`/media/${filename}`)) return [];
  const absolute = resolveStoredPath(filename);
  if (!absolute) return [];

  const meta = await sharp(absolute).metadata();
  const widths = widthsFor(meta.width);
  await deleteVariants(filename);

  const made: MediaVariant[] = [];
  for (const width of widths) {
    for (const format of options.avif ? FORMATS : (['webp'] as const)) {
      const target = resolveStoredPath(variantFilename(filename, width, format));
      if (!target) continue;
      // `rotate()` applies the EXIF orientation, so a phone photo is not served sideways.
      const pipeline = sharp(absolute).rotate().resize({ width, withoutEnlargement: true });
      const info = await (format === 'avif' ? pipeline.avif({ quality: 55, effort: 4 }) : pipeline.webp({ quality: 80 })).toFile(target);
      made.push({ width: info.width, height: info.height, format, bytes: info.size });
    }
  }
  return made;
}

/** Make and record one picture's copies. Never throws: a picture that fails keeps being served whole. */
export async function refreshVariants(id: string, filename: string, options: { avif: boolean }): Promise<boolean> {
  try {
    const variants = await generateVariants(filename, options);
    await db.update(media).set({ variants }).where(eq(media.id, id));
    return true;
  } catch (error) {
    console.error('[media] could not make smaller copies', { filename, error });
    return false;
  }
}

/* ── Generate sizes, for the whole library ────────────────────────────────── */

export type SizesJob = {
  running: boolean;
  total: number;
  done: number;
  failed: number;
  startedAt: string | null;
  finishedAt: string | null;
};

const holder = globalThis as unknown as { __heSizesJob?: SizesJob };
const idle = (): SizesJob => ({ running: false, total: 0, done: 0, failed: 0, startedAt: null, finishedAt: null });

export function sizesJob(): SizesJob {
  return holder.__heSizesJob ?? idle();
}

const RESIZABLE_MIMES = ['image/webp', 'image/png', 'image/jpeg'];

/** Pictures that could have copies: the resizable kinds, wider than the smallest copy. */
function eligible() {
  return and(inArray(media.mimeType, RESIZABLE_MIMES), sql`coalesce(${media.width}, 0) > ${RESPONSIVE_WIDTHS[0]}`);
}

/** How many pictures have no copies yet — what the screen offers to generate. */
export async function missingSizesCount(): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(media)
    .where(and(eligible(), sql`jsonb_array_length(${media.variants}) = 0`));
  return row?.n ?? 0;
}

/**
 * Start the job in the background; false when one is already running. With
 * `onlyMissing` it skips pictures that already have copies — after switching
 * AVIF on or off, run it for everything.
 */
export async function startSizesJob(options: { onlyMissing: boolean }): Promise<boolean> {
  if (sizesJob().running) return false;
  const settingsNow = await getMediaSettings();
  const rows = await db
    .select({ id: media.id, filename: media.filename })
    .from(media)
    .where(options.onlyMissing ? and(eligible(), sql`jsonb_array_length(${media.variants}) = 0`) : eligible())
    .orderBy(media.createdAt);

  const job: SizesJob = { running: true, total: rows.length, done: 0, failed: 0, startedAt: new Date().toISOString(), finishedAt: null };
  holder.__heSizesJob = job;

  void (async () => {
    for (const row of rows) {
      // One at a time: sharp uses every core for one picture already.
      const ok = await refreshVariants(row.id, row.filename, { avif: settingsNow.avif });
      if (ok) job.done++;
      else job.failed++;
    }
    job.running = false;
    job.finishedAt = new Date().toISOString();
  })();
  return true;
}
