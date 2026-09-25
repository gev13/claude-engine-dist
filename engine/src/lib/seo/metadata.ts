import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/env';
import { localeConfig, localePath, ogLocale, type Locale, type LocaleConfig } from '@/lib/locales';
import { site } from '@/lib/site';
import { withSlash } from '@/lib/permalinks';
import type { SeoFields } from '@/server/db/schema';

const DEFAULT_OG = '/og-default.png';

/**
 * Build Next metadata from a page's editable SEO record. Everything here is
 * overridable from the admin panel; the fallbacks keep an un-edited page
 * correct rather than empty.
 */
export function buildMetadata(opts: {
  seo?: SeoFields | null;
  title: string;
  description: string;
  path: string;
  type?: 'website' | 'article';
  publishedTime?: string;
  modifiedTime?: string;
  authors?: string[];
  imageUrl?: string | null;
  noindex?: boolean;
  /** The Settings name for `og:site_name`. Callers pass it because this
   *  module is pure; the bundled constant is only the last resort. */
  siteName?: string;
  /** The language this page is written in. Defaults to English (package 8). */
  locale?: Locale;
  /**
   * Where else this page exists. Used for `hreflang`, and *only* what actually
   * exists — advertising a translation that is not there is worse than
   * advertising none.
   */
  translations?: { locale: Locale; path: string }[];
  /** The configured languages. Defaults to the environment; passed in by tests
   *  and by anything that already has it to hand. */
  config?: LocaleConfig;
}): Metadata {
  const seo = opts.seo ?? {};
  const config = opts.config ?? localeConfig();
  const locale = opts.locale ?? config.defaultLocale;
  const title = seo.title?.trim() || opts.title;
  const description = seo.description?.trim() || opts.description;

  /* The canonical is this page's own URL **in its own language**. Pointing a
     translation at the English one would tell Google the translation is a
     duplicate and should not be indexed — the single most damaging mistake
     available in a multilingual setup. */
  const ownPath = withSlash(localePath(locale, opts.path, config));
  const canonical = seo.canonicalUrl?.trim() || `${SITE_URL}${ownPath === '/' ? '' : ownPath}`;

  /* hreflang has to be reciprocal *and* self-referential, or search engines
     discard the set entirely — so this page is in its own list. x-default
     points at the default locale when it exists. */
  const languages: Record<string, string> = {};
  for (const translation of opts.translations ?? []) {
    const url = withSlash(localePath(translation.locale, translation.path, config));
    languages[translation.locale] = `${SITE_URL}${url === '/' ? '' : url}`;
    if (translation.locale === config.defaultLocale) {
      languages['x-default'] = `${SITE_URL}${url === '/' ? '' : url}`;
    }
  }
  const image = opts.imageUrl ?? DEFAULT_OG;
  const absoluteImage = image.startsWith('http') ? image : `${SITE_URL}${image}`;

  const robots = opts.noindex
    ? { index: false, follow: false }
    : seo.robots
      ? {
          index: !/noindex/i.test(seo.robots),
          follow: !/nofollow/i.test(seo.robots),
        }
      : { index: true, follow: true };

  const other: Record<string, string> = {};
  for (const m of seo.extraMeta ?? []) {
    const key = m.name ?? m.property;
    if (key) other[key] = m.content;
  }

  return {
    metadataBase: new URL(SITE_URL),
    title,
    description,
    /* Emitted only when there is genuinely more than one language. Counting
       the map's keys would not do: a page that exists only in English still
       produces two entries there, `en` and `x-default`, both pointing at
       itself — a set that relates a page to nothing but itself. */
    alternates: { canonical, ...((opts.translations?.length ?? 0) > 1 ? { languages } : {}) },
    robots: {
      ...robots,
      googleBot: { ...robots, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 },
    },
    openGraph: {
      type: opts.type ?? 'website',
      siteName: opts.siteName || site.name,
      locale: ogLocale(locale),
      alternateLocale: (opts.translations ?? [])
        .filter((translation) => translation.locale !== locale)
        .map((translation) => ogLocale(translation.locale)),
      url: canonical,
      title: seo.ogTitle?.trim() || title,
      description: seo.ogDescription?.trim() || description,
      images: [{ url: absoluteImage, width: 1200, height: 630, alt: title }],
      ...(opts.publishedTime ? { publishedTime: opts.publishedTime } : {}),
      ...(opts.modifiedTime ? { modifiedTime: opts.modifiedTime } : {}),
      ...(opts.authors ? { authors: opts.authors } : {}),
    },
    twitter: {
      card: seo.twitterCard ?? 'summary_large_image',
      title: seo.ogTitle?.trim() || title,
      description: seo.ogDescription?.trim() || description,
      images: [absoluteImage],
    },
    ...(Object.keys(other).length ? { other } : {}),
  };
}
