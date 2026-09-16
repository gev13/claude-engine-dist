import { XML_HEADERS, urlSet } from '@/lib/seo/sitemap';
import { listCategories } from '@/server/content/categories';
import { allPublishedPostsByGroup } from '@/server/content/posts';

export const revalidate = 3600;

/**
 * The blog, in every language, in one sitemap — each post carrying the
 * alternates that describe it (package 8).
 */
export async function GET() {
  const [posts, categories] = await Promise.all([allPublishedPostsByGroup(), listCategories()]);

  return new Response(
    urlSet([
      { path: '/blog', changeFrequency: 'daily', priority: 0.8 },
      { path: '/blog/research', changeFrequency: 'weekly', priority: 0.7 },
      ...categories.map((c) => ({
        path: `/blog/category/${c.slug}`,
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      })),
      ...posts.map((p) => ({
        path: `/blog/${p.slug}`,
        locale: p.locale,
        alternates: p.alternates.map((a) => ({ locale: a.locale, path: `/blog/${a.slug}` })),
        lastModified: p.updatedAt,
        changeFrequency: 'monthly' as const,
        priority: 0.7,
      })),
    ]),
    { headers: XML_HEADERS },
  );
}
