import { SITE_URL } from '@/lib/env';
import { servicePath, site } from '@/lib/site';
import { allPublishedPagePaths } from '@/server/content/pages';
import { getServiceCatalogue } from '@/server/content/services';
import { listPosts } from '@/server/content/posts';
import { getSiteSettings } from '@/server/content/siteSettings';

export const revalidate = 3600;

const link = (title: string, path: string, note?: string | null) =>
  `- [${title}](${SITE_URL}${path})${note ? `: ${note}` : ''}`;

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
  const [settings, pages, catalogue, posts] = await Promise.all([
    getSiteSettings(),
    allPublishedPagePaths(),
    getServiceCatalogue(),
    listPosts({ limit: 15 }),
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
      link(site.blogLabel, site.blogBase),
      ...posts.map((p) => link(p.title, `${site.blogBase}/${p.slug}`, p.excerpt)),
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
