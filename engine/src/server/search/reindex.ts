import 'server-only';
import { eq } from 'drizzle-orm';
import { env } from '@/lib/env';
import { db } from '@/server/db';
import { categories, posts } from '@/server/db/schema';
import { toPlainText } from '@/server/content/sanitize';
import { ensureIndex, indexDocuments, type SearchDocument } from './meili';

/**
 * Rebuild the blog's Meilisearch index from the published posts.
 *
 * `null` when Meilisearch is not switched on — Postgres full-text search then
 * answers, and its index is an expression index that follows the rows by
 * itself. Shared by `npm run search:index` and a content import (2.20),
 * which changes posts in bulk without passing through the editor.
 */
export async function reindexPosts(): Promise<{ indexed: number } | { error: string } | null> {
  if (!env.MEILISEARCH_ENABLED) return null;
  const ready = await ensureIndex();
  if (!ready) return { error: `Could not reach Meilisearch at ${env.MEILISEARCH_HOST}.` };

  const rows = await db
    .select({
      id: posts.id,
      slug: posts.slug,
      title: posts.title,
      excerpt: posts.excerpt,
      body: posts.body,
      kind: posts.kind,
      publishedAt: posts.publishedAt,
      categorySlug: categories.slug,
      categoryName: categories.name,
    })
    .from(posts)
    .leftJoin(categories, eq(categories.id, posts.primaryCategoryId))
    .where(eq(posts.status, 'published'));

  const documents: SearchDocument[] = rows.map((r) => ({
    ...r,
    body: toPlainText(r.body).slice(0, 20_000),
    publishedAt: r.publishedAt ? r.publishedAt.getTime() : null,
  }));

  await indexDocuments(documents);
  return { indexed: documents.length };
}
