import 'server-only';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/server/db';
import { categories, posts } from '@/server/db/schema';
import type { PostListItem } from '@/server/content/posts';
import { blogIndex } from './meili';

/**
 * Blog search. Meilisearch when it is configured and answering, Postgres
 * full-text otherwise — same shape either way, so callers never branch.
 */
export async function searchPosts(query: string, limit = 20): Promise<PostListItem[]> {
  const q = query.trim();
  if (!q) return [];

  const index = blogIndex();
  if (index) {
    try {
      const result = await index.search(q, { limit });
      const ids = result.hits.map((h) => h.id as string);
      if (ids.length === 0) return [];
      const rows = await loadByIds(ids);
      // Preserve Meilisearch's relevance ordering.
      const order = new Map<string, number>(ids.map((id, i) => [id, i]));
      return rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    } catch (error) {
      console.error('[search] meilisearch unavailable, falling back to Postgres', error);
    }
  }

  return postgresSearch(q, limit);
}

async function loadByIds(ids: string[]): Promise<PostListItem[]> {
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
    })
    .from(posts)
    .leftJoin(categories, eq(categories.id, posts.primaryCategoryId))
    .where(sql`${posts.id} = any(${ids}) and ${posts.status} = 'published'`);
  return rows.map((r) => ({ ...r, coverUrl: null }));
}

/** Uses the GIN index created in drizzle/sql/0001_audit_immutable.sql. */
async function postgresSearch(q: string, limit: number): Promise<PostListItem[]> {
  try {
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
        rank: sql<number>`ts_rank(
          to_tsvector('english', coalesce(${posts.title}, '') || ' ' || coalesce(${posts.excerpt}, '') || ' ' || coalesce(${posts.body}, '')),
          websearch_to_tsquery('english', ${q})
        )`,
      })
      .from(posts)
      .leftJoin(categories, eq(categories.id, posts.primaryCategoryId))
      .where(
        and(
          eq(posts.status, 'published'),
          sql`to_tsvector('english', coalesce(${posts.title}, '') || ' ' || coalesce(${posts.excerpt}, '') || ' ' || coalesce(${posts.body}, ''))
              @@ websearch_to_tsquery('english', ${q})`,
        ),
      )
      .orderBy(sql`4 desc`, desc(posts.publishedAt))
      .limit(limit);

    return rows.map(({ rank: _rank, ...r }) => ({ ...r, coverUrl: null }));
  } catch (error) {
    console.error('[search] postgres search failed', error);
    return [];
  }
}
