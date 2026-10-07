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

export function cardDate(value: Date | string | null | undefined): string {
  if (!value) return '';
  const set = (globalThis as DateGlobal).__heDates;
  if (!set?.format) return legacyDate(value);
  const date = typeof value === 'string' ? new Date(value) : value;
  return siteDate(date, { dateFormat: set.format, timeZone: set.zone } as SiteSettings);
}
