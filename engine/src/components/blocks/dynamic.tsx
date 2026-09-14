import Link from 'next/link';
import type { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Card, CardGrid } from '@/components/ui/Card';
import { Section } from '@/components/ui/Section';
import { cn } from '@/lib/utils';
import { blockSchemas } from '@/lib/blocks';
import { servicePath, site } from '@/lib/site';
import { getServiceCatalogue } from '@/server/content/services';
import { formatDate } from '@/lib/utils';
import { listPosts } from '@/server/content/posts';
import { BlockHead } from './parts';
import { PostPager } from './library/PostPager';
import { Carousel } from './library/Carousel';

type P<T extends keyof typeof blockSchemas> = z.output<(typeof blockSchemas)[T]>;

/** Service index — reads the canonical catalogue, never props. */
export async function ServicesIndexBlock(p: P<'servicesIndex'>) {
  const catalogue = await getServiceCatalogue();
  const list =
    p.tier === 'primary' ? catalogue.primary : p.tier === 'secondary' ? catalogue.secondary : catalogue.all;
  return (
    <Section tone={p.tone ?? 'base'} size="lg">
      <BlockHead eyebrow={p.eyebrow} title={p.title} titleAs={p.titleAs} intro={p.intro} className="mb-9" />
      <CardGrid cols={3}>
        {list.map((s) => (
          <Card
            key={s.slug}
            eyebrow={s.tier === 'primary' ? 'Core' : 'Specialist'}
            title={s.title}
            href={servicePath(s.slug)}
          >
            {s.blurb}
          </Card>
        ))}
      </CardGrid>
    </Section>
  );
}

