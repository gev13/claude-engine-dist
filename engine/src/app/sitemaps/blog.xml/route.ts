import { XML_HEADERS, urlSet } from '@/lib/seo/sitemap';
import { listCategories } from '@/server/content/categories';
import { allPublishedPostsByGroup } from '@/server/content/posts';
import { getPermalinks } from '@/server/routing/config';
import { blogIndexPath, categoryPath, postPath, researchPath } from '@/lib/permalinks';

export const revalidate = 3600;

/**
 * The blog, in every language, in one sitemap — each post carrying the
 * alternates that describe it (package 8).
 */
export async function GET() {
  const [posts, categories, permalinks] = await Promise.all([allPublishedPostsByGroup(), listCategories(), getPermalinks()]);

  return new Response(
    urlSet([
      { path: blogIndexPath(permalinks), changeFrequency: 'daily', priority: 0.8 },
      { path: researchPath(permalinks), changeFrequency: 'weekly', priority: 0.7 },
      ...categories.map((c) => ({
        path: categoryPath(permalinks, c.slug),
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      })),
      ...posts.map((p) => ({
        path: postPath(permalinks, p),
        locale: p.locale,
        alternates: p.alternates.map((a) => ({ locale: a.locale, path: postPath(permalinks, a) })),
        lastModified: p.updatedAt,
        changeFrequency: 'monthly' as const,
        priority: 0.7,
      })),
    ]),
    { headers: XML_HEADERS },
  );
}
