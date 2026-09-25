import { PostCollection } from '@/components/blocks/dynamic';
import { Card, CardGrid } from '@/components/ui/Card';
import type { ResolvedBlog } from '@/lib/blog';
import { formatDate } from '@/lib/utils';
import { postPath, type Permalinks } from '@/lib/permalinks';
import type { listPosts } from '@/server/content/posts';

type PostRow = Awaited<ReturnType<typeof listPosts>>[number];

/**
 * BL1 — the post list on the blog's own pages (the index without a Blog page,
 * categories, research), in the layout picked in Appearance → Blog. `grid`
 * is the card grid these pages always had.
 */
export function BlogList({
  posts,
  blog,
  fallbackEyebrow,
  permalinks,
  listId,
  labels,
}: {
  posts: PostRow[];
  blog: ResolvedBlog;
  fallbackEyebrow: string;
  permalinks: Permalinks;
  /** The id "Load more" finds this list by in the next page's HTML. */
  listId?: string;
  /** Chips for a post with no category, in the reader's language. */
  labels?: { research: string; article: string };
}) {
  if (blog.index === 'grid') {
    return (
      <CardGrid cols={3} id={listId}>
        {posts.map((p) => (
          <Card
            key={p.id}
            eyebrow={p.publishedAt ? formatDate(p.publishedAt) : fallbackEyebrow}
            title={p.title}
            href={postPath(permalinks, p)}
          >
            {p.excerpt}
          </Card>
        ))}
      </CardGrid>
    );
  }
  return (
    <PostCollection
      posts={posts}
      variant={blog.index}
      pagination={blog.pagination}
      perPage={blog.perPage}
      permalinks={permalinks}
      listId={listId}
      labels={labels}
    />
  );
}
