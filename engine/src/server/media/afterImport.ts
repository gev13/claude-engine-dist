import 'server-only';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { eq } from 'drizzle-orm';
import { db } from '@/server/db';
import { media } from '@/server/db/schema';
import { probeVideo } from './probe';
import { resolveStoredPath } from './storage';
import { cleanSvg } from './svg';
import { getMediaSettings, startSizesJob } from './variants';

/* ═══════════════════════════════════════════════════════════════════════════
   What an upload does to a file, done for files an archive brought (3.22)
   ───────────────────────────────────────────────────────────────────────────
   An upload cleans an SVG, reads a film's size and makes a picture's smaller
   copies. A transfer archive's files arrive by copy instead, so they used to
   skip all three: an SVG kept whatever script it carried, an ambient film
   fell back to 16:9, and pictures had no sizes. After an import, each file
   the import wrote gets the same treatment. Never throws — a file it cannot
   read is left as it came and counted.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Films are read whole to find their header (an MP4's can be at the end); past this they keep what the archive said. */
const VIDEO_READ_LIMIT = 512 * 1024 * 1024;

export type AfterImport = { svgCleaned: number; svgRefused: number; videosSized: number; sizesQueued: boolean };

export async function afterImportMedia(filenames: string[]): Promise<AfterImport> {
  const result: AfterImport = { svgCleaned: 0, svgRefused: 0, videosSized: 0, sizesQueued: false };
  for (const filename of filenames) {
    try {
      const full = resolveStoredPath(filename);
      if (!full) continue;
      if (/\.svg$/i.test(filename)) {
        const cleaned = cleanSvg(await readFile(full, 'utf8'));
        if (!cleaned) {
          // Not an SVG at all: an empty drawing rather than whatever it was.
          await writeFile(full, '<svg xmlns="http://www.w3.org/2000/svg"/>');
          result.svgRefused++;
          continue;
        }
        await writeFile(full, cleaned.svg);
        result.svgCleaned++;
        if (cleaned.width && cleaned.height) {
          await db.update(media).set({ width: cleaned.width, height: cleaned.height }).where(eq(media.filename, filename));
        }
        continue;
      }
      const video = /\.(mp4|webm)$/i.exec(filename);
      if (video) {
        const [row] = await db.select({ width: media.width, height: media.height }).from(media).where(eq(media.filename, filename)).limit(1);
        if (!row || (row.width && row.height)) continue;
        if ((await stat(full)).size > VIDEO_READ_LIMIT) continue;
        const info = probeVideo(await readFile(full), video[1]!.toLowerCase());
        if (info) {
          await db.update(media).set({ width: info.width, height: info.height, durationMs: info.durationMs }).where(eq(media.filename, filename));
          result.videosSized++;
        }
      }
    } catch {
      /* Left as it came. */
    }
  }
  // Pictures' smaller copies, as an upload makes them — in the background, only those without.
  try {
    if ((await getMediaSettings()).responsive) result.sizesQueued = await startSizesJob({ onlyMissing: true });
  } catch {
    /* Media → Generate sizes still offers it. */
  }
  return result;
}
