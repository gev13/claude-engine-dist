import { PostCollection } from '@/components/blocks/dynamic';
import { Card, CardGrid } from '@/components/ui/Card';
import type { ResolvedBlog } from '@/lib/blog';
import { formatDate } from '@/lib/utils';
import type { listPosts } from '@/server/content/posts';

type PostRow = Awaited<ReturnType<typeof listPosts>>[number];

/**
 * BL1 — the post list on the blog's own pages (the index without a Blog page,
 * categories, research), in the layout picked in Appearance → Blog. `grid`
 * is the card grid these pages always had.
 */
export function BlogList({ posts, blog, fallbackEyebrow }: { posts: PostRow[]; blog: ResolvedBlog; fallbackEyebrow: string }) {
  if (blog.index === 'grid') {
    return (
      <CardGrid cols={3}>
        {posts.map((p) => (
          <Card key={p.id} eyebrow={p.publishedAt ? formatDate(p.publishedAt) : fallbackEyebrow} title={p.title} href={`/blog/${p.slug}`}>
            {p.excerpt}
          </Card>
        ))}
      </CardGrid>
    );
  }
  return <PostCollection posts={posts} variant={blog.index} pagination={blog.pagination} perPage={blog.perPage} />;
}
