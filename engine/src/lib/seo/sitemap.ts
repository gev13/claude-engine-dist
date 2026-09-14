import { SITE_URL } from '@/lib/env';

export type SitemapEntry = {
  path: string;
  lastModified?: Date | string | null;
  changeFrequency?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number;
};

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function urlSet(entries: SitemapEntry[]): string {
  const body = entries
    .map((e) => {
      const loc = `${SITE_URL}${e.path === '/' ? '/' : e.path}`;
      const lm = e.lastModified ? new Date(e.lastModified) : null;
      return [
        '  <url>',
        `    <loc>${esc(loc)}</loc>`,
        lm && !Number.isNaN(lm.getTime()) ? `    <lastmod>${lm.toISOString()}</lastmod>` : '',
        e.changeFrequency ? `    <changefreq>${e.changeFrequency}</changefreq>` : '',
        e.priority !== undefined ? `    <priority>${e.priority.toFixed(1)}</priority>` : '',
        `    <xhtml:link rel="alternate" hreflang="en" href="${esc(loc)}"/>`,
        `    <xhtml:link rel="alternate" hreflang="x-default" href="${esc(loc)}"/>`,
        '  </url>',
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${body}
</urlset>`;
}

export function sitemapIndex(maps: { path: string; lastModified?: Date | null }[]): string {
  const body = maps
    .map((m) =>
      [
        '  <sitemap>',
        `    <loc>${esc(`${SITE_URL}${m.path}`)}</loc>`,
        m.lastModified ? `    <lastmod>${new Date(m.lastModified).toISOString()}</lastmod>` : '',
        '  </sitemap>',
      ]
        .filter(Boolean)
        .join('\n'),
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</sitemapindex>`;
}

export const XML_HEADERS = {
  'Content-Type': 'application/xml; charset=utf-8',
  'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
};
