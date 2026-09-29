import { getPermalinks } from '@/server/routing/config';
import { XML_HEADERS, urlSet } from '@/lib/seo/sitemap';
import { allPublishedPagePaths } from '@/server/content/pages';
import { imageKey, pageImages, sitemapSetup } from '@/server/seo/sitemap';
import { localeConfig } from '@/lib/locales';

export const revalidate = 3600;

export async function GET() {
  // The trailing-slash form every URL below is written in is a setting; load it first.
  const [, setup] = await Promise.all([getPermalinks(), sitemapSetup()]);
  const images = setup.images ? await pageImages() : null;
  const locale = localeConfig().defaultLocale;
  const services = (await allPublishedPagePaths()).filter((p) => p.template === 'service' && p.indexable !== false);

  return new Response(
    urlSet(
      services.map((p) => ({
        path: p.path,
        lastModified: p.updatedAt,
        changeFrequency: 'monthly',
        // sitemap.md marks seven services primary and three secondary.
        priority: p.priorityTier === 'primary' ? 0.9 : 0.7,
        images: images?.get(imageKey(locale, p.path)),
      })),
      localeConfig(),
      setup.options,
    ),
    { headers: XML_HEADERS },
  );
}
