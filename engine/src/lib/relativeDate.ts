/* ═══════════════════════════════════════════════════════════════════════════
   "12 days ago", "12 days left"
   ───────────────────────────────────────────────────────────────────────────
   The design shows a posted date and a deadline as an absolute date with a
   relative one beside it: "March 25, 2026 ( 1 month ago )".

   Two things follow, and both are decisions rather than details:

     • **The relative half is computed in the browser.** A page cached by ISR
       for five minutes cannot say "12 days left" from the server without
       being wrong for most of the people who read it — the same reason the
       countdown and the opening-hours block already work this way.
     • **`Intl.RelativeTimeFormat` does the wording**, so Armenian and Russian
       are correct without anybody translating "days ago" — and correct in the
       plural rules of each, which a hand-written table gets wrong.
   ═══════════════════════════════════════════════════════════════════════════ */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
/** Averages: the phrase is "about a month ago", not an accounting figure. */
const MONTH = 30.436875 * DAY;
const YEAR = 365.2425 * DAY;

export type RelativeParts = { value: number; unit: Intl.RelativeTimeFormatUnit };

/**
 * The largest unit that describes the gap without exaggerating it.
 *
 * Negative values are in the past, positive in the future — the convention
 * `Intl.RelativeTimeFormat` itself uses.
 */
export function relativeParts(target: Date, now: Date = new Date()): RelativeParts | null {
  const time = target.getTime();
  if (Number.isNaN(time)) return null;

  const difference = time - now.getTime();
  const size = Math.abs(difference);
  const sign = difference < 0 ? -1 : 1;
  const round = (step: number) => sign * Math.max(1, Math.round(size / step));

  if (size < MINUTE) return { value: 0, unit: 'second' };
  if (size < HOUR) return { value: round(MINUTE), unit: 'minute' };
  if (size < DAY) return { value: round(HOUR), unit: 'hour' };
  if (size < WEEK) return { value: round(DAY), unit: 'day' };
  if (size < MONTH) return { value: round(WEEK), unit: 'week' };
  if (size < YEAR) return { value: round(MONTH), unit: 'month' };
  return { value: round(YEAR), unit: 'year' };
}

/**
 * "12 days ago" / "in 12 days", in the reader's language.
 *
 * Falls back to English if the runtime has no data for the locale, rather than
 * throwing — a missing locale should cost the wording, not the page.
 */
export function formatRelative(target: Date, locale: string, now: Date = new Date()): string {
  const parts = relativeParts(target, now);
  if (!parts) return '';
  if (parts.value === 0) return relativeFormatter(locale).format(0, 'second');
  return relativeFormatter(locale).format(parts.value, parts.unit);
}

const formatters = new Map<string, Intl.RelativeTimeFormat>();

function relativeFormatter(locale: string): Intl.RelativeTimeFormat {
  const existing = formatters.get(locale);
  if (existing) return existing;
  let made: Intl.RelativeTimeFormat;
  try {
    made = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  } catch {
    made = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  }
  formatters.set(locale, made);
  return made;
}

/** "25 March 2026", in the reader's language. */
export function formatAbsolute(target: Date, locale: string): string {
  if (Number.isNaN(target.getTime())) return '';
  try {
    return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(target);
  } catch {
    return new Intl.DateTimeFormat('en', { day: 'numeric', month: 'long', year: 'numeric' }).format(target);
  }
}

/** Has a deadline passed? Used to say "closed" rather than "-3 days left". */
export function hasPassed(target: Date, now: Date = new Date()): boolean {
  return !Number.isNaN(target.getTime()) && target.getTime() < now.getTime();
}
