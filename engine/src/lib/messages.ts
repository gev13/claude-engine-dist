/* ═══════════════════════════════════════════════════════════════════════════
   The engine's own words
   ───────────────────────────────────────────────────────────────────────────
   Everything the engine says on a public page that is not content somebody
   typed: "Skip to content", "min read", "Sending…". A site's own words live in
   its pages; these live here, and a translation of them is stored under
   `messages:<locale>` in settings.

   The admin panel is deliberately **not** covered. It stays English, by
   decision — translating an interface only its administrators see would be a
   large surface for very little.

   Adding a message means adding a key here with its English text. Nothing
   breaks if a translation is missing: the English falls through, so a
   half-translated site reads as a site rather than one full of holes.
   ═══════════════════════════════════════════════════════════════════════════ */

export const MESSAGES = {
  /* ── Site chrome ─────────────────────────────────────────────────────── */
  'chrome.skipToContent': 'Skip to content',
  'chrome.openMenu': 'Open menu',
  'chrome.closeMenu': 'Close menu',
  'chrome.menu': 'Menu',
  'chrome.search': 'Search',
  'chrome.backToTop': 'Back to top',
  'chrome.home': 'Home',
  'chrome.language': 'Language',

  /* ── The blog ────────────────────────────────────────────────────────── */
  'blog.readMore': 'Read more',
  'blog.keepReading': 'Keep reading',
  'blog.minRead': 'min read',
  'blog.article': 'Article',
  'blog.research': 'Research',
  'blog.allWriting': 'All writing',
  'blog.onThisPage': 'On this page',
  'blog.searchPlaceholder': 'Search writing',
  'blog.noResults': 'Nothing matched that.',
  'blog.previous': 'Previous',
  'blog.next': 'Next',

  /* ── Forms ───────────────────────────────────────────────────────────── */
  'form.submit': 'Send',
  'form.sending': 'Sending…',
  'form.thanks': 'Thank you — that is with us.',
  'form.error': 'That could not be sent. Please try again.',
  'form.required': 'This one is needed.',
  'form.invalidEmail': 'That does not look like an email address.',
  'form.choose': 'Choose…',
  'form.optional': 'optional',

  /* ── Newsletter ──────────────────────────────────────────────────────── */
  'newsletter.subscribe': 'Subscribe',
  'newsletter.placeholder': 'Your email address',
  'newsletter.thanks': 'Thank you — you are on the list.',

  /* ── Media that loads only when asked ────────────────────────────────── */
  'media.showMap': 'Show the map',
  'media.playVideo': 'Play',
  'media.pause': 'Pause',
  'media.mapNote': 'The map loads from a third party when you ask for it.',

  /* ── Sharing ─────────────────────────────────────────────────────────── */
  'share.copyLink': 'Copy link',
  'share.copied': 'Link copied',
  'share.shareThis': 'Share this',
  'share.more': 'More ways to share',

  /* ── Opening hours ───────────────────────────────────────────────────── */
  'hours.openNow': 'Open now',
  'hours.closed': 'Closed',
  'hours.open24': 'Open 24 hours',
  'hours.today': 'Today',

  /* ── Countdown ───────────────────────────────────────────────────────── */
  'countdown.days': 'Days',
  'countdown.hours': 'Hours',
  'countdown.minutes': 'Minutes',
  'countdown.seconds': 'Seconds',

  /* ── Not found ───────────────────────────────────────────────────────── */
  'notFound.title': 'That page does not exist',
  'notFound.body': 'It may have moved, or the address may be wrong.',
  'notFound.home': 'Back to the home page',
} as const;

export type MessageKey = keyof typeof MESSAGES;
export type Messages = Record<string, string>;

/** Every key, for the admin screen that translates them. */
export const MESSAGE_KEYS = Object.keys(MESSAGES) as MessageKey[];

/** The settings key a language's overrides live under. */
export const MESSAGES_SETTING_KEY = 'messages';

/**
 * Merge stored overrides over the English defaults.
 *
 * Anything missing, empty or unrecognised falls through to English, so a
 * partly translated site never renders a blank label or a raw key.
 */
export function mergeMessages(overrides: unknown): Messages {
  const merged: Messages = { ...MESSAGES };
  if (!overrides || typeof overrides !== 'object') return merged;

  for (const [key, value] of Object.entries(overrides as Record<string, unknown>)) {
    if (typeof value === 'string' && value.trim() !== '' && key in MESSAGES) {
      merged[key] = value;
    }
  }
  return merged;
}

/** Look one up, falling back to English and then to the key itself. */
export function message(messages: Messages | undefined, key: MessageKey): string {
  return messages?.[key] ?? MESSAGES[key] ?? key;
}
