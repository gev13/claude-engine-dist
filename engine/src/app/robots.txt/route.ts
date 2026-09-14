import { SITE_URL, isProd } from '@/lib/env';
import { getSiteSettings } from '@/server/content/siteSettings';

export const revalidate = 3600;

/**
 * Production allows everything except the admin panel and the API. Any
 * non-production origin is disallowed wholesale so staging never gets indexed,
 * as is any origin where an administrator has turned search engines off.
 */
export async function GET() {
  const { discourageSearchEngines } = await getSiteSettings();
  const body = isProd && !discourageSearchEngines
    ? `# ${SITE_URL}
User-agent: *
Allow: /
Disallow: /admin
Disallow: /admin/
Disallow: /api/
Disallow: /media/private/
Disallow: /*?*q=
Disallow: /*?*page=

# AI answer engines — content may be cited with attribution.
User-agent: GPTBot
Allow: /
User-agent: OAI-SearchBot
Allow: /
User-agent: ChatGPT-User
Allow: /
User-agent: PerplexityBot
Allow: /
User-agent: ClaudeBot
Allow: /
User-agent: Claude-Web
Allow: /
User-agent: Google-Extended
Allow: /
User-agent: Applebot-Extended
Allow: /
User-agent: CCBot
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml
Host: ${SITE_URL.replace(/^https?:\/\//, '')}
`
    : `User-agent: *
Disallow: /
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=3600',
    },
  });
}
