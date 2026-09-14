import { SITE_URL, env } from './env';

/**
 * Last-resort identity, used only when the database cannot be read.
 *
 * The live name, tagline, description and contact email are Settings, read
 * through `getSiteSettings()` — render those, not these. `email` is empty on
 * purpose, so a placeholder address never reaches the footer or the JSON-LD.
 */
export const site = {
  name: env.SITE_NAME,
  url: SITE_URL,
  tagline: 'A new site.',
  description: 'Describe this site in a sentence. Editable in Settings.',
  email: '',
  locale: 'en',
  /** Route label for the blog section. */
  blogLabel: 'Blog',
  blogBase: '/blog',
} as const;

export type ServiceTier = 'primary' | 'secondary';

export type ServiceRef = {
  slug: string;
  title: string;
  shortTitle: string;
  tier: ServiceTier;
  /** One-line summary used in nav, cards, footers and JSON-LD. */
  blurb: string;
  /** Mockup file this page was ported from. */
  mockup: string;
};

/**
 * The ten services, in the order sitemap.md lists them. `tier` drives sitemap
 * priority, nav grouping and the "Core / Specialist" split in the footer.
 */
/**
 * Fallback service catalogue.
 *
 * The live catalogue is derived from pages with `template = 'service'`, so this
 * is only what shows when the database is unreachable. A new site starts empty.
 */
export const services: ServiceRef[] = [];

export const primaryServices = services.filter((s) => s.tier === 'primary');
export const secondaryServices = services.filter((s) => s.tier === 'secondary');

export function serviceBySlug(slug: string) {
  return services.find((s) => s.slug === slug);
}

export function servicePath(slug: string) {
  return `/services/${slug}`;
}

/** Header navigation. */
export const mainNav = [
  { label: 'Home', href: '/' },
] as const;

/**
 * The header call-to-action button, or null for none. A blank site has no page
 * for it to point at — the old `/contact` default was a broken link on every
 * fresh install — so the button appears once one is set in Menus.
 */
export const headerCta: { label: string; href: string } | null = null;

/** Footer columns. */
export const footerNav = {
  company: [{ label: 'Home', href: '/' }],
  legal: [] as { label: string; href: string }[],
} as const;
