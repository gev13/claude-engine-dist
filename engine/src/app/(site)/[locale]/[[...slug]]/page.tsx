import { permanentRedirect } from 'next/navigation';
import type { Metadata } from 'next';
import { BlockRenderer } from '@/components/blocks/Renderer';
import { ArchiveView, BlogIndexView, PagingLinks } from '@/components/site/blog/BlogViews';
import { PostArticle } from '@/components/site/blog/PostArticle';
import { ProjectArchiveView, ProjectArticle } from '@/components/site/projects/ProjectViews';
import { allPublishedProjects, getProjectTranslations, termsWithProjects } from '@/server/content/projects';
import { getProjectTemplate } from '@/server/content/projectTemplate';
import { safeCss } from '@/lib/customCode';
import { handleMiss } from '@/server/content/miss';
import { JsonLd } from '@/components/site/JsonLd';
import { buildMetadata, homeSlashUrl } from '@/lib/seo/metadata';
import { heroImage } from '@/lib/seo/heroImage';
import { shareImage } from '@/server/seo/shareImage';
import {
  breadcrumbs,
  customNodes,
  faqFromBlocks,
  graph,
  itemList,
  serviceNode,
  webPage,
} from '@/lib/seo/jsonld';
import { site } from '@/lib/site';
import { messageReader } from '@/lib/messages';
import {
  blogIndexPath,
  categoryPath,
  pagedPath,
  postPath,
  projectPath,
  projectTermPath,
  researchPath,
  withSlash,
} from '@/lib/permalinks';
import { getServiceByPage, getServices } from '@/server/content/services';
import { allPublishedPagePaths, getTranslations } from '@/server/content/pages';
import { allPublishedPostSlugs, getPostTranslations } from '@/server/content/posts';
import { getCategoryTranslations, listCategories } from '@/server/content/categories';
import { resolvePath, type Paging } from '@/server/content/resolve';
import { getMessages } from '@/server/content/messages';
import { getPermalinks } from '@/server/routing/config';
import { expandSavedBlocks } from '@/server/content/savedBlocks';
import { localeConfig } from '@/lib/locales';
import { getSiteSettings } from '@/server/content/siteSettings';
import { getSiteSchema } from '@/server/content/structuredData';
import { parsePageSchema, resolveService } from '@/lib/structuredData';
import { pageTrail } from '@/server/content/trail';
import { isoDate } from '@/lib/utils';
import type { SeoFields } from '@/server/db/schema';
import { resolveBlog } from '@/lib/blog';
import { getTheme } from '@/server/content/theme';
import { PageAppearanceStyle } from '@/components/site/PageAppearanceStyle';

/**
 * One catch-all route renders every public address the CMS owns: pages, the
 * blog index, categories, research, posts, and `/page/N` of any of them.
 * Where the blog lives is a setting (Settings → Permalinks, 2.13), so the
 * decision of what a path *is* belongs to `resolvePath`, not to folder names.
 *
 * ISR: revalidated on a timer and on demand from the admin panel
 * (revalidatePath on publish), so an edit is live within seconds without a
 * rebuild.
 */
export const revalidate = 300;
export const dynamicParams = true;

/** `locale` comes from the segment above; the layout enumerates the locales. */
type Params = { locale: string; slug?: string[] };

function pathFromParams(slug?: string[]) {
  if (!slug || slug.length === 0) return '/';
  return `/${slug.join('/')}`;
}

