import Link from '@/components/ui/SiteLink';
import { BlockRenderer } from '@/components/blocks/Renderer';
import { JsonLd } from '@/components/site/JsonLd';
import { ReadingProgress } from '@/components/site/ReadingProgress';
import { Card, CardGrid } from '@/components/ui/Card';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Heading } from '@/components/ui/Heading';
import { Prose } from '@/components/ui/Prose';
import { Section } from '@/components/ui/Section';
import type { AnyBlock } from '@/lib/blocks';
import { resolveBlog } from '@/lib/blog';
import { safeCss } from '@/lib/customCode';
import { countHeadingOnes } from '@/lib/headings';
import type { Locale } from '@/lib/locales';
import { messageReader } from '@/lib/messages';
import { blogIndexPath, categoryPath, type Permalinks } from '@/lib/permalinks';
import { articleNode, breadcrumbs, faqFromBlocks, graph, webPage, type Crumb } from '@/lib/seo/jsonld';
import { site } from '@/lib/site';
import { cn, formatDate, isoDate } from '@/lib/utils';
import { getMessages } from '@/server/content/messages';
import { listPosts, postUrl, type PostDetail } from '@/server/content/posts';
import { getTheme } from '@/server/content/theme';
import { expandSavedBlocks } from '@/server/content/savedBlocks';

/* ═══════════════════════════════════════════════════════════════════════════
   One post, as the public sees it — and as its preview shows it
   ───────────────────────────────────────────────────────────────────────────
   The public post used to render only the body and the preview only the
   blocks, so what an editor checked was not what went live. Both call this
   now (T3, 2.13), and `post.layout` decides what shows:

     body            — the article (every post before 2.13)
     blocks          — the blocks under the post's heading
     bodyThenBlocks  — the article, then the blocks: an FAQ, a gallery, a CTA
     blocksThenBody  — the blocks, then the article: an opening section

   An FAQ in the blocks adds FAQPage to the graph beside the Article, the same
   way it does on a page.
   ═══════════════════════════════════════════════════════════════════════════ */

