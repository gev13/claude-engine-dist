import 'server-only';
import { cache } from 'react';
import { eq } from 'drizzle-orm';
import type { ShareImage } from '@/lib/seo/metadata';
import { db } from '@/server/db';
import { media } from '@/server/db/schema';

/* ═══════════════════════════════════════════════════════════════════════════
   The picture a page is shared with (T21, 2.18)
   ───────────────────────────────────────────────────────────────────────────
   Every page used to share `/og-default.png`: the SEO panel stored an Open
   Graph image and nothing read it. The order is now the page's own choice,
   then its hero or cover, then the site's default (Settings), then the
   bundled one — each with its real size and type when the library knows
   them, rather than a 1200×630 claimed for every picture.
   ═══════════════════════════════════════════════════════════════════════════ */

const byId = cache(async (id: string): Promise<ShareImage | null> => {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  try {
    const [row] = await db
      .select({ url: media.url, width: media.width, height: media.height, mimeType: media.mimeType, altText: media.altText })
      .from(media)
      .where(eq(media.id, id))
      .limit(1);
    return row?.mimeType.startsWith('image/') ? toImage(row) : null;
  } catch {
    return null;
  }
});

const byUrl = cache(async (url: string): Promise<ShareImage> => {
  if (!url.startsWith('/media/')) return { url };
  try {
    const [row] = await db
      .select({ url: media.url, width: media.width, height: media.height, mimeType: media.mimeType, altText: media.altText })
      .from(media)
      .where(eq(media.url, url))
      .limit(1);
    return row ? toImage(row) : { url };
  } catch {
    return { url };
  }
});

function toImage(row: { url: string; width: number | null; height: number | null; mimeType: string; altText: string }): ShareImage {
  return {
    url: row.url,
    ...(row.width && row.height ? { width: row.width, height: row.height } : {}),
    type: row.mimeType,
    ...(row.altText ? { alt: row.altText } : {}),
  };
}

/** The first of: the chosen image, the page's own picture, the site's default. Undefined leaves the bundled one. */
export async function shareImage(options: { ogImageId?: string; fallbackUrl?: string | null; siteDefault?: string }): Promise<ShareImage | undefined> {
  if (options.ogImageId) {
    const chosen = await byId(options.ogImageId);
    if (chosen) return chosen;
  }
  const url = options.fallbackUrl || options.siteDefault;
  return url ? byUrl(url) : undefined;
}
