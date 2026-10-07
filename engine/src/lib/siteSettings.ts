import { z } from 'zod';

/* ═══════════════════════════════════════════════════════════════════════════
   Site settings
   ───────────────────────────────────────────────────────────────────────────
   The fields on the admin's Settings screen. Until now the screen wrote six
   rows that nothing read: an administrator could rename the site, save, see a
   success toast and watch nothing change.

   Every field here has exactly one consumer, named in its comment. Do not add
   one without wiring it — a setting that does nothing is worse than no setting.
   ═══════════════════════════════════════════════════════════════════════════ */

export const DATE_FORMATS = {
  'd MMMM yyyy': '9 September 2026',
  'MMMM d, yyyy': 'September 9, 2026',
  'yyyy-MM-dd': '2026-09-09',
  'dd/MM/yyyy': '09/09/2026',
  'MM/dd/yyyy': '09/09/2026 (US)',
} as const;

export type DateFormat = keyof typeof DATE_FORMATS;

export const TITLE_SEPARATORS = ['—', '|', '-', '·', '–'] as const;

export const siteSettingsSchema = z.object({
  /** Page titles, Open Graph, Organization and WebSite JSON-LD. */
  name: z.string().trim().min(1).max(120).optional(),
  /** The default homepage title and the Organization slogan. */
  tagline: z.string().trim().max(200).optional(),
  /** The default meta description. */
  description: z.string().trim().max(400).optional(),
  /** Shown in the footer and used as the Organization contact point. */
  contactEmail: z.string().trim().email().max(200).optional(),

  /** How dates render on posts and in the admin's public-facing output. */
  dateFormat: z.enum(['d MMMM yyyy', 'MMMM d, yyyy', 'yyyy-MM-dd', 'dd/MM/yyyy', 'MM/dd/yyyy']).optional(),
  /** IANA zone used when formatting those dates. */
  timeZone: z.string().trim().max(60).optional(),

  /**
   * The one switch that hides the site from search engines: it flips both
   * `robots.txt` and the `robots` meta tag. Meant for staging.
   */
  discourageSearchEngines: z.boolean().optional(),
  /** Default robots directive when a page does not set its own. */
  defaultRobots: z.string().trim().max(120).optional(),

  /* 2.18 — titles and sharing. */
  /** What sits between a page's title and the site's name. */
  titleSeparator: z.enum(TITLE_SEPARATORS).optional(),
  /** `site` — "Page — Site", as always; `plain` — the page's title alone. */
  titleFormat: z.enum(['site', 'plain']).optional(),
  /** The picture shared for a page that has none of its own. */
  ogImageUrl: z
    .string()
    .trim()
    .max(500)
    .regex(/^(|\/[A-Za-z0-9._~\-/%]*)$/, 'A picture from the media library')
    .optional(),

  /* 3.18 — the organization behind the site, for search engines (Organization JSON-LD). Each is left out while empty. */
  /** The registered company name, when it differs from the site name. */
  legalName: z.string().trim().max(160).optional(),
  /** Another name people search for (e.g. a spelling without the brand's styling). */
  alternateName: z.string().trim().max(120).optional(),
  /** The year (or date) it was founded: 2024, 2024-05 or 2024-05-01. */
  foundingDate: z.string().trim().regex(/^(|\d{4}(-\d{2}(-\d{2})?)?)$/, 'A year, or a date as 2024-05-01').optional(),
  /** A contact telephone number, with its country code. */
  phone: z.string().trim().max(40).regex(/^(|\+?[0-9 ()./-]{4,40})$/, 'A phone number').optional(),
  addressStreet: z.string().trim().max(160).optional(),
  addressLocality: z.string().trim().max(120).optional(),
  addressRegion: z.string().trim().max(120).optional(),
  addressPostalCode: z.string().trim().max(20).optional(),
  /** A country name or its two-letter code. */
  addressCountry: z.string().trim().max(60).optional(),
  /** The logo search engines show: a PNG, JPG or WebP, square, at least 112px — an SVG is not accepted there. */
  searchLogoUrl: z
    .string()
    .trim()
    .max(500)
    .regex(/^(|\/[A-Za-z0-9._~\-/%]*\.(png|jpe?g|webp))$/i, 'A PNG, JPG or WebP from the media library')
    .optional(),

  /* 3.18 — search consoles and social cards. */
  /** The site's X (Twitter) account, as twitter:site. */
  twitterHandle: z.string().trim().regex(/^(|@?[A-Za-z0-9_]{1,15})$/, 'An X handle, e.g. @yourcompany').optional(),
  /** The content of each console's verification meta tag. */
  googleVerification: z.string().trim().regex(/^(|[A-Za-z0-9_\-=.:]{6,120})$/, 'The code from the verification tag').optional(),
  bingVerification: z.string().trim().regex(/^(|[A-Za-z0-9_\-=.:]{6,120})$/, 'The code from the verification tag').optional(),
  yandexVerification: z.string().trim().regex(/^(|[A-Za-z0-9_\-=.:]{6,120})$/, 'The code from the verification tag').optional(),

  /* 3.21 — www.example.com answers with a permanent redirect to the site's own
     address (example.com). Never exported: it belongs to the server's domain. */
  wwwRedirect: z.boolean().optional(),
  /* 3.28 — redirect rules answer before pages, with their own status (301/302): a route can only answer 307/308.
     Live content no longer wins over a rule for the same address. And an address in capitals answers with a 301
     to its lowercase spelling. Both off until switched on. */
  redirectsFirst: z.boolean().optional(),
  lowercaseUrls: z.boolean().optional(),
  /** 3.28 — the main language's region, two capitals (US, GB): `og:locale` en_US, `lang="en-US"`. Unset keeps the language's own. */
  region: z.string().trim().regex(/^(|[A-Z]{2})$/, 'Two capital letters, e.g. US').optional(),

  /* 3.19 — the sitemaps. Both off until switched on, so an untouched site's XML is unchanged. */
  /** Opened in a browser, the sitemaps show as a table with links (an XSL stylesheet); search engines read the same XML. */
  sitemapStyle: z.boolean().optional(),
  /** Each address lists the pictures on it (image sitemap), read from its blocks, body and cover. */
  sitemapImages: z.boolean().optional(),

  /* 2.18 — the page shown for an address that does not exist. */
  notFoundPageId: z.string().uuid().or(z.literal('')).optional(),
  /** A second button on the built-in 404, beside "Back to the homepage". */
  notFoundLinkLabel: z.string().trim().max(60).optional(),
  notFoundLinkHref: z.string().trim().max(300).optional(),
});

