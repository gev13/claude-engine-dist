import { z } from 'zod';

/* ═══════════════════════════════════════════════════════════════════════════
   The cookie notice (package 10, phase D)
   ───────────────────────────────────────────────────────────────────────────
   Package 3 left this out, and said why: the engine sets no tracking cookies
   and loads no third-party scripts, and its embeds already wait for a click.
   That reasoning still holds — and it is not the whole question. A site built
   on this engine may add an analytics tag or a pixel of its own, and several
   jurisdictions expect a notice whether or not one is there yet.

   So the notice exists, and it is honest about what it does:

     • it is a **notice with a recorded choice**, not a consent manager. There
       is nothing here for it to switch off, because there is nothing here to
       switch off;
     • the choice is written to `localStorage` and stamped on `<html>` as
       `data-consent`, so anything a site owner adds can read it before it
       runs — which is the hook that makes the choice mean something;
     • nothing is stored until somebody answers. Asking about storage by
       storing something first is the joke everybody makes about these
       banners, and it is avoidable: the banner shows when the key is absent.

   Wording is the editor's, because "cookies" is a legal question with a
   different answer per site, and an engine that writes the copy for them
   would be giving legal advice.
   ═══════════════════════════════════════════════════════════════════════════ */

export const COOKIE_POSITIONS = ['bottom-bar', 'bottom-left', 'bottom-right', 'centre'] as const;
export type CookiePosition = (typeof COOKIE_POSITIONS)[number];

export const COOKIE_POSITION_LABELS: Record<CookiePosition, string> = {
  'bottom-bar': 'A bar across the bottom',
  'bottom-left': 'A card in the bottom-left corner',
  'bottom-right': 'A card in the bottom-right corner',
  centre: 'Centred, over a dimmed page',
};

/** Where the answer is kept. Read by the banner, and by anything a site adds. */
export const CONSENT_KEY = 'he-consent';

/** The three states: unanswered is the absence of the key, not a value. */
export const CONSENT_VALUES = ['accepted', 'rejected'] as const;
export type Consent = (typeof CONSENT_VALUES)[number];

/** A link to this anywhere on the site reopens the notice. */
export const COOKIE_SETTINGS_HASH = '#cookie-settings';

const text = (max: number) => z.string().trim().max(max);

const category = (title: string, description: string, enabled = true) =>
  z
    .object({ enabled: z.boolean().default(enabled), title: text(60).default(title), description: text(400).default(description) })
    .prefault({});

