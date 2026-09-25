import { getPermalinks } from '@/server/routing/config';
import { XML_HEADERS, urlSet } from '@/lib/seo/sitemap';
import { CAREERS_PATH } from '@/lib/careers';
import { allPublishedJobsByGroup } from '@/server/content/jobs';

export const revalidate = 3600;

/**
 * The careers section, in every language, each advert carrying the alternates
 * that describe it.
 *
 * Open roles only. A filled advert is deliberately `noindex` and emits no
 * JobPosting, so listing it here would ask a crawler to index the one page
 * the advert itself is asking it not to — and a search result pointing at a
 * vacancy that no longer exists wastes somebody's afternoon.
 */
export async function GET() {
  // The trailing-slash form every URL below is written in is a setting; load it first.
  await getPermalinks();
  const jobs = (await allPublishedJobsByGroup()).filter((job) => job.isOpen);

  return new Response(
    urlSet([
      { path: CAREERS_PATH, changeFrequency: 'weekly', priority: 0.7 },
      ...jobs.map((job) => ({
        path: `${CAREERS_PATH}/${job.slug}`,
        locale: job.locale,
        alternates: job.alternates.map((a) => ({ locale: a.locale, path: `${CAREERS_PATH}/${a.slug}` })),
        lastModified: job.updatedAt,
        /* Weekly rather than monthly: a vacancy has a shelf life, and the one
           thing a crawler should notice quickly is that it has closed. */
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      })),
    ]),
    { headers: XML_HEADERS },
  );
}
