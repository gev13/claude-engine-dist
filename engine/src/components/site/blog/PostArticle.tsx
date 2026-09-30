import Link from '@/components/ui/SiteLink';
import { BlockRenderer } from '@/components/blocks/Renderer';
import { JsonLd } from '@/components/site/JsonLd';
import { ReadingProgress } from '@/components/site/ReadingProgress';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Heading } from '@/components/ui/Heading';
import { Prose } from '@/components/ui/Prose';
import { Section } from '@/components/ui/Section';
import type { AnyBlock } from '@/lib/blocks';
import { eyebrowAroundCategory, fillEyebrow, resolveBlog, type ResolvedBlog } from '@/lib/blog';
import { safeCss } from '@/lib/customCode';
import { countHeadingOnes } from '@/lib/headings';
import type { Locale } from '@/lib/locales';
import { messageReader } from '@/lib/messages';
import { absoluteWithSlash, blogIndexPath, categoryPath, type Permalinks } from '@/lib/permalinks';
import { SITE_URL } from '@/lib/env';
import { parsePageSchema } from '@/lib/structuredData';
import { getSiteSchema } from '@/server/content/structuredData';
import { articleNode, breadcrumbs, customNodes, faqFromBlocks, graph, webPage, type Crumb } from '@/lib/seo/jsonld';
import { site } from '@/lib/site';
import { cn, formatDate, isoDate } from '@/lib/utils';
import { getMessages } from '@/server/content/messages';
import { adjacentPosts, listPosts, postUrl, type PostDetail, type PostListItem } from '@/server/content/posts';
import { AuthorBox, BackLink, PostShare, PostToc, PrevNext, RelatedPosts } from './PostExtras';
import { getTheme } from '@/server/content/theme';
import { expandSavedBlocks } from '@/server/content/savedBlocks';
import { SiteImg } from '@/components/ui/SiteImg';
import { withBodyImages } from '@/server/content/bodyImages';
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
  // 3.22 — the text's pictures with their sizes (and a srcset when responsive images are on).
  const bodyHtml = showBody ? await withBodyImages(post.body) : '';
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
  const eyebrowValues = { date: post.publishedAt ? formatDate(post.publishedAt) : '', minutes: post.readingMinutes, minRead: t('blog.minRead') };
  const eyebrowLine = blog.eyebrow
    ? fillEyebrow(blog.eyebrow, { ...eyebrowValues, category: categoryLabel })
    : `${categoryLabel}${post.publishedAt ? ` — ${formatDate(post.publishedAt)}` : ''}`;
  // 3.22 — the category as a chip linking to its archive, the rest of the line beside it.
  const around = blog.eyebrowStyle === 'chip' ? eyebrowAroundCategory(blog.eyebrow, eyebrowValues) : null;
  const categoryHref = post.categorySlug ? categoryPath(permalinks, post.categorySlug) : null;
  const eyebrow = around ? (
    <div className="he-post__eyebrow is-chip type-eyebrow">
      {around.before && <span>{around.before}</span>}
      {categoryHref ? (
        <Link href={categoryHref} className="he-chip he-post__chip">
          {categoryLabel}
        </Link>
      ) : (
        <span className="he-chip he-post__chip">{categoryLabel}</span>
      )}
      {around.after && <span>{around.after}</span>}
    </div>
  ) : blog.eyebrowStyle === 'plain' || blog.eyebrowStyle === 'chip' ? (
    // 3.22 — the line alone, without the rule before it.
    <p className="he-post__eyebrow is-plain type-eyebrow">{eyebrowLine}</p>
  ) : blog.eyebrow ? (
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
  // 3.22 — the share buttons in a column of their own beside the article, following the reader.
  const shareBeside = !preview && blog.share.position === 'beside' && showBody;
  const body = showBody && (
    tocSide || shareBeside ? (
      <>
        {tocTop && <PostToc blog={blog} t={t} />}
        <div className={cn('he-post__body', tocSide && `has-toc-${blog.toc.position}`, shareBeside && 'has-share-beside')}>
          {shareBeside && <PostShare blog={blog} t={t} beside />}
          {tocSide && <PostToc blog={blog} t={t} />}
          <Prose html={bodyHtml} className="mt-12 max-w-[72ch]" />
        </div>
      </>
    ) : (
      <>
        {tocTop && <PostToc blog={blog} t={t} />}
        <Prose html={bodyHtml} className="mt-12 max-w-[72ch]" />
      </>
    )
  );
  const shareTop = !preview && (blog.share.position === 'top' || (blog.share.position === 'beside' && !showBody)) && <PostShare blog={blog} t={t} />;
  const shareBottom = !preview && blog.share.position === 'bottom' && <PostShare blog={blog} t={t} />;
  const title = (
    <Heading level={titleLevel} className={cn('max-w-[20ch]', onCover && 'text-white')}>
      {post.title}
    </Heading>
  );
  const excerpt = blog.excerpt && post.excerpt && (
    <p className={cn('mt-6 max-w-[62ch] text-[19px]', onCover ? 'text-white/85' : 'text-ash')}>{post.excerpt}</p>
  );
  // 3.22 — the row under the title, or any of its parts, can be left out.
  const metaParts = blog.meta.show && ((blog.meta.author && post.authorName) || blog.meta.readingTime || (blog.meta.categories && post.categories.length > 0));
  const meta = metaParts && (
    <div
      className={cn(
        'he-post__meta flex flex-wrap items-center gap-x-6 gap-y-2 border-t-2 border-hairline pt-5 text-[length:var(--he-label-size,10px)] tracking-[var(--he-label-tracking,0.14em)] text-[color:var(--he-label-color,var(--color-smoke))] he-lbl',
        !onCover && 'mt-8',
      )}
    >
      {blog.meta.author && post.authorName && <span>{post.authorName}</span>}
      {blog.meta.readingTime && (
        <span>
          {post.readingMinutes}
          {` ${t('blog.minRead')}`}
        </span>
      )}
      {blog.meta.categories && post.categories.length > 0 && (
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
  // 3.20 — the post's Schema panel, and the site's default article type.
  const postSchema = parsePageSchema((post.seo as { schema?: unknown } | null)?.schema);
  const siteSchema = await getSiteSchema(locale);

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
            <div
              className="he-post-ctt__card"
              // 3.22 — how far the card rides up over the cover; 0 starts it right under.
              style={blog.coverOverlap ? ({ '--he-ctt-gap': blog.coverOverlap === '0' ? '0px' : blog.coverOverlap } as React.CSSProperties) : undefined}
            >
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
      {!preview && blog.prevNext !== 'off' && <PrevNext blog={blog} previous={adjacent.previous} next={adjacent.next} permalinks={permalinks} t={t} postId={post.id} />}
      <RelatedPosts blog={blog} posts={related} permalinks={permalinks} t={t} />

      {!preview && (
        <JsonLd
          data={graph([
            webPage({
              path,
              name: post.title,
              description: post.excerpt,
              modified: isoDate(post.updatedAt),
              published: isoDate(post.publishedAt),
              breadcrumbId: postSchema.breadcrumbs === false ? undefined : (crumbs['@id'] as string),
              type: postSchema.pageType,
              inLanguage: locale,
              imageUrl: post.coverUrl ?? undefined,
              mainEntityId: `${absoluteWithSlash(SITE_URL, path)}#article`,
            }),
            articleNode({
              path,
              headline: post.title,
              description: post.excerpt,
              published: isoDate(post.publishedAt),
              modified: isoDate(post.updatedAt),
              // 3.20 — the Schema panel's byline wins over the account's name.
              author: postSchema.authorName || post.authorName,
              authorUrl: postSchema.authorUrl,
              type: postSchema.articleType ?? siteSchema.articleType,
              inLanguage: locale,
              section: post.categoryName,
              imageUrl: post.coverUrl,
              wordCount: post.body.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length,
              blogPath: indexPath,
            }),
            postSchema.breadcrumbs === false ? null : crumbs,
            postSchema.faq === false ? null : faqFromBlocks(await expandSavedBlocks(blocks, locale), path, { speakable: siteSchema.speakable !== false }),
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