const toParams = (path: string) => ({ slug: path === '/' ? [] : path.replace(/^\//, '').split('/') });

/**
 * Only this segment's own params: the locale is enumerated by the layout, and
 * Next calls this once per locale with that locale in `params`. So each
 * language prerenders exactly the paths it actually has — a page written only
 * in English is not built as an empty Armenian one. Posts and categories are
 * listed at their permalinks.
 */
export async function generateStaticParams({
  params,
}: {
  params: { locale: string };
}): Promise<{ slug?: string[] }[]> {
  const config = localeConfig();
  const locale = config.locales.includes(params.locale) ? params.locale : config.defaultLocale;
  const [pages, posts, categories, permalinks, projects, terms] = await Promise.all([
    allPublishedPagePaths(locale),
    allPublishedPostSlugs(locale),
    listCategories(locale),
    getPermalinks(),
    allPublishedProjects(),
    termsWithProjects(),
  ]);
  const paths = new Set<string>([
    ...pages.map((p) => p.path),
    blogIndexPath(permalinks),
    researchPath(permalinks),
    ...categories.map((c) => categoryPath(permalinks, c.slug)),
    ...posts.map((p) => postPath(permalinks, p)),
    ...projects.filter((p) => p.locale === locale).map((p) => projectPath(permalinks, p.slug)),
    ...terms.filter((t) => t.locale === locale).map((t) => projectTermPath(permalinks, t.taxonomy, t.slug)),
  ]);
  return [...paths].map(toParams);
}

async function localeOf(raw: string) {
  const config = localeConfig();
  return config.locales.includes(raw) ? raw : config.defaultLocale;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { locale: raw, slug } = await params;
  const locale = await localeOf(raw);
  const path = pathFromParams(slug);
  const resolved = await resolvePath(path, locale);
  if (!resolved || resolved.kind === 'redirect') return { title: 'Page not found' };

  const [settings, permalinks, messages] = await Promise.all([getSiteSettings(), getPermalinks(), getMessages(locale)]);
  const t = messageReader(messages);
  /** "— Page 2" on every page but the first, so ten archive pages are not ten identical titles. */
  const paged = (title: string, paging?: Paging) =>
    paging && paging.number > 1 ? `${title} — ${t('archive.page', { n: paging.number })}` : title;
  const own = (paging: Paging | undefined, base: string) => (paging ? pagedPath(paging.base, paging.number, permalinks) : base);
  /** The share picture (2.18): the page's own choice, then `fallback`, then the site's default. */
  const image = (seo: SeoFields | undefined | null, fallback?: string | null) =>
    shareImage({ ogImageId: seo?.ogImageId, fallbackUrl: fallback, siteDefault: settings.ogImageUrl || undefined });

  switch (resolved.kind) {
    case 'project': {
      const { project } = resolved;
      const translations = await getProjectTranslations(project.translationGroupId);
      return buildMetadata({
        seo: project.seo,
        title: project.title,
        description: project.excerpt || project.summary,
        path: projectPath(permalinks, project.slug),
        locale,
        translations: translations.map((tr) => ({ locale: tr.locale, path: projectPath(permalinks, tr.slug) })),
        type: 'article',
        publishedTime: isoDate(project.publishedAt),
        modifiedTime: isoDate(project.updatedAt),
        image: await image(project.seo, project.coverUrl),
        siteName: settings.name,
      });
    }
    case 'projectTerm': {
      const { term, paging } = resolved;
      return buildMetadata({
        seo: paging.number > 1 ? undefined : term.seo,
        title: paged(term.name, paging),
        description: term.description || settings.description,
        path: own(paging, projectTermPath(permalinks, term.taxonomy, term.slug)),
        locale,
        image: await image(term.seo),
        siteName: settings.name,
      });
    }
    case 'post': {
      const { post } = resolved;
      const translations = await getPostTranslations(post.translationGroupId);
      return buildMetadata({
        seo: post.seo as SeoFields,
        title: post.title,
        description: post.excerpt,
        path: postPath(permalinks, post),
        locale,
        translations: translations.map((tr) => ({ locale: tr.locale, path: postPath(permalinks, tr) })),
        type: 'article',
        publishedTime: isoDate(post.publishedAt),
        modifiedTime: isoDate(post.updatedAt),
        authors: post.authorName ? [post.authorName] : undefined,
        section: post.categoryName ?? undefined,
        image: await image(post.seo as SeoFields, post.coverUrl),
        siteName: settings.name,
      });
    }
    case 'category': {
      const { category, paging } = resolved;
      const translations = await getCategoryTranslations(category.translationGroupId);
      return buildMetadata({
        seo: paging.number > 1 ? undefined : (category.seo as SeoFields),
        title: paged(`${category.name} — ${site.blogLabel}`, paging),
        description: category.description || t('blog.categoryIntro', { site: settings.name, category: category.name }),
        path: own(paging, categoryPath(permalinks, category.slug)),
        locale,
        translations: translations.map((tr) => ({ locale: tr.locale, path: categoryPath(permalinks, tr.slug) })),
        image: await image(category.seo as SeoFields),
        siteName: settings.name,
      });
    }
    case 'research':
      return buildMetadata({
        title: paged(t('blog.research'), resolved.paging),
        description: t('blog.researchIntro'),
        path: own(resolved.paging, researchPath(permalinks)),
        image: await image(undefined),
        siteName: settings.name,
      });
    case 'blogIndex': {
      const { page, paging } = resolved;
      // 3.23 — with no page at the blog's address, Appearance → Blog's own search title and description.
      const indexSeo = page ? undefined : resolveBlog((await getTheme()).blog).indexSeo;
      const ownSeo = indexSeo?.title || indexSeo?.description ? ({ title: indexSeo.title, description: indexSeo.description, exactTitle: indexSeo.exactTitle } as SeoFields) : undefined;
      return buildMetadata({
        seo: paging.number > 1 ? (ownSeo ? { exactTitle: ownSeo.exactTitle } : undefined) : (page?.seo ?? ownSeo),
        title: paged(page?.title ?? indexSeo?.title ?? site.blogLabel, paging),
        description: page?.excerpt || indexSeo?.description || t('blog.indexIntro', { site: settings.name }),
        path: own(paging, blogIndexPath(permalinks)),
        image: await image(page?.seo, page ? heroImage(page.blocks) : undefined),
        siteName: settings.name,
      });
    }
    case 'page': {
      const { page, paging } = resolved;
      const translations = await getTranslations(page.translationGroupId);
      return buildMetadata({
        seo: paging && paging.number > 1 ? { ...page.seo, canonicalUrl: undefined, title: undefined } : page.seo,
        title: paged(page.seo.title?.trim() || page.title, paging),
        description: page.excerpt || settings.description,
        path: own(paging, path),
        locale,
        translations,
        image: await image(page.seo, heroImage(page.blocks)),
        siteName: settings.name,
        /* Library pages are a reference for whoever builds the site, not content
           for search engines, whatever the page's own robots field says — and
           the page chosen as the 404 is not a page anybody should land on. */
        noindex: page.template === 'library' || page.id === settings.notFoundPageId,
      });
    }
  }
}


export default async function CmsPage({ params }: { params: Promise<Params> }) {
  const { locale: raw, slug } = await params;
  const locale = await localeOf(raw);
  const path = pathFromParams(slug);
  const resolved = await resolvePath(path, locale);
  if (!resolved) return handleMiss(path);

  const permalinks = await getPermalinks();

  switch (resolved.kind) {
    case 'redirect':
      return permanentRedirect(withSlash(resolved.to));
    case 'post':
      return <PostArticle post={resolved.post} permalinks={permalinks} locale={locale} />;
    case 'project':
      return (
        <ProjectArticle
          project={resolved.project}
          template={await getProjectTemplate(locale)}
          permalinks={permalinks}
          locale={locale}
        />
      );
    case 'projectTerm':
      return (
        <ProjectArchiveView
          term={resolved.term}
          paging={resolved.paging}
          template={await getProjectTemplate(locale)}
          permalinks={permalinks}
          locale={locale}
        />
      );
    case 'blogIndex':
      return (
        <BlogIndexView
          page={resolved.page}
          paging={resolved.paging}
          list={resolved.list}
          locale={locale}
          permalinks={permalinks}
        />
      );
    case 'research':
      return <ArchiveView kind="research" paging={resolved.paging} locale={locale} permalinks={permalinks} />;
    case 'category':
      return (
        <ArchiveView
          kind="category"
          category={resolved.category}
          paging={resolved.paging}
          locale={locale}
          permalinks={permalinks}
        />
      );
    case 'page':
      break;
  }

  const { page, paging, list } = resolved;
  const trail = await pageTrail(path, page.title);
  const crumbs = breadcrumbs(trail);
  const modified = isoDate(page.updatedAt);

  /* 3.20 — the page's Schema panel over the site's Structured data. Every
     choice left unset resolves to what the engine emitted before. */
  const [pageSettings, siteSchema, catalogue, expanded] = await Promise.all([
    getSiteSettings(),
    getSiteSchema(locale),
    getServices(),
    expandSavedBlocks(page.blocks, locale),
  ]);
  const own = parsePageSchema(page.seo.schema);
  const speakable = siteSchema.speakable !== false;
  const shared = await shareImage({ ogImageId: page.seo.ogImageId, fallbackUrl: heroImage(page.blocks), siteDefault: pageSettings.ogImageUrl || undefined });
  const pagePath = paging ? pagedPath(paging.base, paging.number, permalinks) : path;

  // Service pages describe a Service + Offer; the services index is an ItemList.
  const svc = page.template === 'service' && own.service?.enabled !== false ? await getServiceByPage(page.id) : null;
  const service = svc
    ? serviceNode({
        slug: svc.slug,
        path: svc.path,
        name: svc.title,
        description: page.excerpt || svc.blurb,
        details: resolveService(own.service, siteSchema.serviceDefaults),
        imageUrl: shared?.url,
      })
    : null;
  /* Whatever page lists the services is the services index, at whatever
     address: one with the services block, or (3.20) the parent the service
     pages live under — unless its Schema panel says otherwise. */
  const listsServices =
    own.listServices === 'on' ||
    (own.listServices !== 'off' &&
      (page.blocks.some((block) => block?.type === 'servicesIndex') ||
        (path !== '/' && catalogue.some((s) => s.path.startsWith(`${path}/`)))));
  const services = listsServices
    ? itemList({ path, name: page.title, items: catalogue.map((s) => ({ name: s.title, path: s.path })), itemType: 'Service' })
    : null;

  const nodes = [
    webPage({
      path: pagePath,
      name: page.seo.title ?? page.title,
      description: page.seo.description ?? page.excerpt,
      modified,
      published: isoDate(page.publishedAt),
      breadcrumbId: own.breadcrumbs === false ? undefined : (crumbs['@id'] as string),
      speakableSelectors: speakable ? ['h1', 'main p'] : undefined,
      type: own.pageType ?? (services ? 'CollectionPage' : undefined),
      inLanguage: locale,
      imageUrl: shared?.url,
      mainEntityId: service ? (service['@id'] as string) : services ? (services['@id'] as string) : undefined,
    }),
    own.breadcrumbs === false ? null : crumbs,
    own.faq === false ? null : faqFromBlocks(expanded, path, { speakable }),
    service,
    services,
  ];

  // 3.28 — the slashed home page's canonical and og:url (Next would print them without the slash); a page's own canonical wins.
  const slashedHome = page.seo.canonicalUrl ? null : homeSlashUrl(path, locale);
  return (
    <>
      {slashedHome && (
        <>
          <link rel="canonical" href={slashedHome} />
          <meta property="og:url" content={slashedHome} />
        </>
      )}
      <BlockRenderer
        blocks={page.blocks}
        showNames={page.template === 'library'}
        trail={trail}
        paging={list && paging ? { blockId: list.blockId, ...paging } : undefined}
        locale={locale}
      />
      {/* This page's own CSS: after the theme, after the site-wide rules and
          after the blocks' own, so the narrowest scope wins without anybody
          reaching for !important.

          Last rather than first for a second reason — a <style> is an element,
          so emitting it up here would make it main's first child and the
          over-hero header would stop lying over the hero. That is the same
          trap BlockRenderer documents, and it is invisible until somebody
          switches to an overlay header months later. */}
      {page.customCss && (
        <style id="he-page-css" dangerouslySetInnerHTML={{ __html: safeCss(page.customCss) }} />
      )}
      <PageAppearanceStyle appearance={page.appearance} />
      {paging && <PagingLinks paging={paging} permalinks={permalinks} />}
      <JsonLd data={graph([...nodes, ...customNodes(page.seo.jsonLd)])} />
    </>
  );
}
