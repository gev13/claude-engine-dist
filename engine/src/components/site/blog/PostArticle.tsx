import Link from '@/components/ui/SiteLink';
import { BlockRenderer } from '@/components/blocks/Renderer';
import { JsonLd } from '@/components/site/JsonLd';
import { ReadingProgress } from '@/components/site/ReadingProgress';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Heading } from '@/components/ui/Heading';
import { Prose } from '@/components/ui/Prose';
import { Section } from '@/components/ui/Section';
import type { AnyBlock } from '@/lib/blocks';
import { fillEyebrow, resolveBlog, type ResolvedBlog } from '@/lib/blog';
import { safeCss } from '@/lib/customCode';
import { countHeadingOnes } from '@/lib/headings';
import type { Locale } from '@/lib/locales';
import { messageReader } from '@/lib/messages';
import { blogIndexPath, categoryPath, type Permalinks } from '@/lib/permalinks';
import { articleNode, breadcrumbs, customNodes, faqFromBlocks, graph, webPage, type Crumb } from '@/lib/seo/jsonld';
import { site } from '@/lib/site';
import { cn, formatDate, isoDate } from '@/lib/utils';
import { getMessages } from '@/server/content/messages';
import { adjacentPosts, listPosts, postUrl, type PostDetail, type PostListItem } from '@/server/content/posts';
import { AuthorBox, BackLink, PostShare, PostToc, PrevNext, RelatedPosts } from './PostExtras';
import { getTheme } from '@/server/content/theme';
import { expandSavedBlocks } from '@/server/content/savedBlocks';
import { SiteImg } from '@/components/ui/SiteImg';
import { PageAppearanceStyle } from '@/components/site/PageAppearanceStyle';

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

/**
 * "Keep reading" (2.18): posts of the same kind (as always), from the
 * post's primary category, or from any category it shares — topped up from
 * the same kind when a category has too few.
 */
async function relatedPosts(blog: ResolvedBlog, post: PostDetail, locale?: Locale): Promise<PostListItem[]> {
  const { source, count } = blog.related;
  if (source === 'off') return [];
  const sameKind = () => listPosts({ kind: post.kind, limit: count + 1, locale, excludeId: post.id });
  if (source === 'kind') return (await sameKind()).slice(0, count);
  const matched =
    source === 'primary'
      ? post.categorySlug
        ? await listPosts({ categorySlug: post.categorySlug, limit: count, locale, excludeId: post.id })
        : []
      : await listPosts({ categorySlugs: post.categories.map((c) => c.slug), limit: count, locale, excludeId: post.id });
  if (matched.length >= count) return matched.slice(0, count);
  const seen = new Set(matched.map((p) => p.id));
  return [...matched, ...(await sameKind()).filter((p) => !seen.has(p.id))].slice(0, count);
}

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

  const related = preview ? [] : await relatedPosts(blog, post, locale);
  // 2.18 — the neighbours, only when they are shown.
  const adjacent = !preview && blog.prevNext !== 'off' ? await adjacentPosts(post, locale) : { previous: null, next: null };

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

  const categoryLabel = post.kind === 'research' ? t('blog.research') : (post.categoryName ?? t('blog.article'));
  const eyebrow = blog.eyebrow ? (
    // 2.18 — the site's own line: "{category} · {minutes} min read".
    <Eyebrow>
      {fillEyebrow(blog.eyebrow, {
        category: categoryLabel,
        date: post.publishedAt ? formatDate(post.publishedAt) : '',
        minutes: post.readingMinutes,
        minRead: t('blog.minRead'),
      })}
    </Eyebrow>
  ) : (
    <Eyebrow>
      {categoryLabel}
      {post.publishedAt ? ` — ${formatDate(post.publishedAt)}` : ''}
    </Eyebrow>
  );
  const back = blog.backLink && <BackLink href={indexPath} t={t} />;
  const tocSide = !preview && (blog.toc.position === 'left' || blog.toc.position === 'right');
  const tocTop = !preview && blog.toc.position === 'top';
  const body = showBody && (
    tocSide ? (
      <div className={cn('he-post__body', `has-toc-${blog.toc.position}`)}>
        <PostToc blog={blog} t={t} />
        <Prose html={post.body} className="mt-12 max-w-[72ch]" />
      </div>
    ) : (
      <>
        {tocTop && <PostToc blog={blog} t={t} />}
        <Prose html={post.body} className="mt-12 max-w-[72ch]" />
      </>
    )
  );
  const shareTop = !preview && blog.share.position === 'top' && <PostShare blog={blog} t={t} />;
  const shareBottom = !preview && blog.share.position === 'bottom' && <PostShare blog={blog} t={t} />;
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
      <SiteImg src={post.coverUrl} alt="" sizes="wide" priority />
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
            <SiteImg src={post.coverUrl!} alt="" className="he-post-hero__img" priority />
            <div className="shell he-post-hero__text">
              {back}
              {eyebrow}
              {title}
              {excerpt}
            </div>
          </header>
        )}
        {layout === 'coverThenTitle' && (
          // 2.18 — the cover at its own shape, full width; the title follows in a card.
          <div className="he-post-ctt he-bleed-top">
            <SiteImg src={post.coverUrl!} alt="" className="he-post-ctt__img" priority />
          </div>
        )}
        <Section size="lg">
          {layout === 'split' ? (
            <div className="he-post-split">
              <div>
                {back}
                {eyebrow}
                {title}
                {excerpt}
                {meta}
              </div>
              {cover}
            </div>
          ) : layout === 'fullscreen' ? (
            meta
          ) : layout === 'coverThenTitle' ? (
            <div className="he-post-ctt__card">
              {back}
              {eyebrow}
              {title}
              {excerpt}
              {meta}
            </div>
          ) : (
            <>
              {back}
              {eyebrow}
              {title}
              {excerpt}
              {meta}
              {layout === 'cover' && cover}
            </>
          )}

          {shareTop}
          {body}
          {shareBottom}
        </Section>
        {!blocksFirst && postBlocks}
      </article>

      {!preview && blog.share.position === 'side' && <PostShare blog={blog} t={t} side />}
      {!preview && blog.authorBox && <AuthorBox post={post} t={t} />}
      {!preview && blog.prevNext !== 'off' && <PrevNext blog={blog} previous={adjacent.previous} next={adjacent.next} permalinks={permalinks} t={t} />}
      <RelatedPosts blog={blog} posts={related} permalinks={permalinks} t={t} />

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
            ...customNodes((post.seo as { jsonLd?: unknown } | null)?.jsonLd),
          ])}
        />
      )}
      {/* This post's own CSS, last so the narrowest scope wins — and last
          rather than first because a <style> is an element, and main's first
          child is what the over-hero header looks for. */}
      {post.customCss && <style id="he-page-css" dangerouslySetInnerHTML={{ __html: safeCss(post.customCss) }} />}
      <PageAppearanceStyle appearance={post.appearance} />
    </>
  );
}
