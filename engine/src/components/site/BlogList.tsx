import { PostCollection } from '@/components/blocks/dynamic';
import { Card, CardGrid } from '@/components/ui/Card';
import type { ResolvedBlog } from '@/lib/blog';
import { wantsTilt } from '@/lib/cardHover';
import { formatDate } from '@/lib/utils';
import { CardTilt } from './CardTilt';
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
  labels?: { research: string; article: string; minRead?: string; readMore?: string };
}) {
  const card = blog.card;
  if (blog.index === 'grid') {
    /* The card grid's line above the title: its date, as always — or what the
       site picked (2.18), joined with a middle dot. */
    const eyebrow = (p: PostRow) => {
      const parts = [
        card.category ? (p.kind === 'research' ? labels?.research : (p.categoryName ?? labels?.article)) : null,
        card.date !== false && p.publishedAt ? formatDate(p.publishedAt) : null,
        card.readingTime && labels?.minRead ? `${p.readingMinutes} ${labels.minRead}` : null,
      ].filter(Boolean);
      return parts.length ? parts.join(' · ') : fallbackEyebrow;
    };
    return (
      <CardGrid cols={3} id={listId}>
        {posts.map((p) => (
          <Card key={p.id} eyebrow={eyebrow(p)} title={p.title} href={postPath(permalinks, p)} hover={card.hover}>
            {p.excerpt}
            {card.readMore && labels?.readMore && <span className="he-card__more">{labels.readMore} →</span>}
          </Card>
        ))}
        {wantsTilt(card.hover) && <CardTilt />}
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
      card={card}
    />
  );
}
