import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { BlogIndexView } from '@/components/site/blog/BlogViews';
import { localeConfig } from '@/lib/locales';
import { messageReader } from '@/lib/messages';
import { blogIndexPath, withSlash } from '@/lib/permalinks';
import { buildMetadata } from '@/lib/seo/metadata';
import { site } from '@/lib/site';
import { getMessages } from '@/server/content/messages';
import { getPageByPath } from '@/server/content/pages';
import { getSiteSettings } from '@/server/content/siteSettings';
import { getPermalinks } from '@/server/routing/config';

/* ═══════════════════════════════════════════════════════════════════════════
   A search of the blog
   ───────────────────────────────────────────────────────────────────────────
   Visitors never see this address. The middleware rewrites `<blog index>?q=`
   here, so the one view of the blog that has to read the query string is a
   route of its own, and the index and every article stay cached. The folder
   is `%5Fsearch` because Next treats a leading underscore as a private
   folder; this is how it is spelled as a real `/_search` segment.

   It is `noindex` and canonical to the blog index, as the old `?q=` view was.
   ═══════════════════════════════════════════════════════════════════════════ */

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ q?: string | string[] }> };

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? '';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const [permalinks, settings, messages] = await Promise.all([getPermalinks(), getSiteSettings(), getMessages(locale)]);
  const page = await getPageByPath(permalinks.blogIndex, locale);
  const t = messageReader(messages);
  return buildMetadata({
    seo: page?.seo,
    title: page?.title ?? site.blogLabel,
    description: page?.excerpt || t('blog.indexIntro', { site: settings.name }),
    path: blogIndexPath(permalinks),
    locale,
    siteName: settings.name,
    noindex: true,
  });
}

export default async function BlogSearchPage({ params, searchParams }: Props) {
  const [{ locale: raw }, query] = await Promise.all([params, searchParams]);
  const config = localeConfig();
  const locale = config.locales.includes(raw) ? raw : config.defaultLocale;
  const permalinks = await getPermalinks();
  const page = await getPageByPath(permalinks.blogIndex, locale);
  const q = one(query.q).trim().slice(0, 200);
  // An empty search is the index itself, which has its own (cached) address.
  if (!q) redirect(withSlash(blogIndexPath(permalinks)));

  return (
    <BlogIndexView
      page={page}
      paging={{ number: 1, total: 1, perPage: 0, count: 0, base: blogIndexPath(permalinks) }}
      locale={locale}
      permalinks={permalinks}
      query={q}
    />
  );
}
