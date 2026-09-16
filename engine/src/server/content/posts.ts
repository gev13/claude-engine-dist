import 'server-only';
import { and, desc, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm';
import { localeConfig, type Locale } from '@/lib/locales';
import { db } from '@/server/db';
import { categories, media, postCategories, posts, users } from '@/server/db/schema';

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
        categorySlug: categories.slug,
        categoryName: categories.name,
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
  try {
    const [row] = await db
      .select({
        id: posts.id,
        slug: posts.slug,
        translationGroupId: posts.translationGroupId,
        title: posts.title,
        excerpt: posts.excerpt,
        body: posts.body,
        kind: posts.kind,
        seo: posts.seo,
        publishedAt: posts.publishedAt,
        updatedAt: posts.updatedAt,
        readingMinutes: posts.readingMinutes,
        categorySlug: categories.slug,
        categoryName: categories.name,
        authorFirst: users.firstName,
        authorLast: users.lastName,
        coverUrl: media.url,
      })
      .from(posts)
      .leftJoin(categories, eq(categories.id, posts.primaryCategoryId))
      .leftJoin(users, eq(users.id, posts.authorId))
      .leftJoin(media, eq(media.id, posts.coverMediaId))
      .where(and(eq(posts.slug, slug), eq(posts.locale, locale), isPublic))
      .limit(1);

    if (!row) return null;

    const cats = await db
      .select({ slug: categories.slug, name: categories.name })
      .from(postCategories)
      .innerJoin(categories, eq(categories.id, postCategories.categoryId))
      .where(eq(postCategories.postId, row.id));

    const authorName = [row.authorFirst, row.authorLast].filter(Boolean).join(' ').trim() || null;

    return {
      id: row.id,
      slug: row.slug,
      translationGroupId: row.translationGroupId,
      title: row.title,
      excerpt: row.excerpt,
      body: row.body,
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

export async function allPublishedPostSlugs(requested?: Locale): Promise<{ slug: string; updatedAt: Date }[]> {
  const locale = requested ?? localeConfig().defaultLocale;
  try {
    return await db
      .select({ slug: posts.slug, updatedAt: posts.updatedAt })
      .from(posts)
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
  { slug: string; locale: Locale; updatedAt: Date; alternates: { locale: Locale; slug: string }[] }[]
> {
  try {
    const rows = await db
      .select({
        slug: posts.slug,
        locale: posts.locale,
        updatedAt: posts.updatedAt,
        groupId: posts.translationGroupId,
      })
      .from(posts)
      .where(isPublic)
      .orderBy(desc(posts.publishedAt));

    const byGroup = new Map<string, { locale: Locale; slug: string }[]>();
    for (const row of rows) {
      const list = byGroup.get(row.groupId) ?? [];
      list.push({ locale: row.locale as Locale, slug: row.slug });
      byGroup.set(row.groupId, list);
    }

    return rows.map((row) => ({
      slug: row.slug,
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
export async function getPostTranslations(translationGroupId: string): Promise<{ locale: Locale; slug: string }[]> {
  try {
    const rows = await db
      .select({ locale: posts.locale, slug: posts.slug })
      .from(posts)
      .where(and(eq(posts.translationGroupId, translationGroupId), isPublic));
    return rows.map((row) => ({ locale: row.locale as Locale, slug: row.slug }));
  } catch {
    return [];
  }
}
