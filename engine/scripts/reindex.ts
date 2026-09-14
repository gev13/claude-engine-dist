import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { db } from '@/server/db';
import { categories, posts } from '@/server/db/schema';
import { ensureIndex, indexDocuments, type SearchDocument } from '@/server/search/meili';
import { env } from '@/lib/env';
import { toPlainText } from '@/server/content/sanitize';

/** Rebuilds the blog search index from scratch. Run after a bulk import. */
async function main() {
  if (!env.MEILISEARCH_ENABLED) {
    console.log('\nMEILISEARCH_ENABLED is false — nothing to do.');
    console.log('Blog search is served by Postgres full-text until you enable it.\n');
    process.exit(0);
  }

  const ready = await ensureIndex();
  if (!ready) {
    console.error('\nCould not reach Meilisearch at', env.MEILISEARCH_HOST, '\n');
    process.exit(1);
  }

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
  console.log(`\nIndexed ${documents.length} post(s) into Meilisearch.\n`);
  process.exit(0);
}

main().catch((error) => {
  console.error('\nReindex failed:', error);
  process.exit(1);
});