export async function PostArticle({
  post,
  permalinks,
  locale,
  preview = false,
}: {
  post: PostDetail;
  permalinks: Permalinks;
  locale?: Locale;
  /** The preview shows the post; it leaves out the reading bar, the related list and the structured data. */
  preview?: boolean;
}) {
  const [theme, messages] = await Promise.all([getTheme(), getMessages(locale)]);
  const t = messageReader(messages);
  const blog = resolveBlog(theme.blog);
  const path = postUrl(permalinks, post);
  const indexPath = blogIndexPath(permalinks);

  const related = preview
    ? []
    : (await listPosts({ kind: post.kind, limit: 4, locale, excludeId: post.id })).slice(0, 3);

  // A layout built around the cover falls back to the standard one when there is no cover.
  const layout = post.coverUrl ? blog.post : 'standard';
  const onCover = layout === 'fullscreen';

  const blocks = (post.layout === 'body' ? [] : post.blocks) as AnyBlock[];
  const showBody = post.layout !== 'blocks';
  const blocksFirst = post.layout === 'blocksThenBody';
  // The post's own title stays the page's one h1 — unless an opening block already is.
  const titleLevel = blocksFirst && countHeadingOnes(blocks) > 0 ? 2 : 1;

  const trail: Crumb[] = [
    { name: t('chrome.home'), path: '/' },
    { name: site.blogLabel, path: indexPath },
    ...(post.categorySlug && post.categoryName
      ? [{ name: post.categoryName, path: categoryPath(permalinks, post.categorySlug) }]
      : []),
    { name: post.title, path },
  ];

  const eyebrow = (
    <Eyebrow>
      {post.kind === 'research' ? t('blog.research') : (post.categoryName ?? t('blog.article'))}
      {post.publishedAt ? ` — ${formatDate(post.publishedAt)}` : ''}
    </Eyebrow>
  );
  const title = (
    <Heading level={titleLevel} className={cn('max-w-[20ch]', onCover && 'text-white')}>
      {post.title}
    </Heading>
  );
  const excerpt = post.excerpt && (
    <p className={cn('mt-6 max-w-[62ch] text-[19px]', onCover ? 'text-white/85' : 'text-ash')}>{post.excerpt}</p>
  );
  const meta = (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-6 gap-y-2 border-t-2 border-hairline pt-5 font-mono text-[10px] uppercase tracking-[0.14em] text-smoke',
        !onCover && 'mt-8',
      )}
    >
      {post.authorName && <span>{post.authorName}</span>}
      <span>
        {post.readingMinutes}
        {` ${t('blog.minRead')}`}
      </span>
      {post.categories.length > 0 && (
        <span className="flex flex-wrap gap-3">
          {post.categories.map((c) => (
            <Link key={c.slug} href={categoryPath(permalinks, c.slug)} className="hover:text-flare-soft">
              {c.name}
            </Link>
          ))}
        </span>
      )}
    </div>
  );
  const cover = post.coverUrl && (
    <div className="he-post__cover">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={post.coverUrl} alt="" />
    </div>
  );
  const postBlocks = blocks.length > 0 && <BlockRenderer blocks={blocks} trail={trail} locale={locale} />;

  const crumbs = breadcrumbs(trail);

  return (
    <>
      {blog.progress && !preview && <ReadingProgress targetId="he-article" />}
      {blocksFirst && postBlocks}
      <article id="he-article" className="he-post">
        {layout === 'fullscreen' && (
          // BL2 — the title over a full-width cover; it is main's first child, so an overlay header lies over it.
          <header className="he-post-hero he-bleed-top">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={post.coverUrl!} alt="" className="he-post-hero__img" />
            <div className="shell he-post-hero__text">
              {eyebrow}
              {title}
              {excerpt}
            </div>
          </header>
        )}
        <Section size="lg">
          {layout === 'split' ? (
            <div className="he-post-split">
              <div>
                {eyebrow}
                {title}
                {excerpt}
                {meta}
              </div>
              {cover}
            </div>
          ) : layout === 'fullscreen' ? (
            meta
          ) : (
            <>
              {eyebrow}
              {title}
              {excerpt}
              {meta}
              {layout === 'cover' && cover}
            </>
          )}

          {showBody && <Prose html={post.body} className="mt-12 max-w-[72ch]" />}
        </Section>
        {!blocksFirst && postBlocks}
      </article>

      {related.length > 0 && (
        <Section tone="raised" size="lg">
          <Heading level={2} className="mb-8">
            {t('blog.keepReading')}
          </Heading>
          <CardGrid cols={3}>
            {related.map((p) => (
              <Card
                key={p.id}
                eyebrow={p.kind === 'research' ? t('blog.research') : (p.categoryName ?? t('blog.article'))}
                title={p.title}
                href={postUrl(permalinks, p)}
              >
                {p.excerpt}
              </Card>
            ))}
          </CardGrid>
        </Section>
      )}

      {!preview && (
        <JsonLd
          data={graph([
            webPage({
              path,
              name: post.title,
              description: post.excerpt,
              modified: isoDate(post.updatedAt),
              breadcrumbId: crumbs['@id'] as string,
            }),
            articleNode({
              path,
              headline: post.title,
              description: post.excerpt,
              published: isoDate(post.publishedAt),
              modified: isoDate(post.updatedAt),
              author: post.authorName,
              section: post.categoryName,
              imageUrl: post.coverUrl,
              wordCount: post.body.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length,
              blogPath: indexPath,
            }),
            crumbs,
            faqFromBlocks(await expandSavedBlocks(blocks, locale), path),
          ])}
        />
      )}
      {/* This post's own CSS, last so the narrowest scope wins — and last
          rather than first because a <style> is an element, and main's first
          child is what the over-hero header looks for. */}
      {post.customCss && <style id="he-page-css" dangerouslySetInnerHTML={{ __html: safeCss(post.customCss) }} />}
    </>
  );
}
