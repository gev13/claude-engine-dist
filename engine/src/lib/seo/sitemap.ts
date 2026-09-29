import { SITE_URL } from '@/lib/env';
import { localeConfig, localePath, type Locale, type LocaleConfig } from '@/lib/locales';
import { withSlash } from '@/lib/permalinks';

export type SitemapEntry = {
  /** The path *without* a locale prefix; `locale` decides the address. */
  path: string;
  /** The language this URL is written in. Defaults to English. */
  locale?: Locale;
  /**
   * Every language this page exists in, including itself. Google wants the
   * alternates beside the URL they describe, in one sitemap rather than one
   * per language — and the set must include the URL itself, or it is ignored.
   */
  alternates?: { locale: Locale; path: string }[];
  lastModified?: Date | string | null;
  changeFrequency?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number;
  /** 3.19 — the pictures on this address, as site paths or absolute URLs (image sitemap). */
  images?: string[];
};

/** 3.19 — what Settings adds to every sitemap document. */
export type SitemapOptions = {
  /** A same-site XSL stylesheet that browsers apply; search engines ignore it. */
  stylesheet?: string;
};

const IMAGE_NS = 'http://www.google.com/schemas/sitemap-image/1.1';

const absolute = (locale: Locale, path: string, config: LocaleConfig) => {
  const withLocale = withSlash(localePath(locale, path, config));
  return `${SITE_URL}${withLocale === '/' ? '/' : withLocale}`;
};

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* Only a same-site path may be a stylesheet (`//host` is another site): a browser refuses a cross-origin one anyway. */
const SHEET_PATH = /^\/(?!\/)[A-Za-z0-9._~\-/]*$/;

/** The XML declaration, and the stylesheet instruction when one is asked for. */
function prolog(options: SitemapOptions): string {
  const decl = '<?xml version="1.0" encoding="UTF-8"?>';
  return options.stylesheet && SHEET_PATH.test(options.stylesheet)
    ? `${decl}\n<?xml-stylesheet type="text/xsl" href="${esc(options.stylesheet)}"?>`
    : decl;
}

const absoluteUrl = (value: string) => (/^https?:\/\//i.test(value) ? value : `${SITE_URL}${value.startsWith('/') ? '' : '/'}${value}`);

export function urlSet(entries: SitemapEntry[], config: LocaleConfig = localeConfig(), options: SitemapOptions = {}): string {
  const body = entries
    .map((e) => {
      const locale = e.locale ?? config.defaultLocale;
      const loc = absolute(locale, e.path, config);
      const lm = e.lastModified ? new Date(e.lastModified) : null;

      /* A page with no recorded translations still says so about itself — the
         set has to be self-referential either way. */
      const alternates = e.alternates?.length ? e.alternates : [{ locale, path: e.path }];
      const links = alternates.flatMap((alternate) => {
        const href = esc(absolute(alternate.locale, alternate.path, config));
        const line = `    <xhtml:link rel="alternate" hreflang="${alternate.locale}" href="${href}"/>`;
        return alternate.locale === config.defaultLocale
          ? [line, `    <xhtml:link rel="alternate" hreflang="x-default" href="${href}"/>`]
          : [line];
      });

      return [
        '  <url>',
        `    <loc>${esc(loc)}</loc>`,
        lm && !Number.isNaN(lm.getTime()) ? `    <lastmod>${lm.toISOString()}</lastmod>` : '',
        e.changeFrequency ? `    <changefreq>${e.changeFrequency}</changefreq>` : '',
        e.priority !== undefined ? `    <priority>${e.priority.toFixed(1)}</priority>` : '',
        ...links,
        ...(e.images ?? []).map((image) => `    <image:image>\n      <image:loc>${esc(absoluteUrl(image))}</image:loc>\n    </image:image>`),
        '  </url>',
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n');

  // The image namespace is declared only when a picture is listed, so a sitemap without them is byte-for-byte as before.
  const imageNs = entries.some((e) => e.images?.length) ? ` xmlns:image="${IMAGE_NS}"` : '';
  return `${prolog(options)}
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml"${imageNs}>
${body}
</urlset>`;
}

export function sitemapIndex(maps: { path: string; lastModified?: Date | null }[], options: SitemapOptions = {}): string {
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

  return `${prolog(options)}
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</sitemapindex>`;
}

export const XML_HEADERS = {
  'Content-Type': 'application/xml; charset=utf-8',
  'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
};
