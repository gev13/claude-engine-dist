import { XML_HEADERS, sitemapIndex } from '@/lib/seo/sitemap';
import { resolveBlog } from '@/lib/blog';
import { getTheme } from '@/server/content/theme';
import { allPublishedPostsByGroup } from '@/server/content/posts';
import { allPublishedJobsByGroup } from '@/server/content/jobs';
import { allPublishedProjects } from '@/server/content/projects';
import { sitemapSetup } from '@/server/seo/sitemap';

export const revalidate = 3600;

/**
 * Segmented index: main/static pages, services, the blog, open roles and
 * projects.
 *
 * 3.15.1 — a segment with nothing in it is left out: a blog that is switched
 * off or has no published post, careers with no open role, no published
 * project. Each segment's own sitemap still answers (empty), so a crawler
 * holding an old link gets a valid document.
 */
export async function GET() {
  const now = new Date();
  const [theme, posts, jobs, projects, setup] = await Promise.all([getTheme(), allPublishedPostsByGroup(), allPublishedJobsByGroup(), allPublishedProjects(), sitemapSetup()]);
  const blog = !resolveBlog(theme.blog).off && posts.some((p) => p.indexable);
  const careers = jobs.some((job) => job.isOpen);
  const work = projects.some((project) => project.indexable);
  return new Response(
    sitemapIndex([
      { path: '/sitemaps/pages.xml', lastModified: now },
      { path: '/sitemaps/services.xml', lastModified: now },
      ...(blog ? [{ path: '/sitemaps/blog.xml', lastModified: now }] : []),
      ...(careers ? [{ path: '/sitemaps/careers.xml', lastModified: now }] : []),
      ...(work ? [{ path: '/sitemaps/projects.xml', lastModified: now }] : []),
    ], setup.options),
    { headers: XML_HEADERS },
  );
}
