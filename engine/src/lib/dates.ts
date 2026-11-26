import { formatDate as legacyDate } from './utils';
import { formatDate as siteDate, type SiteSettings } from './siteSettings';

/**
 * 3.28 — the dates on cards, archives and posts. They used to be one fixed
 * format ("24 Sept 2026"); now, when Settings names a date format, they
 * follow it. The format is held process-wide like the trailing slash
 * (`setSlashMode`), set by `routingConfig()`, which every public route awaits
 * through `getPermalinks()` before it renders a link — so the pure card
 * components need no settings passed in. Unset keeps the old format exactly.
 */
type DateGlobal = { __heDates?: { format?: SiteSettings['dateFormat']; zone?: string } };

export function setSiteDates(format: SiteSettings['dateFormat'] | undefined, zone: string | undefined): void {
  (globalThis as DateGlobal).__heDates = { format, zone };
}

/** A language other than English that Intl can be asked for, or nothing. */
function otherLanguage(locale: string | undefined): string | undefined {
  return locale && /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(locale) && !/^en(-|$)/i.test(locale) ? locale : undefined;
}

/**
 * 3.38.2 — `locale` is the language the date is shown in (the post's own).
 * English, or none, writes exactly what it did; another language writes the
 * month in its own words, in the format Settings names or the old one.
 */
export function cardDate(value: Date | string | null | undefined, locale?: string): string {
  if (!value) return '';
  const set = (globalThis as DateGlobal).__heDates;
  const date = typeof value === 'string' ? new Date(value) : value;
  if (!set?.format) {
    const other = otherLanguage(locale);
    if (other && !Number.isNaN(date.getTime())) {
      try {
        return date.toLocaleDateString(other, { day: '2-digit', month: 'short', year: 'numeric' });
      } catch {
        // A language the runtime cannot write keeps the English below.
      }
    }
    return legacyDate(value);
  }
  return siteDate(date, { dateFormat: set.format, timeZone: set.zone } as SiteSettings, locale);
}

