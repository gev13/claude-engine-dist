import { SITE_URL } from '@/lib/env';
import { CAREERS_PATH } from '@/lib/careers';
import { servicePath, site } from '@/lib/site';
import { listJobs } from '@/server/content/jobs';
import { allPublishedPagePaths } from '@/server/content/pages';
import { getServiceCatalogue } from '@/server/content/services';
import { listPosts, postUrl } from '@/server/content/posts';
import { getPermalinks } from '@/server/routing/config';
import { blogIndexPath, projectPath, withSlash } from '@/lib/permalinks';
import { allPublishedProjects } from '@/server/content/projects';
import { localeConfig } from '@/lib/locales';
import { getSiteSettings } from '@/server/content/siteSettings';

export const revalidate = 3600;

const link = (title: string, path: string, note?: string | null) =>
  `- [${title}](${SITE_URL}${withSlash(path)})${note ? `: ${note}` : ''}`;

/**
 * llms.txt — a curated map of the site for answer engines, in the format at
 * llmstxt.org. Kept short and factual on purpose: it is a routing document,
 * not a marketing page.
 *
 * Everything in it is read from what the site actually has — the Settings
 * identity, published pages, services and posts — so a section with nothing in
 * it is left out rather than listed empty or filled with links that 404.
 */
export async function GET() {
  const [settings, pages, catalogue, posts, openRoles, permalinks] = await Promise.all([
    getSiteSettings(),
    allPublishedPagePaths(),
    getServiceCatalogue(),
    listPosts({ limit: 15 }),
    listJobs({ limit: 25, openOnly: true }),
    getPermalinks(),
  ]);

  const lines: string[] = [`# ${settings.name}`, '', `> ${settings.description}`];
  if (settings.tagline) lines.push('', settings.tagline);

  // Services get their own section; library pages are noindex reference pages.
  const plain = pages.filter((p) => p.template !== 'service' && p.template !== 'library');
  if (plain.length > 0) {
    lines.push('', '## Pages', '', ...plain.map((p) => link(p.title, p.path)));
  }

  if (catalogue.primary.length > 0) {
    lines.push('', '## Core services', '', ...catalogue.primary.map((s) => link(s.title, servicePath(s.slug), s.blurb)));
  }
  if (catalogue.secondary.length > 0) {
    lines.push('', '## Specialist services', '', ...catalogue.secondary.map((s) => link(s.title, servicePath(s.slug), s.blurb)));
  }

  if (posts.length > 0) {
    lines.push(
      '',
      `## ${site.blogLabel}`,
      '',
      link(site.blogLabel, blogIndexPath(permalinks)),
      ...posts.map((p) => link(p.title, postUrl(permalinks, p), p.excerpt)),
    );
  }

  // 2.14 — the work, which is what a visitor usually came to see.
  const work = (await allPublishedProjects()).filter((project) => project.locale === localeConfig().defaultLocale).slice(0, 30);
  if (work.length > 0) {
    lines.push('', '## Projects', '', ...work.map((project) => link(project.title, projectPath(permalinks, project.slug), project.summary)));
  }

  /* Open roles only. A filled advert is `noindex` and carries no JobPosting,
     so listing it here would point an answer engine at the one page the rest
     of the site is trying to keep out of results. */
  if (openRoles.length > 0) {
    lines.push(
      '',
      '## Careers',
      '',
      link('Open roles', CAREERS_PATH),
      ...openRoles.map((job) => link(job.title, `${CAREERS_PATH}/${job.slug}`, job.excerpt || job.location)),
    );
  }

  lines.push(
    '',
    '## Optional',
    '',
    link('Sitemap', '/sitemap.xml'),
    '',
    '## Usage',
    '',
    `Content on this site may be quoted with attribution to ${settings.name} and a link to the source page.`,
    '',
  );

  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=3600',
    },
  });
}
