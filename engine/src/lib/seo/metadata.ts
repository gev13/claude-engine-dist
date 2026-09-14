import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/env';
import { site } from '@/lib/site';
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
}): Metadata {
  const seo = opts.seo ?? {};
  const title = seo.title?.trim() || opts.title;
  const description = seo.description?.trim() || opts.description;
  const canonical = seo.canonicalUrl?.trim() || `${SITE_URL}${opts.path === '/' ? '' : opts.path}`;
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
    alternates: { canonical },
    robots: {
      ...robots,
      googleBot: { ...robots, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 },
    },
    openGraph: {
      type: opts.type ?? 'website',
      siteName: opts.siteName || site.name,
      locale: 'en_GB',
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
