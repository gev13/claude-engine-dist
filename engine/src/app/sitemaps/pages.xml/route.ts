import { XML_HEADERS, urlSet } from '@/lib/seo/sitemap';
import { allPublishedPagePaths } from '@/server/content/pages';

export const revalidate = 3600;

export async function GET() {
  // Services have their own sitemap; library pages are noindex reference pages.
  const pages = (await allPublishedPagePaths()).filter((p) => p.template !== 'service' && p.template !== 'library');

  return new Response(
    urlSet(
      pages.map((p) => ({
        path: p.path,
        lastModified: p.updatedAt,
        changeFrequency: p.path === '/' ? 'weekly' : 'monthly',
        priority: p.path === '/' ? 1.0 : p.template === 'legal' ? 0.3 : 0.8,
      })),
    ),
    { headers: XML_HEADERS },
  );
}
