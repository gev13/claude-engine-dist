import 'server-only';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { AnyBlock } from '@/lib/blocks';
import { resolvePostLayout } from '@/lib/blog';
import { SITE_URL } from '@/lib/env';
import type { SitemapOptions } from '@/lib/seo/sitemap';
import { collectImages } from '@/lib/seo/sitemapImages';
import { SITEMAP_STYLESHEET_PATH } from '@/lib/seo/sitemapXsl';
import { db } from '@/server/db';
import { media, pages, posts, projects } from '@/server/db/schema';
import { expandSavedBlocks } from '@/server/content/savedBlocks';
import { getSiteSettings } from '@/server/content/siteSettings';
import type { Locale } from '@/lib/locales';

/* ═══════════════════════════════════════════════════════════════════════════
   What Settings adds to the sitemaps (3.19)
   ───────────────────────────────────────────────────────────────────────────
   Two switches, both off by default: the browser stylesheet and the pictures
   on each address. Every sitemap route asks `sitemapSetup()` once and passes
   the answer on, so the index and the sitemaps it lists always agree.

   Pictures are keyed `locale|path` for pages and `locale|slug` for posts and
   projects — the keys each route already has in hand. A failed read lists no
   pictures rather than failing the sitemap: the addresses matter more.
   ═══════════════════════════════════════════════════════════════════════════ */

export type SitemapSetup = { options: SitemapOptions; images: boolean };

export async function sitemapSetup(): Promise<SitemapSetup> {
  const settings = await getSiteSettings();
  return {
    options: settings.sitemapStyle ? { stylesheet: SITEMAP_STYLESHEET_PATH } : {},
    images: settings.sitemapImages === true,
  };
}

export const imageKey = (locale: string, pathOrSlug: string) => `${locale}|${pathOrSlug}`;

const published = <T extends typeof pages | typeof posts | typeof projects>(table: T) =>
  and(eq(table.status, 'published'), isNull(table.deletedAt), sql`${table.publishedAt} is not null and ${table.publishedAt} <= now()`);

async function blocksOf(blocks: unknown, locale: string): Promise<AnyBlock[]> {
  if (!Array.isArray(blocks)) return [];
  try {
    return await expandSavedBlocks(blocks as AnyBlock[], locale as Locale);
  } catch {
    return blocks as AnyBlock[];
  }
}

/** Pictures on every published page, by `locale|path`. */
export async function pageImages(): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  try {
    const rows = await db.select({ path: pages.path, locale: pages.locale, blocks: pages.blocks }).from(pages).where(published(pages));
    for (const row of rows) {
      const images = collectImages([await blocksOf(row.blocks, row.locale)], SITE_URL);
      if (images.length) out.set(imageKey(row.locale, row.path), images);
    }
  } catch {
    // no pictures rather than no sitemap
  }
  return out;
}

/** Pictures on every published post — its cover, and the body or blocks its layout shows — by `locale|slug`. */
export async function postImages(): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  const cover = alias(media, 'cover');
  try {
    const rows = await db
      .select({ slug: posts.slug, locale: posts.locale, body: posts.body, blocks: posts.blocks, layout: posts.layout, coverUrl: cover.url })
      .from(posts)
      .leftJoin(cover, eq(cover.id, posts.coverMediaId))
      .where(published(posts));
    for (const row of rows) {
      const layout = resolvePostLayout(row.layout);
      const images = collectImages(
        [row.coverUrl, layout !== 'blocks' ? row.body : null, layout !== 'body' ? await blocksOf(row.blocks, row.locale) : null],
        SITE_URL,
      );
      if (images.length) out.set(imageKey(row.locale, row.slug), images);
    }
  } catch {
    // no pictures rather than no sitemap
  }
  return out;
}

/** Pictures on every published project — its cover and its blocks — by `locale|slug`. */
export async function projectImages(): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  const cover = alias(media, 'cover');
  try {
    const rows = await db
      .select({ slug: projects.slug, locale: projects.locale, blocks: projects.blocks, coverUrl: cover.url })
      .from(projects)
      .leftJoin(cover, eq(cover.id, projects.coverMediaId))
      .where(published(projects));
    for (const row of rows) {
      const images = collectImages([row.coverUrl, await blocksOf(row.blocks, row.locale)], SITE_URL);
      if (images.length) out.set(imageKey(row.locale, row.slug), images);
    }
  } catch {
    // no pictures rather than no sitemap
  }
  return out;
}
