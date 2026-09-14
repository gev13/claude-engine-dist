import { XML_HEADERS, sitemapIndex } from '@/lib/seo/sitemap';

export const revalidate = 3600;

/** Segmented index: main/static pages, services, and the blog. */
export function GET() {
  const now = new Date();
  return new Response(
    sitemapIndex([
      { path: '/sitemaps/pages.xml', lastModified: now },
      { path: '/sitemaps/services.xml', lastModified: now },
      { path: '/sitemaps/blog.xml', lastModified: now },
    ]),
    { headers: XML_HEADERS },
  );
}
