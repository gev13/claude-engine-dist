import { XML_HEADERS, urlSet } from '@/lib/seo/sitemap';
import { listCategories } from '@/server/content/categories';
import { allPublishedPostSlugs } from '@/server/content/posts';

export const revalidate = 3600;

export async function GET() {
  const [posts, categories] = await Promise.all([allPublishedPostSlugs(), listCategories()]);

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
        lastModified: p.updatedAt,
        changeFrequency: 'monthly' as const,
        priority: 0.7,
      })),
    ]),
    { headers: XML_HEADERS },
  );
}
