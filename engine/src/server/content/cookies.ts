import 'server-only';
import { COOKIE_SETTING_KEY, type CookieNotice, cookieNoticeSchema, defaultCookieNotice } from '@/lib/cookies';
import type { Locale } from '@/lib/locales';
import { readLocalised } from './localisedSettings';

/**
 * The saved cookie notice. Never throws: a missing row, a malformed one or an
 * unreachable database all mean "the shipped defaults", which are disabled —
 * so a broken settings row can never put a banner over every page, and can
 * never take the site down either.
 *
 * Translated like the menus: the wording is a legal statement, and a site that
 * speaks three languages has to be able to say it in all three.
 */
export async function getCookieNotice(locale?: Locale): Promise<CookieNotice> {
  try {
    const value = await readLocalised(COOKIE_SETTING_KEY, locale);
    const parsed = cookieNoticeSchema.safeParse(value ?? {});
    return parsed.success ? parsed.data : defaultCookieNotice();
  } catch {
    return defaultCookieNotice();
  }
}
