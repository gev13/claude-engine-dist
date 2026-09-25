import 'dotenv/config';
import { reindexPosts } from '@/server/search/reindex';

/** Rebuilds the blog search index from scratch. Run after a bulk import. */
async function main() {
  const result = await reindexPosts();
  if (result === null) {
    console.log('\nMEILISEARCH_ENABLED is false — nothing to do.');
    console.log('Blog search is served by Postgres full-text until you enable it.\n');
    process.exit(0);
  }
  if ('error' in result) {
    console.error(`\n${result.error}\n`);
    process.exit(1);
  }
  console.log(`\nIndexed ${result.indexed} post(s) into Meilisearch.\n`);
  process.exit(0);
}

main().catch((error) => {
  console.error('\nReindex failed:', error);
  process.exit(1);
});
