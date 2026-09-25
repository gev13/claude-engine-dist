import { getPermalinks } from '@/server/routing/config';
import { XML_HEADERS, urlSet } from '@/lib/seo/sitemap';
import { CAREERS_PATH } from '@/lib/careers';
import { allPublishedPagesByGroup } from '@/server/content/pages';

export const revalidate = 3600;

/**
 * Every page, in every language, in one sitemap — each URL carrying the
 * alternates that describe it (package 8).
 *
 * One file rather than one per language, which is Google's own
 * recommendation: it keeps a URL and its translations next to each other, so
 * the relationship cannot drift between files.
 */
export async function GET() {
  // The trailing-slash form every URL below is written in is a setting; load it first.
  await getPermalinks();
  /* Services have their own sitemap; library pages are noindex reference
     pages; and `/careers` belongs to the careers sitemap, which lists it
     whether or not an editor has written a landing page for it — listing it
     in both would put one URL in two files. */
  const pages = (await allPublishedPagesByGroup()).filter(
    (p) => p.template !== 'service' && p.template !== 'library' && p.path !== CAREERS_PATH,
  );

  return new Response(
    urlSet(
      pages.map((p) => ({
        path: p.path,
        locale: p.locale,
        alternates: p.alternates,
        lastModified: p.updatedAt,
        changeFrequency: p.path === '/' ? 'weekly' : 'monthly',
        priority: p.path === '/' ? 1.0 : p.template === 'legal' ? 0.3 : 0.8,
      })),
    ),
    { headers: XML_HEADERS },
  );
}
