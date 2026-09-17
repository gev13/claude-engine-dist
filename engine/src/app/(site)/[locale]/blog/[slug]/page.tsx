import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect, redirect } from 'next/navigation';
import { JsonLd } from '@/components/site/JsonLd';
import { Card, CardGrid } from '@/components/ui/Card';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Heading } from '@/components/ui/Heading';
import { Prose } from '@/components/ui/Prose';
import { Section } from '@/components/ui/Section';
import { articleNode, breadcrumbs, graph, webPage } from '@/lib/seo/jsonld';
import { buildMetadata } from '@/lib/seo/metadata';
import { findRedirect, recordNotFound } from '@/server/content/redirects';
import { site } from '@/lib/site';
import { cn, formatDate, isoDate } from '@/lib/utils';
import { resolveBlog } from '@/lib/blog';
import { safeCss } from '@/lib/customCode';
import { ReadingProgress } from '@/components/site/ReadingProgress';
import { getTheme } from '@/server/content/theme';
import { allPublishedPostSlugs, getPost, getPostTranslations, listPosts } from '@/server/content/posts';
import { getSiteSettings } from '@/server/content/siteSettings';

export const revalidate = 300;
export const dynamicParams = true;

type Params = { locale: string; slug: string };

export async function generateStaticParams({ params }: { params: { locale: string } }) {
  const slugs = await allPublishedPostSlugs(params.locale);
  return slugs.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { locale, slug } = await params;
  const post = await getPost(slug, locale);
  if (!post) return { title: "Not found" };
  const [settings, translations] = await Promise.all([
    getSiteSettings(),
    getPostTranslations(post.translationGroupId),
  ]);

  return buildMetadata({
    seo: post.seo,
    title: post.title,
    description: post.excerpt,
    path: `/blog/${post.slug}`,
    locale,
    translations: translations.map((t) => ({ locale: t.locale, path: `/blog/${t.slug}` })),
    type: 'article',
    publishedTime: isoDate(post.publishedAt),
    modifiedTime: isoDate(post.updatedAt),
    authors: post.authorName ? [post.authorName] : undefined,
    imageUrl: post.coverUrl,
    siteName: settings.name,
  });
}

/**
 * What to do when a path has no content: follow a managed redirect if one
 * exists, otherwise log the miss and render the 404.
 */
async function handleMiss(path: string): Promise<never> {
  const target = await findRedirect(path);
  if (target) {
    /* Next emits 307 for `redirect` and 308 for `permanentRedirect` — the
       method-preserving equivalents of 302 and 301. Search engines treat 308
       exactly as they treat 301, so the stored 301/302 is the editor's intent
       and these are the codes that carry it. */
    if (target.status === 301) permanentRedirect(target.to);
    redirect(target.to);
  }

  /* No referrer: reading headers() here would opt this route out of static
     rendering entirely, and losing ISR on every page is a far worse trade than
     losing one field on a 404 log entry. */
  await recordNotFound(path);
  notFound();
}

export default async function PostPage({ params }: { params: Promise<Params> }) {
  const { locale, slug } = await params;
  const post = await getPost(slug, locale);
  if (!post) return handleMiss(`/blog/${slug}`);

  const related = (await listPosts({ kind: post.kind, limit: 4, locale })).filter((p) => p.slug !== post.slug).slice(0, 3);
  const blog = resolveBlog((await getTheme()).blog);
  // A layout built around the cover falls back to the standard one when there is no cover.
  const layout = post.coverUrl ? blog.post : 'standard';
  const onCover = layout === 'fullscreen';

  const eyebrow = (
    <Eyebrow>
      {post.kind === 'research' ? 'Research' : (post.categoryName ?? 'Article')}
      {post.publishedAt ? ` — ${formatDate(post.publishedAt)}` : ''}
    </Eyebrow>
  );
  const title = (
    <Heading level={1} className={cn('max-w-[20ch]', onCover && 'text-white')}>
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
      <span>{post.readingMinutes} min read</span>
      {post.categories.length > 0 && (
        <span className="flex flex-wrap gap-3">
          {post.categories.map((c) => (
            <Link key={c.slug} href={`/blog/category/${c.slug}`} className="hover:text-flare-soft">
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

  const path = `/blog/${post.slug}`;
  const crumbs = breadcrumbs([
    { name: 'Home', path: '/' },
    { name: site.blogLabel, path: '/blog' },
    ...(post.categorySlug && post.categoryName
      ? [{ name: post.categoryName, path: `/blog/category/${post.categorySlug}` }]
      : []),
    { name: post.title, path },
  ]);

  return (
    <>
      {blog.progress && <ReadingProgress targetId="he-article" />}
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

          <Prose html={post.body} className="mt-12 max-w-[72ch]" />
        </Section>
      </article>

      {related.length > 0 && (
        <Section tone="raised" size="lg">
          <Heading level={2} className="mb-8">
            Keep reading
          </Heading>
          <CardGrid cols={3}>
            {related.map((p) => (
              <Card
                key={p.id}
                eyebrow={p.kind === 'research' ? 'Research' : (p.categoryName ?? 'Article')}
                title={p.title}
                href={`/blog/${p.slug}`}
              >
                {p.excerpt}
              </Card>
            ))}
          </CardGrid>
        </Section>
      )}

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
          }),
          crumbs,
        ])}
      />
      {/* This post's own CSS, last so the narrowest scope wins — and last
          rather than first because a <style> is an element, and main's first
          child is what the over-hero header looks for. */}
      {post.customCss && <style id="he-page-css" dangerouslySetInnerHTML={{ __html: safeCss(post.customCss) }} />}
    </>
  );
}
