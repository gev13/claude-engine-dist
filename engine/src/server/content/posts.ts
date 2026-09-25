import 'server-only';
import { and, desc, eq, ilike, inArray, isNull, or, sql, type SQL } from 'drizzle-orm';
import { localeConfig, type Locale } from '@/lib/locales';
import { db } from '@/server/db';
import { categories, media, postCategories, posts, users } from '@/server/db/schema';
import type { AnyBlock } from '@/lib/blocks';
import { resolvePostLayout, type PostLayout } from '@/lib/blog';
import { postPath, type Permalinks } from '@/lib/permalinks';

/**
 * The category a post is filed under in its address: the primary one, or —
 * when nobody picked one — the first of its categories, in the order the
 * categories screen lists them. One expression, so a card and the route that
 * answers it agree.
 */
export const firstCategory = (column: 'slug' | 'name') =>
  sql<string | null>`coalesce(${column === 'slug' ? categories.slug : categories.name}, (
    select c.${sql.raw(column)} from ${postCategories} pc
    join ${categories} c on c.id = pc.category_id
    where pc.post_id = ${posts.id}
    order by c.sort_order, c.name
    limit 1
  ))`;

export type PostListItem = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  kind: 'article' | 'research';
  publishedAt: Date | null;
  readingMinutes: number;
  categorySlug: string | null;
  categoryName: string | null;
  coverUrl: string | null;
};

export type PostDetail = PostListItem & {
  body: string;
  /** The post's own blocks, shown according to `layout` (T3, 2.13). */
  blocks: AnyBlock[];
  layout: PostLayout;
  status: string;
  /** This post's own CSS, sanitised again where it is written into the page. */
  customCss: string;
  /** Translations of one another share this (package 8). */
  translationGroupId: string;
  seo: Record<string, unknown>;
  authorName: string | null;
  updatedAt: Date;
  categories: { slug: string; name: string }[];
};

/** Published-only predicate, used by every public read. */
const isPublic = and(
  eq(posts.status, 'published'),
  isNull(posts.deletedAt),
  sql`${posts.publishedAt} is not null and ${posts.publishedAt} <= now()`,
);

export async function listPosts(opts: {
  kind?: 'article' | 'research';
  categorySlug?: string;
  /** Leave this post out — "more from this category" on the post itself. */
  excludeId?: string;
  limit?: number;
  offset?: number;
  query?: string;
  /** The blog is per language: an Armenian reader sees Armenian posts. */
  locale?: Locale;
} = {}): Promise<PostListItem[]> {
  const { kind, categorySlug, limit = 12, offset = 0, query } = opts;
  const locale = opts.locale ?? localeConfig().defaultLocale;

  try {
    const conditions = [isPublic, eq(posts.locale, locale)];
    if (kind) conditions.push(eq(posts.kind, kind));
    if (opts.excludeId) conditions.push(sql`${posts.id} <> ${opts.excludeId}`);
    if (query) {
      const like = `%${query}%`;
      conditions.push(or(ilike(posts.title, like), ilike(posts.excerpt, like))!);
    }
    if (categorySlug) {
      const ids = db
        .select({ id: postCategories.postId })
        .from(postCategories)
        .innerJoin(categories, eq(categories.id, postCategories.categoryId))
        .where(eq(categories.slug, categorySlug));
      conditions.push(inArray(posts.id, ids));
    }

    const rows = await db
      .select({
        id: posts.id,
        slug: posts.slug,
        title: posts.title,
        excerpt: posts.excerpt,
        kind: posts.kind,
        publishedAt: posts.publishedAt,
        readingMinutes: posts.readingMinutes,
        categorySlug: firstCategory('slug'),
        categoryName: firstCategory('name'),
        coverUrl: media.url,
      })
      .from(posts)
      .leftJoin(categories, eq(categories.id, posts.primaryCategoryId))
      .leftJoin(media, eq(media.id, posts.coverMediaId))
      .where(and(...conditions))
      .orderBy(desc(posts.publishedAt))
      .limit(limit)
      .offset(offset);

    return rows;
  } catch {
    // Database unreachable (first run before `npm run setup`). The site still
    // renders; the blog section is simply empty.
    return [];
  }
}

export async function countPosts(
  opts: { kind?: 'article' | 'research'; categorySlug?: string; locale?: Locale } = {},
) {
  try {
    const conditions = [isPublic, eq(posts.locale, opts.locale ?? localeConfig().defaultLocale)];
    if (opts.kind) conditions.push(eq(posts.kind, opts.kind));
    if (opts.categorySlug) {
      const ids = db
        .select({ id: postCategories.postId })
        .from(postCategories)
        .innerJoin(categories, eq(categories.id, postCategories.categoryId))
        .where(eq(categories.slug, opts.categorySlug));
      conditions.push(inArray(posts.id, ids));
    }
    const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(posts).where(and(...conditions));
    return row?.n ?? 0;
  } catch {
    return 0;
  }
}

export async function getPost(slug: string, requested?: Locale): Promise<PostDetail | null> {
  const locale = requested ?? localeConfig().defaultLocale;
  return loadPost(and(eq(posts.slug, slug), eq(posts.locale, locale), isPublic));
}

/**
 * One post by id whatever its status — for the preview, which shows a draft
 * exactly as it will look published. Never used by a public route.
 */
export async function getPostForPreview(id: string): Promise<PostDetail | null> {
  return loadPost(eq(posts.id, id));
}

