import { PostCollection } from '@/components/blocks/dynamic';
import { Card, CardGrid } from '@/components/ui/Card';
import { titleClamp, type ResolvedBlog } from '@/lib/blog';
import { wantsTilt } from '@/lib/cardHover';
import { cardDate } from '@/lib/dates';
import { cn } from '@/lib/utils';
import { CardTilt } from './CardTilt';
import { SiteImg } from '@/components/ui/SiteImg';
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
    // 3.24 — titles cut to two or three lines.
    const clamp = titleClamp(card);
    const category = (p: PostRow) => (p.kind === 'research' ? labels?.research : (p.categoryName ?? labels?.article));
    const look = blog.look.card;
    const eyebrow = (p: PostRow) => {
      const reading = card.readingTime && labels?.minRead ? `${p.readingMinutes} ${labels.minRead}` : null;
      const parts = [card.category && card.categoryPlace !== 'under' ? category(p) : null, card.date !== false && p.publishedAt ? cardDate(p.publishedAt) : null, reading].filter(Boolean);
      if (!parts.length) return fallbackEyebrow;
      // 3.28 — the reading time in a weight of its own: the line in two parts.
      if (look.readingWeight && reading && parts.length > 1) {
        return (
          <>
            {parts.slice(0, -1).join(' · ')}
            <span className="he-ucard__rt">{` · ${reading}`}</span>
          </>
        );
      }
      return parts.join(' · ');
    };
    return (
      <CardGrid
        cols={3}
        id={listId}
        // 3.28 — the hook for Appearance → Blog → Details (lib/blogCss), and its gap between cards.
        className={cn('he-pcards', clamp.className)}
        gapSize={look.gap}
        style={
          card.image && card.ratio
            ? ({ '--he-ucard-ratio': card.ratio.replace('/', ' / '), ...clamp.style } as React.CSSProperties)
            : clamp.className
              ? (clamp.style as React.CSSProperties)
              : undefined
        }
      >
        {posts.map((p) => (
          <Card
            key={p.id}
            eyebrow={eyebrow(p)}
            title={p.title}
            href={postPath(permalinks, p)}
            hover={card.hover}
            moreLabel={labels?.readMore}
            // 3.23 — the card's own "Read more" is the only one (it used to be printed twice); off when the site says so.
            more={card.readMore !== false}
            // 3.22 — the cover at the top of each card.
            media={
              card.image
                ? p.coverUrl
                  ? <SiteImg src={p.coverUrl} alt="" className="he-fill" loading="lazy" decoding="async" sizes="third" />
                  : <span className="he-fill he-media-empty" aria-hidden="true" />
                : undefined
            }
          >
            {/* 3.23 — the category as a chip under the title, and the excerpt only when wanted. */}
            {card.categoryPlace === 'under' && <span className="he-chip he-card__chip">{category(p)}</span>}
            {card.excerpt !== false && p.excerpt}
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
