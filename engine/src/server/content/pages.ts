import 'server-only';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { db } from '@/server/db';
import { pages } from '@/server/db/schema';
import type { AnyBlock } from '@/lib/blocks';
import type { SeoFields } from '@/server/db/schema';
import { pageDefinitions, pageDefinitionByPath } from '@/content/pages';

export type PublicPage = {
  id: string;
  path: string;
  slug: string;
  title: string;
  summary: string;
  excerpt: string;
  template: string;
  priorityTier: string | null;
  blocks: AnyBlock[];
  seo: SeoFields;
  updatedAt: Date;
  publishedAt: Date | null;
  /** True when this came from the bundled definitions, not the database. */
  fallback: boolean;
};

function fromDefinition(path: string): PublicPage | null {
  const def = pageDefinitionByPath(path);
  if (!def) return null;
  return {
    id: `def:${def.path}`,
    path: def.path,
    slug: def.slug,
    title: def.title,
    summary: def.summary ?? '',
    excerpt: def.excerpt,
    template: def.template ?? 'default',
    priorityTier: def.priorityTier ?? null,
    blocks: def.blocks,
    seo: def.seo,
    updatedAt: new Date(),
    publishedAt: new Date(),
    fallback: true,
  };
}

/**
 * A page is public when it is published *and* its publish date has passed.
 *
 * The date half was missing: a page scheduled for next week went live the
 * moment it was saved, while a post scheduled the same way correctly waited.
 * Scheduling now means the same thing for both.
 */
const isPublic = and(
  eq(pages.status, 'published'),
  isNull(pages.deletedAt),
  sql`${pages.publishedAt} is not null and ${pages.publishedAt} <= now()`,
);

/**
 * Resolve a public page by path. Database first (so admin edits win), bundled
 * definition second (so a fresh clone renders before any DB exists).
 */
export async function getPageByPath(path: string): Promise<PublicPage | null> {
  const normalised = path === '' ? '/' : path.replace(/\/+$/, '') || '/';

  try {
    const [row] = await db
      .select()
      .from(pages)
      .where(and(eq(pages.path, normalised), isPublic))
      .limit(1);

    if (row) {
      return {
        id: row.id,
        path: row.path,
        slug: row.slug,
        title: row.title,
        summary: row.summary,
      excerpt: row.excerpt,
        template: row.template,
        priorityTier: row.priorityTier,
        blocks: (row.blocks ?? []) as AnyBlock[],
        seo: (row.seo ?? {}) as SeoFields,
        updatedAt: row.updatedAt,
        publishedAt: row.publishedAt,
        fallback: false,
      };
    }
  } catch {
    // fall through to bundled definitions
  }

  return fromDefinition(normalised);
}

/** Every published path, for sitemap generation and static params. */
export async function allPublishedPagePaths(): Promise<
  { path: string; title: string; updatedAt: Date; template: string; priorityTier: string | null }[]
> {
  try {
    const rows = await db
      .select({
        path: pages.path,
        title: pages.title,
        updatedAt: pages.updatedAt,
        template: pages.template,
        priorityTier: pages.priorityTier,
      })
      .from(pages)
      .where(isPublic)
      .orderBy(asc(pages.path));
    if (rows.length > 0) return rows;
  } catch {
    // fall through
  }
  return pageDefinitions.map((d) => ({
    path: d.path,
    title: d.title,
    updatedAt: new Date(),
    template: d.template ?? 'default',
    priorityTier: d.priorityTier ?? null,
  }));
}
