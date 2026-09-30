import { XML_HEADERS, urlSet } from '@/lib/seo/sitemap';
import { listCategories } from '@/server/content/categories';
import { allPublishedPostsByGroup, countPosts } from '@/server/content/posts';
import { getPermalinks } from '@/server/routing/config';
import { getTheme } from '@/server/content/theme';
import { resolveBlog } from '@/lib/blog';
import { imageKey, postImages, sitemapSetup } from '@/server/seo/sitemap';
import { localeConfig } from '@/lib/locales';
import { blogIndexPath, categoryPath, postPath, researchPath } from '@/lib/permalinks';

export const revalidate = 3600;

/**
 * The blog, in every language, in one sitemap — each post carrying the
 * alternates that describe it (package 8).
 */
export async function GET() {
  const [posts, categories, permalinks, theme, setup] = await Promise.all([allPublishedPostsByGroup(), listCategories(), getPermalinks(), getTheme(), sitemapSetup()]);
  // 3.6 — a blog switched off lists nothing.
  if (resolveBlog(theme.blog).off) return new Response(urlSet([], localeConfig(), setup.options), { headers: XML_HEADERS });
  // 3.15.1 — nor does a blog with no published post, as the sitemap index agrees.
  if (!posts.some((p) => p.indexable)) return new Response(urlSet([], localeConfig(), setup.options), { headers: XML_HEADERS });
  const images = setup.images ? await postImages() : null;
  /* 3.22 — only archives that answer and want to be found: research when
     there is some, and a category with published posts that is not noindex. */
  const [research, counts] = await Promise.all([countPosts({ kind: 'research' }), Promise.all(categories.map((c) => countPosts({ categorySlug: c.slug })))]);
  const listed = categories.filter((c, i) => counts[i]! > 0 && !/noindex/i.test(String(c.seo?.robots ?? '')));

  return new Response(
    urlSet([
      { path: blogIndexPath(permalinks), changeFrequency: 'daily', priority: 0.8 },
      ...(research > 0 ? [{ path: researchPath(permalinks), changeFrequency: 'weekly' as const, priority: 0.7 }] : []),
      ...listed.map((c) => ({
        path: categoryPath(permalinks, c.slug),
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      })),
      ...posts.filter((p) => p.indexable).map((p) => ({
        path: postPath(permalinks, p),
        locale: p.locale,
        alternates: p.alternates.map((a) => ({ locale: a.locale, path: postPath(permalinks, a) })),
        lastModified: p.updatedAt,
        changeFrequency: 'monthly' as const,
        priority: 0.7,
        images: images?.get(imageKey(p.locale, p.slug)),
      })),
    ], localeConfig(), setup.options),
    { headers: XML_HEADERS },
  );
}
