import { notFound, permanentRedirect, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { BlockRenderer } from '@/components/blocks/Renderer';
import { safeCss } from '@/lib/customCode';
import { findRedirect, recordNotFound } from '@/server/content/redirects';
import { JsonLd } from '@/components/site/JsonLd';
import { buildMetadata } from '@/lib/seo/metadata';
import {
  breadcrumbs,
  faqFromBlocks,
  graph,
  itemList,
  serviceNode,
  webPage,
} from '@/lib/seo/jsonld';
import { servicePath } from '@/lib/site';
import { getServiceBySlug, getServices } from '@/server/content/services';
import { allPublishedPagePaths, getPageByPath, getTranslations } from '@/server/content/pages';
import { localeConfig } from '@/lib/locales';
import { getSiteSettings } from '@/server/content/siteSettings';
import { pageTrail } from '@/server/content/trail';
import { isoDate } from '@/lib/utils';

/**
 * One catch-all route renders every CMS page: home, about, services index, the
 * ten service pages, contact, and the legal pages. Blog routes are handled by
 * their own segment, which takes precedence over this one.
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

/**
 * Only this segment's own params: the locale is enumerated by the layout, and
 * Next calls this once per locale with that locale in `params`. So each
 * language prerenders exactly the paths it actually has — a page written only
 * in English is not built as an empty Armenian one.
 */
export async function generateStaticParams({
  params,
}: {
  params: { locale: string };
}): Promise<{ slug?: string[] }[]> {
  const config = localeConfig();
  const locale = config.locales.includes(params.locale) ? params.locale : config.defaultLocale;
  const paths = await allPublishedPagePaths(locale);
  return paths
    .filter((p) => !p.path.startsWith('/blog'))
    .map((p) => ({ slug: p.path === '/' ? [] : p.path.replace(/^\//, '').split('/') }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { locale: raw, slug } = await params;
  const config = localeConfig();
  const locale = config.locales.includes(raw) ? raw : config.defaultLocale;
  const path = pathFromParams(slug);
  const page = await getPageByPath(path, locale);
  if (!page) return { title: 'Page not found' };
  const [settings, translations] = await Promise.all([
    getSiteSettings(),
    getTranslations(page.translationGroupId),
  ]);

  return buildMetadata({
    seo: page.seo,
    title: page.title,
    description: page.excerpt || settings.description,
    path,
    locale,
    translations,
    siteName: settings.name,
    // Library pages are a reference for whoever builds the site, not content
    // for search engines, whatever the page's own robots field says.
    noindex: page.template === 'library',
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

export default async function CmsPage({ params }: { params: Promise<Params> }) {
  const { locale: raw, slug } = await params;
  const config = localeConfig();
  const locale = config.locales.includes(raw) ? raw : config.defaultLocale;
  const path = pathFromParams(slug);
  const page = await getPageByPath(path, locale);
  if (!page) return handleMiss(path);

  const trail = await pageTrail(path, page.title);
  const crumbs = breadcrumbs(trail);
  const modified = isoDate(page.updatedAt);

  const nodes = [
    webPage({
      path,
      name: page.seo.title ?? page.title,
      description: page.seo.description ?? page.excerpt,
      modified,
      breadcrumbId: crumbs['@id'] as string,
      speakableSelectors: ['h1', 'main p'],
    }),
    crumbs,
    faqFromBlocks(page.blocks, path),
  ];

  // Service pages describe a Service + Offer; the services index is an ItemList.
  if (page.template === 'service') {
    const svc = await getServiceBySlug(path.replace('/services/', ''));
    if (svc) nodes.push(serviceNode({ slug: svc.slug, name: svc.title, description: page.excerpt || svc.blurb }));
  }
  if (path === '/services') {
    const catalogue = await getServices();
    nodes.push(
      itemList({
        path,
        name: 'Services',
        items: catalogue.map((s) => ({ name: s.title, path: servicePath(s.slug) })),
      }),
    );
  }

  return (
    <>
      <BlockRenderer blocks={page.blocks} showNames={page.template === 'library'} trail={trail} />
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
      <JsonLd data={graph(nodes)} />
    </>
  );
}
