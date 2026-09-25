import 'server-only';
import { cache } from 'react';
import { eq } from 'drizzle-orm';
import { db } from '@/server/db';
import { media } from '@/server/db/schema';

/**
 * The stored shape of a file in the library, by its public address — for a
 * block that holds only a URL but wants the file's own proportions (2.17).
 * Once per address per request; null for anything not in the library.
 */
export const mediaShape = cache(async (url: string | undefined): Promise<{ width: number; height: number } | null> => {
  if (!url || !url.startsWith('/media/')) return null;
  try {
    const [row] = await db.select({ width: media.width, height: media.height }).from(media).where(eq(media.url, url)).limit(1);
    return row?.width && row.height ? { width: row.width, height: row.height } : null;
  } catch {
    return null;
  }
});