async function loadPost(where: SQL | undefined): Promise<PostDetail | null> {
  try {
    const [row] = await db
      .select({
        id: posts.id,
        slug: posts.slug,
        translationGroupId: posts.translationGroupId,
        title: posts.title,
        excerpt: posts.excerpt,
        body: posts.body,
        blocks: posts.blocks,
        layout: posts.layout,
        status: posts.status,
        customCss: posts.customCss,
        kind: posts.kind,
        seo: posts.seo,
        publishedAt: posts.publishedAt,
        updatedAt: posts.updatedAt,
        readingMinutes: posts.readingMinutes,
        categorySlug: firstCategory('slug'),
        categoryName: firstCategory('name'),
        authorFirst: users.firstName,
        authorLast: users.lastName,
        coverUrl: media.url,
      })
      .from(posts)
      .leftJoin(categories, eq(categories.id, posts.primaryCategoryId))
      .leftJoin(users, eq(users.id, posts.authorId))
      .leftJoin(media, eq(media.id, posts.coverMediaId))
      .where(where)
      .limit(1);

    if (!row) return null;

    const cats = await db
      .select({ slug: categories.slug, name: categories.name })
      .from(postCategories)
      .innerJoin(categories, eq(categories.id, postCategories.categoryId))
      .where(eq(postCategories.postId, row.id))
      .orderBy(categories.sortOrder, categories.name);

    const authorName = [row.authorFirst, row.authorLast].filter(Boolean).join(' ').trim() || null;

    return {
      id: row.id,
      slug: row.slug,
      translationGroupId: row.translationGroupId,
      title: row.title,
      excerpt: row.excerpt,
      body: row.body,
      blocks: (row.blocks ?? []) as AnyBlock[],
      layout: resolvePostLayout(row.layout),
      status: row.status,
      customCss: row.customCss ?? '',
      kind: row.kind,
      seo: (row.seo ?? {}) as Record<string, unknown>,
      publishedAt: row.publishedAt,
      updatedAt: row.updatedAt,
      readingMinutes: row.readingMinutes,
      categorySlug: row.categorySlug,
      categoryName: row.categoryName,
      coverUrl: row.coverUrl,
      authorName,
      categories: cats,
    };
  } catch {
    return null;
  }
}

/* ── Addresses ────────────────────────────────────────────────────────────── */

/** Where a post lives, under this site's permalinks. */
export function postUrl(p: Permalinks, post: { slug: string; categorySlug: string | null }): string {
  return postPath(p, { slug: post.slug, categorySlug: post.categorySlug });
}

/**
 * The public path of a post row as it is stored — what the admin's View link,
 * the revalidation after a save and the bulk redirects need, none of which
 * have the joined list item to hand.
 */
export async function postPathById(p: Permalinks, id: string): Promise<string | null> {
  try {
    const [row] = await db
      .select({ slug: posts.slug, categorySlug: firstCategory('slug') })
      .from(posts)
      .leftJoin(categories, eq(categories.id, posts.primaryCategoryId))
      .where(eq(posts.id, id))
      .limit(1);
    return row ? postPath(p, row) : null;
  } catch {
    return null;
  }
}

export async function allPublishedPostSlugs(
  requested?: Locale,
): Promise<{ slug: string; categorySlug: string | null; updatedAt: Date }[]> {
  const locale = requested ?? localeConfig().defaultLocale;
  try {
    return await db
      .select({ slug: posts.slug, categorySlug: firstCategory('slug'), updatedAt: posts.updatedAt })
      .from(posts)
      .leftJoin(categories, eq(categories.id, posts.primaryCategoryId))
      .where(and(isPublic, eq(posts.locale, locale)))
      .orderBy(desc(posts.publishedAt));
  } catch {
    return [];
  }
}

/**
 * Every published post in every language, each carrying its translations —
 * for the sitemap, which lists a URL once with its alternates beside it.
 */
export async function allPublishedPostsByGroup(): Promise<
  {
    slug: string;
    categorySlug: string | null;
    locale: Locale;
    updatedAt: Date;
    alternates: { locale: Locale; slug: string; categorySlug: string | null }[];
  }[]
> {
  try {
    const rows = await db
      .select({
        slug: posts.slug,
        categorySlug: firstCategory('slug'),
        locale: posts.locale,
        updatedAt: posts.updatedAt,
        groupId: posts.translationGroupId,
      })
      .from(posts)
      .leftJoin(categories, eq(categories.id, posts.primaryCategoryId))
      .where(isPublic)
      .orderBy(desc(posts.publishedAt));

    const byGroup = new Map<string, { locale: Locale; slug: string; categorySlug: string | null }[]>();
    for (const row of rows) {
      const list = byGroup.get(row.groupId) ?? [];
      list.push({ locale: row.locale as Locale, slug: row.slug, categorySlug: row.categorySlug });
      byGroup.set(row.groupId, list);
    }

    return rows.map((row) => ({
      slug: row.slug,
      categorySlug: row.categorySlug,
      locale: row.locale as Locale,
      updatedAt: row.updatedAt,
      alternates: byGroup.get(row.groupId) ?? [],
    }));
  } catch {
    return [];
  }
}

/**
 * Where else this post exists, as `{ locale, slug }` — what `hreflang` is
 * built from, and what the language switcher offers.
 */
export async function getPostTranslations(
  translationGroupId: string,
): Promise<{ locale: Locale; slug: string; categorySlug: string | null }[]> {
  try {
    const rows = await db
      .select({ locale: posts.locale, slug: posts.slug, categorySlug: firstCategory('slug') })
      .from(posts)
      .leftJoin(categories, eq(categories.id, posts.primaryCategoryId))
      .where(and(eq(posts.translationGroupId, translationGroupId), isPublic));
    return rows.map((row) => ({ locale: row.locale as Locale, slug: row.slug, categorySlug: row.categorySlug }));
  } catch {
    return [];
  }
}
