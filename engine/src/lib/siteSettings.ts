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
});

export type SiteSettings = z.infer<typeof siteSettingsSchema>;

export const emptySiteSettings: SiteSettings = {};

/** Never throws: a malformed row degrades to the bundled defaults. */
export function parseSiteSettings(value: unknown): SiteSettings {
  const result = siteSettingsSchema.safeParse(value ?? {});
  return result.success ? result.data : emptySiteSettings;
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
