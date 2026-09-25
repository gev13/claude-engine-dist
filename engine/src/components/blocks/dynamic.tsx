import Link from '@/components/ui/SiteLink';
import type { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Card, CardGrid } from '@/components/ui/Card';
import { Section } from '@/components/ui/Section';
import { cn } from '@/lib/utils';
import { blockSchemas } from '@/lib/blocks';
import { messageReader } from '@/lib/messages';
import { blogIndexPath, pagedPath, postPath, type Permalinks } from '@/lib/permalinks';
import { getMessages } from '@/server/content/messages';
import { getPermalinks } from '@/server/routing/config';
import { Pagination, resultRange } from '@/components/site/Pagination';
import type { Paging } from '@/server/content/resolve';
import { getServiceCatalogue } from '@/server/content/services';
import { formatDate } from '@/lib/utils';
import { listPosts } from '@/server/content/posts';
import { BlockHead } from './parts';
import { PostPager } from './library/PostPager';
import { Carousel } from './library/Carousel';
import { SiteImg } from '@/components/ui/SiteImg';
import type { PostCardOptions } from '@/lib/blog';
import { cardHoverProps, wantsTilt } from '@/lib/cardHover';
import { CardTilt } from '@/components/site/CardTilt';

type P<T extends keyof typeof blockSchemas> = z.output<(typeof blockSchemas)[T]>;

/** Service index — reads the canonical catalogue, never props. */
export async function ServicesIndexBlock(p: P<'servicesIndex'>) {
  const [catalogue, messages] = await Promise.all([getServiceCatalogue(), getMessages()]);
  const readMore = messageReader(messages)('block.readMore');
  const list =
    p.tier === 'primary' ? catalogue.primary : p.tier === 'secondary' ? catalogue.secondary : catalogue.all;
  return (
    <Section tone={p.tone ?? 'base'} size="lg">
      <BlockHead eyebrow={p.eyebrow} title={p.title} titleAs={p.titleAs} intro={p.intro} className="mb-9" />
      <CardGrid cols={3}>
        {list.map((s) => (
          <Card
            key={s.slug}
            eyebrow={p.eyebrows === 'none' ? undefined : s.tier === 'primary' ? p.primaryLabel || 'Core' : p.secondaryLabel || 'Specialist'}
            title={s.title}
            href={s.path}
            moreLabel={readMore}
          >
            {s.blurb}
          </Card>
        ))}
      </CardGrid>
    </Section>
  );
}

type T = ReturnType<typeof messageReader>;

/** What a list needs besides its posts: where they live, and the words around them. */
type ListContext = { permalinks: Permalinks; t: T };

/**
 * Post list — queries published posts, filtered by kind and/or category.
 *
 * `paging` is handed down by the renderer to the one list on a page that
 * pages on the server (`pagination: 'server'`): it says which page this is,
 * so the list reads that slice and prints real links to the others.
 */
