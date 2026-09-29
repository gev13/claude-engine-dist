import type { MessageKey } from '@/lib/messages';
import { isColor } from '@/lib/theme';

/* ═══════════════════════════════════════════════════════════════════════════
   The sitemap, readable in a browser (3.19)
   ───────────────────────────────────────────────────────────────────────────
   An XSL stylesheet the sitemaps point at when Settings → "Readable sitemap
   in browsers" is on: the index becomes a table of sitemaps, each sitemap a
   table of addresses with their picture count and last change. Search
   engines ignore the instruction and read the XML as before.

   The words are the `sitemap.*` messages, the header row takes the theme's
   primary colour, and the site's name is written in — nothing here is fixed
   to one site. Pure: the route reads the settings and hands them in.

   Browsers apply XSLT themselves; Chrome is removing it (announced for
   version 158), after which Chrome shows the plain XML again. Firefox and
   Safari keep it. Nothing a search engine reads depends on it.
   ═══════════════════════════════════════════════════════════════════════════ */

export const SITEMAP_STYLESHEET_PATH = '/sitemaps/style.xsl';

type T = (key: MessageKey) => string;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Black or white, whichever reads better on `colour` — white when it cannot be judged. */
export function textOn(colour: string): '#000000' | '#ffffff' {
  const m = HEX.exec(colour.trim());
  if (!m) return '#ffffff';
  const hex = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  // Contrast against white vs against black; pick the larger.
  return (1.05 / (luminance + 0.05)) >= ((luminance + 0.05) / 0.05) ? '#ffffff' : '#000000';
}

/** A message with `{n}` replaced by an XSL expression's value. */
function counted(text: string, select: string): string {
  return text
    .split('{n}')
    .map((part) => esc(part))
    .join(`<xsl:value-of select="${select}"/>`);
}

export function sitemapStylesheet(input: { siteName: string; lang: string; accent: string; t: T }): string {
  const { t } = input;
  // Interpolated into a <style>, so only a colour the theme grammar accepts.
  const accent = isColor(input.accent) && !/^(transparent|currentColor)$|[;{}<>]/.test(input.accent.trim()) ? input.accent.trim() : '#1f1f1f';
  const intro = esc(t('sitemap.intro').replace('{site}', input.siteName));
  const lang = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/.test(input.lang) ? input.lang : 'en';

  return `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:sm="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
  exclude-result-prefixes="sm image">
<xsl:output method="html" encoding="UTF-8" indent="yes" doctype-system="about:legacy-compat"/>

<xsl:template name="when">
  <xsl:param name="d"/>
  <xsl:choose>
    <xsl:when test="string-length($d) &gt; 10"><xsl:value-of select="concat(substring($d, 1, 10), ' ', substring($d, 12, 5))"/></xsl:when>
    <xsl:otherwise><xsl:value-of select="$d"/></xsl:otherwise>
  </xsl:choose>
</xsl:template>

<xsl:template match="/">
<html lang="${lang}">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <meta name="robots" content="noindex, follow"/>
  <title>${esc(t('sitemap.title'))} — ${esc(input.siteName)}</title>
  <style>
    body { margin: 0; background: #ffffff; color: #545353; font: 14px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    .he-sm { max-width: 1000px; margin: 0 auto; padding: 32px 16px 64px; }
    h1 { margin: 0 0 12px; color: #1f1f1f; font-size: 28px; line-height: 1.2; }
    p { margin: 0 0 8px; }
    a { color: #1f1f1f; }
    a:hover { color: ${accent}; }
    .he-sm__count { margin-top: 20px; }
    table { width: 100%; margin-top: 16px; border: 0; border-collapse: collapse; font-size: 13px; }
    th { background: ${accent}; color: ${textOn(accent)}; text-align: left; font-weight: 600; padding: 10px 12px; }
    td { padding: 8px 12px; border-bottom: 1px solid #ececec; }
    td a { text-decoration: none; word-break: break-all; }
    td a:hover { text-decoration: underline; }
    tbody tr:nth-child(odd) td { background: #f7f7f7; }
    tbody tr:hover td { background: #ededed; }
    .he-sm__n, .he-sm__d { width: 1%; white-space: nowrap; }
    .he-sm__n { text-align: right; }
    @media (max-width: 640px) { h1 { font-size: 22px; } th, td { padding: 8px; } }
  </style>
</head>
<body>
<div class="he-sm">
  <h1>${esc(t('sitemap.title'))}</h1>
  <p>${intro} <a href="https://www.sitemaps.org/" rel="noopener">${esc(t('sitemap.more'))}</a></p>
  <xsl:choose>
    <xsl:when test="sm:sitemapindex">
      <p class="he-sm__count">${counted(t('sitemap.indexCount'), 'count(sm:sitemapindex/sm:sitemap)')}</p>
      <table>
        <thead><tr><th>${esc(t('sitemap.sitemap'))}</th><th class="he-sm__d">${esc(t('sitemap.lastModified'))}</th></tr></thead>
        <tbody>
          <xsl:for-each select="sm:sitemapindex/sm:sitemap">
            <tr>
              <td><a href="{sm:loc}"><xsl:value-of select="sm:loc"/></a></td>
              <td class="he-sm__d"><xsl:call-template name="when"><xsl:with-param name="d" select="sm:lastmod"/></xsl:call-template></td>
            </tr>
          </xsl:for-each>
        </tbody>
      </table>
    </xsl:when>
    <xsl:otherwise>
      <p class="he-sm__count">${counted(t('sitemap.urlCount'), 'count(sm:urlset/sm:url)')} <a href="/sitemap.xml">${esc(t('sitemap.back'))}</a></p>
      <table>
        <thead>
          <tr>
            <th>${esc(t('sitemap.url'))}</th>
            <xsl:if test="sm:urlset/sm:url/image:image"><th class="he-sm__n">${esc(t('sitemap.images'))}</th></xsl:if>
            <th class="he-sm__d">${esc(t('sitemap.lastModified'))}</th>
          </tr>
        </thead>
        <tbody>
          <xsl:variable name="images" select="boolean(sm:urlset/sm:url/image:image)"/>
          <xsl:for-each select="sm:urlset/sm:url">
            <tr>
              <td><a href="{sm:loc}"><xsl:value-of select="sm:loc"/></a></td>
              <xsl:if test="$images"><td class="he-sm__n"><xsl:value-of select="count(image:image)"/></td></xsl:if>
              <td class="he-sm__d"><xsl:call-template name="when"><xsl:with-param name="d" select="sm:lastmod"/></xsl:call-template></td>
            </tr>
          </xsl:for-each>
        </tbody>
      </table>
    </xsl:otherwise>
  </xsl:choose>
</div>
</body>
</html>
</xsl:template>
</xsl:stylesheet>
`;
}

export const XSL_HEADERS = {
  'Content-Type': 'text/xsl; charset=utf-8',
  'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
  'X-Content-Type-Options': 'nosniff',
};
