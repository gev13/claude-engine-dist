import Link from '@/components/ui/SiteLink';
import { Carousel } from '@/components/blocks/library/Carousel';
import { ShareBlock, TocBlock } from '@/components/blocks/library/widgets-client';
import { SocialIcon } from '@/components/site/icons';
import { Card, CardGrid } from '@/components/ui/Card';
import { Heading } from '@/components/ui/Heading';
import { Section } from '@/components/ui/Section';
import { SiteImg } from '@/components/ui/SiteImg';
import { blockSchemas } from '@/lib/blocks';
import type { ResolvedBlog } from '@/lib/blog';
import type { messageReader } from '@/lib/messages';
import { SOCIAL_LABELS, SOCIAL_NETWORKS, type SocialNetwork } from '@/lib/navigation';
import type { Permalinks } from '@/lib/permalinks';
import { postUrl, type PostDetail, type PostListItem } from '@/server/content/posts';
import { FloatingNext } from './FloatingNext';

/* ═══════════════════════════════════════════════════════════════════════════
   What a post can have besides its article (T19, 2.18)
   ───────────────────────────────────────────────────────────────────────────
   Each is a setting in Appearance → Blog and off — or as it always was —
   until chosen. The share buttons and the contents list are the Share and
   Table of contents blocks, so they behave exactly as those do everywhere
   else: nothing is sent to a network before a click; the contents list
   builds itself from the article's headings and follows the reader.
   ═══════════════════════════════════════════════════════════════════════════ */

type T = ReturnType<typeof messageReader>;

/** Share buttons: in the article's flow, or pinned down the left side on wide screens. */
export function PostShare({ blog, t, side = false }: { blog: ResolvedBlog; t: T; side?: boolean }) {
  const props = blockSchemas.share.safeParse({
    title: side ? '' : t('blog.share'),
    networks: blog.share.networks,
    style: 'icons',
    size: 'small',
    align: 'left',
    position: side ? 'floatingLeft' : 'inline',
  });
  if (!props.success) return null;
  return (
    <div className={side ? 'he-post__share is-side' : 'he-post__share'}>
      <ShareBlock {...props.data} />
    </div>
  );
}

/** The post's own headings, with the one being read marked. */
export function PostToc({ blog, t }: { blog: ResolvedBlog; t: T }) {
  const side = blog.toc.position === 'left' || blog.toc.position === 'right';
  const props = blockSchemas.toc.safeParse({
    title: blog.toc.title || t('blog.onThisPage'),
    levels: blog.toc.levels,
    scope: 'article',
    style: 'list',
    sticky: side,
    // On a phone the side column sits above the article, folded.
    collapsible: true,
    highlight: true,
  });
  if (!props.success) return null;
  return (
    <aside className={`he-post__toc is-${blog.toc.position}`}>
      <TocBlock {...props.data} />
    </aside>
  );
}

/** "← Back to the blog", above the title. */
export function BackLink({ href, t }: { href: string; t: T }) {
  return (
    <p className="he-post__back">
      <Link href={href}>
        <span aria-hidden="true">←</span> {t('blog.backToBlog')}
      </Link>
    </p>
  );
}

/** The posts either side: two cards under the article, or a card in the corner. */
export function PrevNext({
  blog,
  previous,
  next,
  permalinks,
  t,
}: {
  blog: ResolvedBlog;
  previous: PostListItem | null;
  next: PostListItem | null;
  permalinks: Permalinks;
  t: T;
}) {
  if (!previous && !next) return null;
  if (blog.prevNext === 'floating') {
    return (
      <FloatingNext
        next={next ? { title: next.title, href: postUrl(permalinks, next) } : null}
        previous={previous ? { title: previous.title, href: postUrl(permalinks, previous) } : null}
        labels={{ upNext: t('blog.upNext'), previous: t('blog.previous'), next: t('blog.next'), dismiss: t('blog.dismiss') }}
      />
    );
  }
  return (
    <Section size="sm">
      <nav className="he-postnav" aria-label={`${t('blog.previous')} / ${t('blog.next')}`}>
        {previous ? (
          <Link href={postUrl(permalinks, previous)} className="he-postnav__a is-prev" rel="prev">
            <span className="he-postnav__dir">← {t('blog.previous')}</span>
            <span className="he-postnav__title">{previous.title}</span>
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link href={postUrl(permalinks, next)} className="he-postnav__a is-next" rel="next">
            <span className="he-postnav__dir">{t('blog.next')} →</span>
            <span className="he-postnav__title">{next.title}</span>
          </Link>
        )}
      </nav>
    </Section>
  );
}

/** "Keep reading": a grid of cards as always, or the carousel. */
export function RelatedPosts({ blog, posts, permalinks, t }: { blog: ResolvedBlog; posts: PostListItem[]; permalinks: Permalinks; t: T }) {
  if (posts.length === 0) return null;
  const title = blog.related.title || t('blog.keepReading');
  const eyebrow = (p: PostListItem) => (p.kind === 'research' ? t('blog.research') : (p.categoryName ?? t('blog.article')));

  if (blog.related.layout === 'carousel') {
    const slides = blockSchemas.carousel.safeParse({
      mode: 'cards',
      title,
      titleAs: 'h2',
      slides: posts.map((p) => ({ title: p.title, body: p.excerpt || undefined, eyebrow: eyebrow(p), imageUrl: p.coverUrl ?? undefined, href: postUrl(permalinks, p), buttonLabel: t('blog.readMore') })),
    });
    if (slides.success) return <Carousel {...slides.data} />;
  }

  return (
    <Section tone="raised" size="lg">
      <Heading level={2} className="mb-8">
        {title}
      </Heading>
      <CardGrid cols={3}>
        {posts.map((p) => (
          <Card key={p.id} eyebrow={eyebrow(p)} title={p.title} href={postUrl(permalinks, p)}>
            {p.excerpt}
          </Card>
        ))}
      </CardGrid>
    </Section>
  );
}

/** The author's picture, name, bio and links (Profile → As an author). */
export function AuthorBox({ post, t }: { post: PostDetail; t: T }) {
  const author = post.author;
  if (!post.authorName || !author || (!author.bio && !author.avatarUrl && author.links.length === 0)) return null;
  const links = author.links.filter((link): link is { network: SocialNetwork; href: string } => (SOCIAL_NETWORKS as readonly string[]).includes(link.network));
  return (
    <Section size="sm">
      <aside className="he-author" aria-label={t('blog.aboutAuthor')}>
        {author.avatarUrl && <SiteImg src={author.avatarUrl} alt="" className="he-author__img" loading="lazy" sizes="thumb" />}
        <div>
          <p className="he-author__label label-mono">{t('blog.aboutAuthor')}</p>
          <p className="he-author__name">{post.authorName}</p>
          {author.bio && <p className="he-author__bio">{author.bio}</p>}
          {links.length > 0 && (
            <ul className="he-author__links">
              {links.map((link) => (
                <li key={link.network + link.href}>
                  <a href={link.href} target="_blank" rel="noopener noreferrer" aria-label={SOCIAL_LABELS[link.network]}>
                    <SocialIcon network={link.network} size={16} />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </Section>
  );
}