export async function PostListBlock(p: P<'postList'> & { paging?: Paging; blockId?: string }) {
  const [permalinks, messages] = await Promise.all([getPermalinks(), getMessages()]);
  const t = messageReader(messages);
  const ctx: ListContext = { permalinks, t };
  const server = p.pagination === 'server';
  const paging = server ? p.paging : undefined;
  const posts = await listPosts({
    kind: p.kind === 'all' ? undefined : p.kind,
    categorySlug: p.categorySlug,
    limit: p.limit,
    offset: paging ? (paging.number - 1) * p.limit : 0,
  });
  const listId = paging ? `he-list-${p.blockId ?? 'posts'}` : undefined;
  const pager = paging && (
    <>
      <Pagination
        current={paging.number}
        total={paging.total}
        href={(n) => pagedPath(paging.base, n, permalinks)}
        style={p.pager}
        labels={{
          nav: t('archive.pagination'),
          previous: t('archive.previousPage'),
          next: t('archive.nextPage'),
          page: (n) => t('archive.page', { n }),
          loadMore: t('archive.loadMore'),
          loading: t('archive.loading'),
        }}
        listId={listId}
      />
    </>
  );
  const count = paging && p.resultCount && (
    <p className="he-result-count label-mono mb-8">{t('archive.resultCount', resultRange(paging.number, p.limit, paging.count))}</p>
  );
  // Past this point `server` behaves like `none`: every post of this page is in the HTML.
  const view = { ...p, pagination: server ? ('none' as const) : p.pagination };
  const indexHref = blogIndexPath(permalinks);

  if (p.variant === 'news') {
    // CT13 — cover image with a type chip, title, date and excerpt.
    return (
      <Section tone={p.tone ?? 'base'} size="lg">
        <BlockHead eyebrow={p.eyebrow} title={p.title} titleAs={p.titleAs} intro={p.intro} align="center" className="mb-10" />
        {posts.length === 0 ? (
          <p className="m-0 text-center text-[length:var(--he-block-text,16px)] text-smoke">{t('blog.nothingHere')}</p>
        ) : (
          <>
            {count}
            <ul className="he-news" id={listId} style={{ '--cols': p.columns } as React.CSSProperties}>
              {posts.map((post) => (
                <li key={post.id} {...cardHoverProps(p.card?.hover)}>
                  <Link href={postPath(permalinks, post)} className="he-news__card">
                    <div className={cn('he-news__media', !post.coverUrl && 'he-media-empty')}>
                      {post.coverUrl && (
                        <SiteImg src={post.coverUrl} alt="" className="he-fill" loading="lazy" sizes="third" />
                      )}
                      <span className="he-news__chip">{chipFor(post, t)}</span>
                    </div>
                    <div className="he-news__body">
                      <h3 className="he-news__title">{post.title}</h3>
                      {post.publishedAt && (
                        <time className="he-news__date" dateTime={post.publishedAt.toISOString()}>
                          {formatDate(post.publishedAt)}
                        </time>
                      )}
                      {post.excerpt && <p className="he-news__excerpt">{post.excerpt}</p>}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            {wantsTilt(p.card?.hover) && <CardTilt />}
            {pager ?? (
              <div className="he-news__all">
                <Button href={indexHref} variant="outline">
                  {t('blog.viewAll')}
                </Button>
              </div>
            )}
          </>
        )}
      </Section>
    );
  }

  if (p.variant === 'featured') return <FeaturedPosts p={view} posts={posts} ctx={ctx} />;
  if (p.variant === 'carousel') {
    const carousel = postCarousel(view, posts, ctx);
    // With nothing published, or a post the slider cannot show, the list layout says so plainly.
    return carousel ? (
      <Carousel {...carousel} />
    ) : (
      <PostLayouts p={{ ...view, variant: 'list' }} posts={posts} ctx={ctx} listId={listId} pager={pager} count={count} />
    );
  }
  if (p.variant !== 'cards') return <PostLayouts p={view} posts={posts} ctx={ctx} listId={listId} pager={pager} count={count} />;

  return (
    <Section tone={p.tone ?? 'base'} size="lg">
      <BlockHead eyebrow={p.eyebrow} title={p.title} titleAs={p.titleAs} intro={p.intro} className="mb-9" />
      {posts.length === 0 ? (
        <p className="m-0 text-[length:var(--he-block-text,16px)] text-smoke">{t('blog.nothingHere')}</p>
      ) : (
        <>
          {count}
          <CardGrid cols={p.columns} id={listId}>
            {posts.map((post) => (
              <Card
                key={post.id}
                eyebrow={
                  <>
                    {chipFor(post, t)}
                    {post.publishedAt ? ` — ${formatDate(post.publishedAt)}` : ''}
                  </>
                }
                title={post.title}
                href={postPath(permalinks, post)}
                hover={p.card?.hover}
                moreLabel={t('blog.readMore')}
              >
                {post.excerpt}
              </Card>
            ))}
          </CardGrid>
          {wantsTilt(p.card?.hover) && <CardTilt />}
        </>
      )}
      {pager ?? (posts.length > 0 && <AllWriting href={indexHref} t={t} />)}
    </Section>
  );
}

/** The link under a list to the whole blog. */
function AllWriting({ href, t }: { href: string; t: T }) {
  return (
    <Link
      href={href}
      className="mt-9 inline-flex font-mono text-[11px] uppercase tracking-[0.12em] text-flare-soft hover:text-flare-hot"
    >
      {t('blog.allWriting')} →
    </Link>
  );
}

type PostRow = Awaited<ReturnType<typeof listPosts>>[number];

const chipFor = (post: PostRow, t: T) => (post.kind === 'research' ? t('blog.research') : post.categoryName ?? t('blog.article'));

/**
 * P3-B6 — the posts as the carousel's cards, so they share its arrows, dots,
 * swiping and pause rules. Built through the carousel's own schema; null when
 * there is nothing to show.
 */
function postCarousel(p: P<'postList'>, posts: PostRow[], { permalinks, t }: ListContext) {
  if (posts.length === 0) return null;
  const result = blockSchemas.carousel.safeParse({
    tone: p.tone,
    mode: 'cards',
    eyebrow: p.eyebrow?.slice(0, 80),
    title: p.title?.slice(0, 160),
    titleAs: p.titleAs,
    intro: p.intro?.slice(0, 400),
    link: { label: t('blog.allWriting'), href: blogIndexPath(permalinks) },
    slides: posts.slice(0, 24).map((post) => ({
      eyebrow: [chipFor(post, t), post.publishedAt ? formatDate(post.publishedAt) : ''].filter(Boolean).join(' · ').slice(0, 80),
      title: post.title.slice(0, 160),
      body: post.excerpt ? post.excerpt.slice(0, 600) : undefined,
      imageUrl: post.coverUrl ?? undefined,
      alt: '',
      href: postPath(permalinks, post),
      buttonLabel: t('blog.read'),
    })),
    perView: { base: p.columns, tablet: 2, mobile: 1.15 },
  });
  return result.success ? result.data : null;
}

/** P3-B6 — one large post, the rest as a list beside it (a magazine front page). */
function FeaturedPosts({ p, posts, ctx: { permalinks, t } }: { p: P<'postList'>; posts: PostRow[]; ctx: ListContext }) {
  const [lead, ...rest] = posts;
  const date = (post: PostRow) =>
    post.publishedAt && (
      <time className="he-feat__date" dateTime={post.publishedAt.toISOString()}>
        {formatDate(post.publishedAt)}
      </time>
    );
  const cover = (post: PostRow) =>
    post.coverUrl ? (
      <SiteImg src={post.coverUrl} alt="" className="he-fill" loading="lazy" decoding="async" sizes="third" />
    ) : (
      <span className="he-fill he-media-empty" aria-hidden="true" />
    );

  return (
    <Section tone={p.tone ?? 'base'} size="lg">
      <BlockHead eyebrow={p.eyebrow} title={p.title} titleAs={p.titleAs} intro={p.intro} className="mb-9" />
      {!lead ? (
        <p className="m-0 text-[length:var(--he-block-text,16px)] text-smoke">{t('blog.nothingHere')}</p>
      ) : (
        <div className={cn('he-feat', rest.length === 0 && 'is-single')}>
          <Link href={postPath(permalinks, lead)} className="he-feat__lead">
            <div className="he-feat__media">{cover(lead)}</div>
            <span className="he-plst__chip">{chipFor(lead, t)}</span>
            <h3 className="he-feat__title">{lead.title}</h3>
            {date(lead)}
            {lead.excerpt && <p className="he-feat__excerpt">{lead.excerpt}</p>}
          </Link>
          {rest.length > 0 && (
            <ul className="he-feat__list">
              {rest.map((post) => (
                <li key={post.id}>
                  <Link href={postPath(permalinks, post)} className="he-feat__item">
                    <div className="he-feat__thumb">{cover(post)}</div>
                    <div>
                      <span className="he-plst__chip">{chipFor(post, t)}</span>
                      <h3 className="he-feat__itemtitle">{post.title}</h3>
                      {date(post)}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {lead && <AllWriting href={blogIndexPath(permalinks)} t={t} />}
    </Section>
  );
}

export type PostListVariant = 'list' | 'minimal' | 'overlay' | 'compact' | 'wide';

/** The V6 layouts on their own: the post-list block, and the blog's own index pages (BL1). */
export function PostCollection({
  posts,
  variant,
  columns = 3,
  pagination = 'none',
  perPage = 6,
  permalinks,
  labels = { research: 'Research', article: 'Article' },
  listId,
  card = {},
}: {
  posts: PostRow[];
  variant: PostListVariant;
  columns?: 2 | 3;
  pagination?: 'none' | 'more' | 'pages';
  perPage?: number;
  permalinks: Permalinks;
  /** The chip on a post with no category, in the reader's language. */
  labels?: { research: string; article: string; minRead?: string; readMore?: string };
  /** The id "Load more" finds this list by in the next page's HTML. */
  listId?: string;
  /** What each card shows (2.18); unset is what these layouts always showed. */
  card?: PostCardOptions;
}) {
  const minimal = variant === 'minimal';
  const moves = cardHoverProps(card.hover);
  const withExcerpt = variant === 'list' || variant === 'wide' || variant === 'overlay';

  const items = posts.map((post) => {
    const date = card.date !== false && post.publishedAt && (
      <time className="he-plst__date" dateTime={post.publishedAt.toISOString()}>
        {formatDate(post.publishedAt)}
      </time>
    );
    return (
      <li key={post.id} className={cn('he-plst__item', moves.className)} style={moves.style}>
        <Link href={postPath(permalinks, post)} className="he-plst__link">
          {!minimal && (
            <div className="he-plst__media">
              {post.coverUrl ? (
                <SiteImg src={post.coverUrl} alt="" className="he-fill" loading="lazy" decoding="async" sizes="third" />
              ) : (
                <span className="he-fill he-media-empty" aria-hidden="true" />
              )}
            </div>
          )}
          {minimal && date}
          <div className="he-plst__text">
            {card.category !== false && <span className="he-plst__chip">{post.kind === 'research' ? labels.research : post.categoryName ?? labels.article}</span>}
            <h3 className="he-plst__title">{post.title}</h3>
            {!minimal && date}
            {card.readingTime && labels.minRead && <span className="he-plst__read">{`${post.readingMinutes} ${labels.minRead}`}</span>}
            {withExcerpt && post.excerpt && <p className="he-plst__excerpt">{post.excerpt}</p>}
            {card.readMore && labels.readMore && <span className="he-plst__more he-more">{labels.readMore} <span className="he-more__icon" aria-hidden="true">→</span></span>}
          </div>
          {minimal && (
            <span className="he-plst__arrow" aria-hidden="true">
              →
            </span>
          )}
        </Link>
      </li>
    );
  });

  const listClass = cn('he-plst', `is-${variant}`, card.ratio && 'has-ratio');
  const style = { '--cols': columns, ...(card.ratio ? { '--he-plst-ratio': card.ratio.replace('/', ' / ') } : {}) } as React.CSSProperties;

  const tilt = wantsTilt(card.hover) && <CardTilt />;
  if (pagination === 'none') {
    return (
      <>
        <ul className={listClass} style={style} id={listId}>
          {items}
        </ul>
        {tilt}
      </>
    );
  }
  return (
    <>
      <PostPager items={items} perPage={perPage} mode={pagination} className={listClass} style={style} />
      {tilt}
    </>
  );
}

/** V6 — list, minimal, text over the cover, compact and wide layouts, optionally a few at a time. */
function PostLayouts({
  p,
  posts,
  ctx: { permalinks, t },
  listId,
  pager,
  count,
}: {
  p: P<'postList'>;
  posts: PostRow[];
  ctx: ListContext;
  listId?: string;
  pager?: React.ReactNode;
  count?: React.ReactNode;
}) {
  return (
    <Section tone={p.tone ?? 'base'} size="lg">
      <BlockHead eyebrow={p.eyebrow} title={p.title} titleAs={p.titleAs} intro={p.intro} className="mb-9" />
      {posts.length === 0 ? (
        <p className="m-0 text-[length:var(--he-block-text,16px)] text-smoke">{t('blog.nothingHere')}</p>
      ) : (
        <>
          {count}
          <PostCollection
            posts={posts}
            variant={p.variant as PostListVariant}
            columns={p.columns}
            pagination={p.pagination === 'server' ? 'none' : p.pagination}
            perPage={p.perPage}
            permalinks={permalinks}
            labels={{ research: t('blog.research'), article: t('blog.article'), minRead: t('blog.minRead'), readMore: t('blog.readMore') }}
            listId={listId}
            card={p.card}
          />
        </>
      )}
      {pager ?? (posts.length > 0 && <AllWriting href={blogIndexPath(permalinks)} t={t} />)}
    </Section>
  );
}
