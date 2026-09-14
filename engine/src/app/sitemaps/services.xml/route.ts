import { XML_HEADERS, urlSet } from '@/lib/seo/sitemap';
import { allPublishedPagePaths } from '@/server/content/pages';

export const revalidate = 3600;

export async function GET() {
  const services = (await allPublishedPagePaths()).filter((p) => p.template === 'service');

  return new Response(
    urlSet(
      services.map((p) => ({
        path: p.path,
        lastModified: p.updatedAt,
        changeFrequency: 'monthly',
        // sitemap.md marks seven services primary and three secondary.
        priority: p.priorityTier === 'primary' ? 0.9 : 0.7,
      })),
    ),
    { headers: XML_HEADERS },
  );
}
