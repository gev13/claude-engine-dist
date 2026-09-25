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
