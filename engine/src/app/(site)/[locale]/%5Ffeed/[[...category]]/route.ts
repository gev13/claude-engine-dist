import { SITE_URL } from '@/lib/env';
import { localeConfig, localePath, type Locale } from '@/lib/locales';
import { absoluteWithSlash, blogIndexPath, categoryPath, feedPath, postPath } from '@/lib/permalinks';
import { site } from '@/lib/site';
import { getCategory } from '@/server/content/categories';
import { listPosts } from '@/server/content/posts';
import { getSiteSettings } from '@/server/content/siteSettings';
import { getPermalinks } from '@/server/routing/config';

export const dynamic = 'force-dynamic';

/* ═══════════════════════════════════════════════════════════════════════════
   The blog's RSS feed (T20, 2.18)
   ───────────────────────────────────────────────────────────────────────────
   `/feed` for the whole blog and `<category>/feed` for one category — the
   addresses WordPress served, so a site moving here keeps its subscribers.
   The middleware rewrites both to this route (`feedTarget`), naming the
   category as the path's last segment. The newest twenty posts, each with its excerpt;
   nothing that is not already public.
   ═══════════════════════════════════════════════════════════════════════════ */

const LIMIT = 20;

const xml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');

export async function GET(_request: Request, ctx: { params: Promise<{ locale: string; category?: string[] }> }) {
  const { locale: raw, category: segments } = await ctx.params;
  const config = localeConfig();
  const locale = (config.locales.includes(raw) ? raw : config.defaultLocale) as Locale;
  const [permalinks, settings] = await Promise.all([getPermalinks(), getSiteSettings(locale)]);
  if (!permalinks.feeds) return new Response('Not found', { status: 404 });

  // `/_feed/<slug>`: a query would not survive the rewrite into a route handler.
  if (segments && segments.length > 1) return new Response('Not found', { status: 404 });
  const slug = segments?.[0];
  const category = slug ? await getCategory(slug, locale) : null;
  if (slug && !category) return new Response('Not found', { status: 404 });

  const posts = await listPosts({ categorySlug: category?.slug, limit: LIMIT, locale });
  const at = (path: string) => absoluteWithSlash(SITE_URL, localePath(locale, path, config));
  const home = at(category ? categoryPath(permalinks, category.slug) : blogIndexPath(permalinks));
  const self = at(feedPath(permalinks, category?.slug)!);
  const title = category ? `${category.name} — ${settings.name}` : `${site.blogLabel} — ${settings.name}`;
  const description = category?.description || settings.description;

  const items = posts
    .map((post) => {
      const link = at(postPath(permalinks, post));
      return [
        '    <item>',
        `      <title>${xml(post.title)}</title>`,
        `      <link>${xml(link)}</link>`,
        `      <guid isPermaLink="true">${xml(link)}</guid>`,
        post.publishedAt ? `      <pubDate>${post.publishedAt.toUTCString()}</pubDate>` : '',
        post.categoryName ? `      <category>${xml(post.categoryName)}</category>` : '',
        post.excerpt ? `      <description>${xml(post.excerpt)}</description>` : '',
        '    </item>',
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n');

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xml(title)}</title>
    <link>${xml(home)}</link>
    <description>${xml(description)}</description>
    <language>${xml(locale)}</language>
    <atom:link href="${xml(self)}" rel="self" type="application/rss+xml"/>
${posts[0]?.publishedAt ? `    <lastBuildDate>${posts[0].publishedAt.toUTCString()}</lastBuildDate>\n` : ''}${items}
  </channel>
</rss>
`;

  return new Response(body, {
    headers: {
      'content-type': 'application/rss+xml; charset=utf-8',
      // Readers poll; fifteen minutes at a CDN is plenty fresh for a blog.
      'cache-control': 'public, max-age=0, s-maxage=900, stale-while-revalidate=60',
    },
  });
}
