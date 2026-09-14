import 'server-only';
import { and, desc, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm';
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
} = {}): Promise<PostListItem[]> {
  const { kind, categorySlug, limit = 12, offset = 0, query } = opts;

  try {
    const conditions = [isPublic];
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

export async function countPosts(opts: { kind?: 'article' | 'research'; categorySlug?: string } = {}) {
  try {
    const conditions = [isPublic];
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

export async function getPost(slug: string): Promise<PostDetail | null> {
  try {
    const [row] = await db
      .select({
        id: posts.id,
        slug: posts.slug,
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
      .where(and(eq(posts.slug, slug), isPublic))
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

export async function allPublishedPostSlugs(): Promise<{ slug: string; updatedAt: Date }[]> {
  try {
    return await db
      .select({ slug: posts.slug, updatedAt: posts.updatedAt })
      .from(posts)
      .where(isPublic)
      .orderBy(desc(posts.publishedAt));
  } catch {
    return [];
  }
}
