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
  'blog.all': 'All',
  'blog.searchArticles': 'Search articles…',
  'blog.clear': 'Clear',
  'blog.browse': 'Browse',
  'blog.categories': 'Categories',
  'blog.viewAll': 'View all',
  'blog.read': 'Read',
  'blog.nothingYet': 'Nothing published yet.',
  'blog.nothingHere': 'Nothing published here yet.',
  'blog.nothingFiled': 'Nothing filed here yet.',
  'blog.noResearch': 'No research published yet.',
  'blog.researchIntro': 'Original research, written up in full.',
  'blog.indexIntro': 'Articles and updates from {site}.',
  'blog.categoryIntro': 'Writing from {site} filed under {category}.',
  'blog.nothingMatches': 'Nothing matches “{query}”',
  'blog.resultsFor': '{count} results for “{query}”',
  'blog.oneResultFor': '1 result for “{query}”',

  /* ── Projects (2.14) ─────────────────────────────────────────────────── */
  'project.view': 'View project',
  'project.none': 'No projects here yet.',
  'project.client': 'Client',
  'project.year': 'Year',
  'project.visit': 'Visit the site',
  'project.projects': 'Projects',

  /* ── Archive pages (2.13) ───────────────────────────────────────────── */
  'archive.page': 'Page {n}',
  'archive.pagination': 'Pages',
  'archive.previousPage': 'Previous page',
  'archive.nextPage': 'Next page',
  'archive.loadMore': 'Load more',
  'archive.loading': 'Loading…',
  'archive.resultCount': 'Showing {from}–{to} of {total} results',

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

  /* ── Inside the blocks ────────────────────────────────────────────────
     Controls a visitor operates rather than content an editor writes: the
     arrows on a slider, the close button on a lightbox, the label a screen
     reader hears for a nav. These were written into the components in
     English, so an Armenian or Russian page kept saying "Next slide" — the
     one thing on the hardcoded list that a *visitor* could see was wrong. */
  'block.previousSlide': 'Previous slide',
  'block.nextSlide': 'Next slide',
  'block.slides': 'Slides',
  'block.slidesScroll': 'Slides — scroll sideways',
  'block.previousPicture': 'Previous picture',
  'block.nextPicture': 'Next picture',
  'block.pictureViewer': 'Picture viewer',
  'block.closeVideo': 'Close video',
  'block.close': 'Close',
  'block.playlist': 'Playlist',
  'block.previousPage': 'Previous page',
  'block.nextPage': 'Next page',
  'block.pages': 'Pages',
  'block.sections': 'Sections',
  'block.groups': 'Groups',
  'block.views': 'Views',
  'block.colour': 'Colour',
  'block.previousColour': 'Previous colour',
  'block.nextColour': 'Next colour',
  'block.billingPeriod': 'Billing period',
  'block.breadcrumb': 'Breadcrumb',
  'block.dismiss': 'Dismiss this message',
  'block.filterProjects': 'Filter projects',
  'block.searchTheBlog': 'Search the blog',
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

/**
 * Fill `{name}` placeholders. A value that is missing leaves the placeholder
 * as it stands, so a translation that dropped one reads oddly rather than
 * printing "undefined".
 */
export function formatMessage(text: string, values: Record<string, string | number>): string {
  return text.replace(/\{([a-z]+)\}/gi, (whole, name: string) =>
    Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : whole,
  );
}

/** Look one up, falling back to English and then to the key itself. */
export function message(messages: Messages | undefined, key: MessageKey): string {
  return messages?.[key] ?? MESSAGES[key] ?? key;
}

/**
 * A server component's `t`: `messageReader(await getMessages())`, then
 * `t('archive.page', { n: 2 })`. Client components use `useMessages()`.
 */
export function messageReader(messages: Messages | undefined) {
  return (key: MessageKey, values?: Record<string, string | number>): string => {
    const text = message(messages, key);
    return values ? formatMessage(text, values) : text;
  };
}