export const cookieNoticeSchema = z.object({
  /** Off by default: a site with nothing to declare should not nag anybody. */
  enabled: z.boolean().default(false),

  title: text(120).default('Cookies'),
  body: text(600).default(
    'We use cookies that are needed for the site to work. Nothing is used to track you across other sites.',
  ),

  acceptLabel: text(40).default('Accept'),
  rejectLabel: text(40).default('Reject'),

  /**
   * Offering only one button is a legitimate choice for a site that genuinely
   * sets nothing optional — then the notice is an acknowledgement, and a
   * "Reject" that changes nothing would be dishonest.
   */
  showReject: z.boolean().default(true),

  /** A site path to the policy. Empty leaves the link out rather than linking nowhere. */
  policyHref: z
    .string()
    .trim()
    .max(200)
    .regex(/^(|\/[A-Za-z0-9._~\-/%#?=&]*)$/, 'A site path beginning with /')
    .default(''),
  policyLabel: text(60).default('Cookie policy'),

  position: z.enum(COOKIE_POSITIONS).default('bottom-bar'),

  /* ── Consent manager (T11, 2.16) ────────────────────────────────────────
     `notice` is the banner as it always was: a recorded answer and nothing
     switched off. `consent` makes it a consent manager — categories, a
     preferences dialog, and the tag loader (/integrations.js) holding back
     every tag until its category is granted. */
  mode: z.enum(['notice', 'consent']).default('notice'),
  categories: z
    .object({
      necessary: z.object({ title: text(60).default('Necessary'), description: text(400).default('Needed for the site to work — signing in, security, remembering this choice. Always on.') }).prefault({}),
      analytics: category('Analytics', 'Counting visits and how pages are used, so the site can be improved.'),
      marketing: category('Marketing', 'Measuring advertising and showing relevant ads elsewhere.'),
      preferences: category('Preferences', 'Remembering choices such as language and region.', false),
    })
    .prefault({}),
  preferencesLabel: text(40).default('Preferences'),
  saveLabel: text(40).default('Save choices'),
  /** How long an answer is kept before asking again. */
  months: z.number().int().min(1).max(24).default(12),
  /** Bumped by "Ask everyone again"; a changed set of categories also asks again by itself. */
  version: z.number().int().min(1).max(10_000).default(1),
  /**
   * `required`: only visitors whose country header (Cloudflare's
   * CF-IPCountry, Vercel's X-Vercel-IP-Country) is in the EU, the EEA, the UK
   * or Switzerland are asked; everybody else is treated as having agreed.
   * Without such a header, everybody is asked.
   */
  region: z.enum(['everyone', 'required']).default('everyone'),
  /** Count answers — accepted, rejected, chosen — per day, with nothing about who. */
  log: z.boolean().default(false),

  /**
   * Treat a browser's Do Not Track as an answer and never ask.
   *
   * Off by default because DNT is unreliable and widely ignored, but a site
   * that means it should be able to honour it.
   */
  respectDoNotTrack: z.boolean().default(false),
});

export type CookieNotice = z.output<typeof cookieNoticeSchema>;

export const COOKIE_SETTING_KEY = 'cookies';

/** The shipped defaults, for a site that has never opened the screen. */
export const defaultCookieNotice = (): CookieNotice => cookieNoticeSchema.parse({});

/* ── Consent (T11, 2.16) ─────────────────────────────────────────────────── */

/** The cookie a consent-manager answer is kept in: first-party, read by the tag loader. */
export const CONSENT_COOKIE = 'he_consent';
/** Set by the middleware from the CDN's country header: `required` or `other`. */
export const REGION_COOKIE = 'he_region';

export const OPTIONAL_CATEGORIES = ['analytics', 'marketing', 'preferences'] as const;
export type OptionalCategory = (typeof OPTIONAL_CATEGORIES)[number];
export type ConsentChoice = Record<OptionalCategory, boolean>;

/** Where consent is required: the EU and the EEA, the UK and Switzerland. */
export const CONSENT_COUNTRIES = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO',
  'SK', 'SI', 'ES', 'SE', 'IS', 'LI', 'NO', 'GB', 'UK', 'CH',
]);

/**
 * The version an answer must carry to count. It moves when an administrator
 * asks everyone again, and by itself when the set of categories offered
 * changes — somebody who agreed to analytics has not agreed to marketing
 * that was added later.
 */
export function consentVersion(notice: CookieNotice): number {
  const mask = OPTIONAL_CATEGORIES.reduce((bits, key, i) => bits | (notice.categories[key].enabled ? 1 << i : 0), 0);
  return notice.version * 8 + mask;
}

/** An answer as the cookie holds it: `v:17|t:20356|a:1|m:0|p:0`. */
export function encodeConsent(choice: ConsentChoice, version: number, now = Date.now()): string {
  const day = Math.floor(now / 86_400_000);
  return `v:${version}|t:${day}|a:${choice.analytics ? 1 : 0}|m:${choice.marketing ? 1 : 0}|p:${choice.preferences ? 1 : 0}`;
}

/** Read an answer back; null when there is none, or it was given to another version. */
export function decodeConsent(raw: string | null | undefined, version: number): ConsentChoice | null {
  if (!raw) return null;
  let text: string;
  try {
    text = decodeURIComponent(raw);
  } catch {
    // A mangled cookie is no answer, so the visitor is asked again.
    return null;
  }
  const parts = Object.fromEntries(text.split('|').map((pair) => pair.split(':') as [string, string]));
  if (Number(parts.v) !== version) return null;
  return { analytics: parts.a === '1', marketing: parts.m === '1', preferences: parts.p === '1' };
}

/** How an answer is counted in the anonymous log. */
export function choiceKind(choice: ConsentChoice, offered: OptionalCategory[]): 'accepted' | 'rejected' | 'custom' {
  const on = offered.filter((key) => choice[key]).length;
  return on === offered.length ? 'accepted' : on === 0 ? 'rejected' : 'custom';
}