export type SiteSettings = z.infer<typeof siteSettingsSchema>;

export const emptySiteSettings: SiteSettings = {};

/**
 * Never throws, and never loses more than it must: each field is checked on
 * its own (2.18), so one bad value degrades that field to its default rather
 * than taking every setting with it.
 */
export function parseSiteSettings(value: unknown): SiteSettings {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const out: Record<string, unknown> = {};
  for (const [key, schema] of Object.entries(siteSettingsSchema.shape)) {
    if (raw[key] === undefined) continue;
    const parsed = (schema as z.ZodType).safeParse(raw[key]);
    if (parsed.success) out[key] = parsed.data;
  }
  return out as SiteSettings;
}

/** "Page — Site", or the page alone: the template Next applies to every title (2.18). */
export function titleTemplate(settings: Pick<SiteSettings, 'titleSeparator' | 'titleFormat'> & { name: string }): string {
  if (settings.titleFormat === 'plain') return '%s';
  return `%s ${settings.titleSeparator ?? '—'} ${settings.name}`;
}

/** Format a date with the configured format and zone. */
export function formatDate(date: Date, settings: SiteSettings): string {
  const zone = settings.timeZone || 'UTC';
  const format = settings.dateFormat ?? 'd MMMM yyyy';

  const opts: Intl.DateTimeFormatOptions = { timeZone: zone };
  switch (format) {
    case 'yyyy-MM-dd':
      return new Intl.DateTimeFormat('en-CA', { ...opts, dateStyle: 'short' }).format(date);
    case 'dd/MM/yyyy':
      return new Intl.DateTimeFormat('en-GB', { ...opts, day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
    case 'MM/dd/yyyy':
      return new Intl.DateTimeFormat('en-US', { ...opts, day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
    case 'MMMM d, yyyy':
      return new Intl.DateTimeFormat('en-US', { ...opts, day: 'numeric', month: 'long', year: 'numeric' }).format(date);
    default:
      return new Intl.DateTimeFormat('en-GB', { ...opts, day: 'numeric', month: 'long', year: 'numeric' }).format(date);
  }
}

/**
 * 3.18 — where each setting is stored, by key. `site.*` keys and the SEO and
 * missing-page keys below travel with a content export; the switch that hides
 * a site from search engines and the default robots rule never do, so a
 * staging site's "noindex" cannot reach a live one.
 */
export const SITE_SETTING_FIELDS = {
  'site.name': 'name',
  'site.tagline': 'tagline',
  'site.description': 'description',
  'site.contactEmail': 'contactEmail',
  'site.dateFormat': 'dateFormat',
  'site.timeZone': 'timeZone',
  'site.legalName': 'legalName',
  'site.alternateName': 'alternateName',
  'site.foundingDate': 'foundingDate',
  'site.phone': 'phone',
  'site.addressStreet': 'addressStreet',
  'site.addressLocality': 'addressLocality',
  'site.addressRegion': 'addressRegion',
  'site.addressPostalCode': 'addressPostalCode',
  'site.addressCountry': 'addressCountry',
  'site.searchLogoUrl': 'searchLogoUrl',
  'seo.discourageSearchEngines': 'discourageSearchEngines',
  'seo.defaultRobots': 'defaultRobots',
  'seo.titleSeparator': 'titleSeparator',
  'seo.titleFormat': 'titleFormat',
  'seo.ogImageUrl': 'ogImageUrl',
  'seo.twitterHandle': 'twitterHandle',
  'seo.googleVerification': 'googleVerification',
  'seo.bingVerification': 'bingVerification',
  'seo.yandexVerification': 'yandexVerification',
  'seo.sitemapStyle': 'sitemapStyle',
  'seo.sitemapImages': 'sitemapImages',
  'seo.wwwRedirect': 'wwwRedirect',
  'seo.redirectsFirst': 'redirectsFirst',
  'seo.lowercaseUrls': 'lowercaseUrls',
  'site.region': 'region',
  'pages.notFoundPageId': 'notFoundPageId',
  'pages.notFoundLinkLabel': 'notFoundLinkLabel',
  'pages.notFoundLinkHref': 'notFoundLinkHref',
} as const satisfies Record<string, keyof SiteSettings>;

/** 3.18 — settings outside `site.*` that travel with a content export (3.19: the sitemap switches too). */
export const PORTABLE_SEO_KEYS = [
  'seo.titleSeparator',
  'seo.titleFormat',
  'seo.ogImageUrl',
  'seo.twitterHandle',
  'seo.googleVerification',
  'seo.bingVerification',
  'seo.yandexVerification',
  'seo.sitemapStyle',
  'seo.sitemapImages',
  'pages.notFoundPageId',
  'pages.notFoundLinkLabel',
  'pages.notFoundLinkHref',
] as const;
