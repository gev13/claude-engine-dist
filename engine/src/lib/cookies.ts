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
