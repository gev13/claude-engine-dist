import 'server-only';
import { Meilisearch, type Index } from 'meilisearch';
import { env } from '@/lib/env';

/**
 * Meilisearch powers blog search only, per the specification. It is optional:
 * when MEILISEARCH_ENABLED is false or the service is unreachable, search
 * falls back to Postgres full-text (see ./index.ts), so the site never
 * depends on it being up.
 */

export const BLOG_INDEX = 'posts';

export type SearchDocument = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  kind: 'article' | 'research';
  categorySlug: string | null;
  categoryName: string | null;
  publishedAt: number | null;
};

let client: Meilisearch | null = null;

export function meili(): Meilisearch | null {
  if (!env.MEILISEARCH_ENABLED) return null;
  client ??= new Meilisearch({ host: env.MEILISEARCH_HOST, apiKey: env.MEILISEARCH_MASTER_KEY || undefined });
  return client;
}

export function blogIndex(): Index<SearchDocument> | null {
  const c = meili();
  if (!c) return null;
  try {
    return c.index<SearchDocument>(BLOG_INDEX);
  } catch {
    return null;
  }
}

/** Idempotent. Safe to call on every deploy. */
export async function ensureIndex(): Promise<boolean> {
  const c = meili();
  if (!c) return false;
  try {
    await c.createIndex(BLOG_INDEX, { primaryKey: 'id' }).catch(() => undefined);
    const index = c.index<SearchDocument>(BLOG_INDEX);
    await index.updateSettings({
      searchableAttributes: ['title', 'excerpt', 'body', 'categoryName'],
      filterableAttributes: ['kind', 'categorySlug'],
      sortableAttributes: ['publishedAt'],
      displayedAttributes: ['id', 'slug', 'title', 'excerpt', 'kind', 'categorySlug', 'categoryName', 'publishedAt'],
      rankingRules: ['words', 'typo', 'proximity', 'attribute', 'sort', 'exactness'],
    });
    return true;
  } catch (error) {
    console.error('[meili] could not prepare index', error);
    return false;
  }
}

export async function indexDocuments(documents: SearchDocument[]): Promise<void> {
  const index = blogIndex();
  if (!index || documents.length === 0) return;
  try {
    await index.addDocuments(documents);
  } catch (error) {
    // Indexing is a side effect of publishing; it must never fail the publish.
    console.error('[meili] index failed', error);
  }
}

export async function removeDocument(id: string): Promise<void> {
  const index = blogIndex();
  if (!index) return;
  try {
    await index.deleteDocument(id);
  } catch (error) {
    console.error('[meili] delete failed', error);
  }
}
