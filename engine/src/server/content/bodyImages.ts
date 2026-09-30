import 'server-only';
import { inArray } from 'drizzle-orm';
import { bodyImageUrls, rewriteBodyImages, type BodyImageShape } from '@/lib/bodyImages';
import { responsiveImages } from '@/lib/responsive';
import { db } from '@/server/db';
import { media } from '@/server/db/schema';

/** 3.22 — a post's text with its library pictures sized, and (responsive images on) given a srcset. Never throws. */
export async function withBodyImages(html: string): Promise<string> {
  const urls = bodyImageUrls(html);
  if (urls.length === 0) return html;
  try {
    const rows = await db.select({ url: media.url, width: media.width, height: media.height }).from(media).where(inArray(media.url, urls.slice(0, 200)));
    const shapes = new Map<string, BodyImageShape>();
    for (const row of rows) if (row.width && row.height) shapes.set(row.url, { width: row.width, height: row.height });
    return rewriteBodyImages(html, shapes, responsiveImages());
  } catch {
    return html;
  }
}
