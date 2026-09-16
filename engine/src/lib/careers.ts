import { localeConfig, localePath, type Locale } from './locales';

/* ═══════════════════════════════════════════════════════════════════════════
   Where the careers section lives
   ───────────────────────────────────────────────────────────────────────────
   One place, because four things have to agree about it: the public routes,
   the sitemap, the admin's "view" links, and every `revalidateContent` call
   that follows a save. A slug typed into three of those and mistyped in the
   fourth is a page that serves a stale 404 until somebody notices.
   ═══════════════════════════════════════════════════════════════════════════ */

/** The listing, in the site's own language. Prefixed forms come from `jobPath`. */
export const CAREERS_PATH = '/careers';

/** The URL of one advert, prefixed for every language but the site's main one. */
export function jobPath(slug: string, locale?: Locale): string {
  const config = localeConfig();
  return localePath(locale ?? config.defaultLocale, `${CAREERS_PATH}/${slug}`, config);
}

/** The listing's URL in one language. */
export function careersPath(locale?: Locale): string {
  const config = localeConfig();
  return localePath(locale ?? config.defaultLocale, CAREERS_PATH, config);
}

/**
 * Both URLs a change to one advert can affect.
 *
 * The listing shows every open role, so editing one advert changes two pages —
 * forgetting the second is how a filled role goes on being advertised.
 */
export function jobPaths(slug: string, locale?: Locale): string[] {
  return [jobPath(slug, locale), careersPath(locale)];
}

/* ── The meta grid ──────────────────────────────────────────────────────────
   Six labels, in the order the design shows them. The values are free text —
   "Hybrid, Yerevan" and "3 days on site" are both legitimate answers and no
   enum would hold them — but the *labels* are fixed, so the advert, the card
   and the structured data cannot disagree about what they are called.
   ─────────────────────────────────────────────────────────────────────────── */

export const JOB_META = [
  ['location', 'Location'],
  ['department', 'Department'],
  ['contractType', 'Contract'],
  ['workingTime', 'Working time'],
  ['seniority', 'Seniority'],
  ['workweek', 'Workweek'],
] as const;

export type JobMetaKey = (typeof JOB_META)[number][0];