/** Post list — queries published posts, filtered by kind and/or category. */
export async function PostListBlock(p: P<'postList'>) {
  const posts = await listPosts({
    kind: p.kind === 'all' ? undefined : p.kind,
    categorySlug: p.categorySlug,
    limit: p.limit,
  });

  if (p.variant === 'news') {
    // CT13 — cover image with a type chip, title, date and excerpt.
    return (
      <Section tone={p.tone ?? 'base'} size="lg">
        <BlockHead eyebrow={p.eyebrow} title={p.title} titleAs={p.titleAs} intro={p.intro} align="center" className="mb-10" />
        {posts.length === 0 ? (
          <p className="m-0 text-center text-[16px] text-smoke">Nothing published here yet.</p>
        ) : (
          <>
            <ul className="he-news" style={{ '--cols': p.columns } as React.CSSProperties}>
              {posts.map((post) => (
                <li key={post.id}>
                  <Link href={`${site.blogBase}/${post.slug}`} className="he-news__card">
                    <div className={cn('he-news__media', !post.coverUrl && 'he-media-empty')}>
                      {post.coverUrl && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={post.coverUrl} alt="" className="he-fill" loading="lazy" />
                      )}
                      <span className="he-news__chip">
                        {post.kind === 'research' ? 'Research' : post.categoryName ?? 'Article'}
                      </span>
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
            <div className="he-news__all">
              <Button href={site.blogBase} variant="outline">
                View all
              </Button>
            </div>
          </>
        )}
      </Section>
    );
  }

  if (p.variant === 'featured') return <FeaturedPosts p={p} posts={posts} />;
  if (p.variant === 'carousel') {
    const carousel = postCarousel(p, posts);
    // With nothing published, or a post the slider cannot show, the list layout says so plainly.
    return carousel ? <Carousel {...carousel} /> : <PostLayouts p={{ ...p, variant: 'list' }} posts={posts} />;
  }
  if (p.variant !== 'cards') return <PostLayouts p={p} posts={posts} />;

  return (
    <Section tone={p.tone ?? 'base'} size="lg">
      <BlockHead eyebrow={p.eyebrow} title={p.title} titleAs={p.titleAs} intro={p.intro} className="mb-9" />
      {posts.length === 0 ? (
        <p className="m-0 text-[16px] text-smoke">Nothing published here yet.</p>
      ) : (
        <CardGrid cols={p.columns}>
          {posts.map((post) => (
            <Card
              key={post.id}
              eyebrow={
                <>
                  {post.kind === 'research' ? 'Research' : post.categoryName ?? 'Article'}
                  {post.publishedAt ? ` — ${formatDate(post.publishedAt)}` : ''}
                </>
              }
              title={post.title}
              href={`${site.blogBase}/${post.slug}`}
            >
              {post.excerpt}
            </Card>
          ))}
        </CardGrid>
      )}
      {posts.length > 0 && (
        <Link
          href={site.blogBase}
          className="mt-9 inline-flex font-mono text-[11px] uppercase tracking-[0.12em] text-flare-soft hover:text-flare-hot"
        >
          All writing →
        </Link>
      )}
    </Section>
  );
}

type PostRow = Awaited<ReturnType<typeof listPosts>>[number];

const chipFor = (post: PostRow) => (post.kind === 'research' ? 'Research' : post.categoryName ?? 'Article');

/**
 * P3-B6 — the posts as the carousel's cards, so they share its arrows, dots,
 * swiping and pause rules. Built through the carousel's own schema; null when
 * there is nothing to show.
 */
function postCarousel(p: P<'postList'>, posts: PostRow[]) {
  if (posts.length === 0) return null;
  const result = blockSchemas.carousel.safeParse({
    tone: p.tone,
    mode: 'cards',
    eyebrow: p.eyebrow?.slice(0, 80),
    title: p.title?.slice(0, 160),
    titleAs: p.titleAs,
    intro: p.intro?.slice(0, 400),
    link: { label: 'All writing', href: site.blogBase },
    slides: posts.slice(0, 24).map((post) => ({
      eyebrow: [chipFor(post), post.publishedAt ? formatDate(post.publishedAt) : ''].filter(Boolean).join(' · ').slice(0, 80),
      title: post.title.slice(0, 160),
      body: post.excerpt ? post.excerpt.slice(0, 600) : undefined,
      imageUrl: post.coverUrl ?? undefined,
      alt: '',
      href: `${site.blogBase}/${post.slug}`,
      buttonLabel: 'Read',
    })),
    perView: { base: p.columns, tablet: 2, mobile: 1.15 },
  });
  return result.success ? result.data : null;
}

/** P3-B6 — one large post, the rest as a list beside it (a magazine front page). */
function FeaturedPosts({ p, posts }: { p: P<'postList'>; posts: PostRow[] }) {
  const [lead, ...rest] = posts;
  const date = (post: PostRow) =>
    post.publishedAt && (
      <time className="he-feat__date" dateTime={post.publishedAt.toISOString()}>
        {formatDate(post.publishedAt)}
      </time>
    );
  const cover = (post: PostRow) =>
    post.coverUrl ? (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img src={post.coverUrl} alt="" className="he-fill" loading="lazy" decoding="async" />
    ) : (
      <span className="he-fill he-media-empty" aria-hidden="true" />
    );

  return (
    <Section tone={p.tone ?? 'base'} size="lg">
      <BlockHead eyebrow={p.eyebrow} title={p.title} titleAs={p.titleAs} intro={p.intro} className="mb-9" />
      {!lead ? (
        <p className="m-0 text-[16px] text-smoke">Nothing published here yet.</p>
      ) : (
        <div className={cn('he-feat', rest.length === 0 && 'is-single')}>
          <Link href={`${site.blogBase}/${lead.slug}`} className="he-feat__lead">
            <div className="he-feat__media">{cover(lead)}</div>
            <span className="he-plst__chip">{chipFor(lead)}</span>
            <h3 className="he-feat__title">{lead.title}</h3>
            {date(lead)}
            {lead.excerpt && <p className="he-feat__excerpt">{lead.excerpt}</p>}
          </Link>
          {rest.length > 0 && (
            <ul className="he-feat__list">
              {rest.map((post) => (
                <li key={post.id}>
                  <Link href={`${site.blogBase}/${post.slug}`} className="he-feat__item">
                    <div className="he-feat__thumb">{cover(post)}</div>
                    <div>
                      <span className="he-plst__chip">{chipFor(post)}</span>
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
      {lead && (
        <Link
          href={site.blogBase}
          className="mt-9 inline-flex font-mono text-[11px] uppercase tracking-[0.12em] text-flare-soft hover:text-flare-hot"
        >
          All writing →
        </Link>
      )}
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
}: {
  posts: PostRow[];
  variant: PostListVariant;
  columns?: 2 | 3;
  pagination?: 'none' | 'more' | 'pages';
  perPage?: number;
}) {
  const minimal = variant === 'minimal';
  const withExcerpt = variant === 'list' || variant === 'wide' || variant === 'overlay';

  const items = posts.map((post) => {
    const date = post.publishedAt && (
      <time className="he-plst__date" dateTime={post.publishedAt.toISOString()}>
        {formatDate(post.publishedAt)}
      </time>
    );
    return (
      <li key={post.id} className="he-plst__item">
        <Link href={`${site.blogBase}/${post.slug}`} className="he-plst__link">
          {!minimal && (
            <div className="he-plst__media">
              {post.coverUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={post.coverUrl} alt="" className="he-fill" loading="lazy" decoding="async" />
              ) : (
                <span className="he-fill he-media-empty" aria-hidden="true" />
              )}
            </div>
          )}
          {minimal && date}
          <div className="he-plst__text">
            <span className="he-plst__chip">{post.kind === 'research' ? 'Research' : post.categoryName ?? 'Article'}</span>
            <h3 className="he-plst__title">{post.title}</h3>
            {!minimal && date}
            {withExcerpt && post.excerpt && <p className="he-plst__excerpt">{post.excerpt}</p>}
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

  const listClass = cn('he-plst', `is-${variant}`);
  const style = { '--cols': columns } as React.CSSProperties;

  if (pagination === 'none') {
    return (
      <ul className={listClass} style={style}>
        {items}
      </ul>
    );
  }
  return <PostPager items={items} perPage={perPage} mode={pagination} className={listClass} style={style} />;
}

/** V6 — list, minimal, text over the cover, compact and wide layouts, optionally a few at a time. */
function PostLayouts({ p, posts }: { p: P<'postList'>; posts: PostRow[] }) {
  return (
    <Section tone={p.tone ?? 'base'} size="lg">
      <BlockHead eyebrow={p.eyebrow} title={p.title} titleAs={p.titleAs} intro={p.intro} className="mb-9" />
      {posts.length === 0 ? (
        <p className="m-0 text-[16px] text-smoke">Nothing published here yet.</p>
      ) : (
        <PostCollection posts={posts} variant={p.variant as PostListVariant} columns={p.columns} pagination={p.pagination} perPage={p.perPage} />
      )}
      {posts.length > 0 && (
        <Link
          href={site.blogBase}
          className="mt-9 inline-flex font-mono text-[11px] uppercase tracking-[0.12em] text-flare-soft hover:text-flare-hot"
        >
          All writing →
        </Link>
      )}
    </Section>
  );
}
