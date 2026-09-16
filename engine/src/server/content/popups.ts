import 'server-only';
import { type Popup, popupsSchema } from '@/lib/popups';
import type { Locale } from '@/lib/locales';
import { readLocalised } from './localisedSettings';

export const POPUPS_SETTING_KEY = 'popups';

/**
 * Every saved popup. Never throws: a missing row, a malformed one or an
 * unreachable database all mean "no popups", so a popup can never take the
 * site down.
 */
export async function getPopups(locale?: Locale): Promise<Popup[]> {
  try {
    const value = await readLocalised(POPUPS_SETTING_KEY, locale);
    const parsed = popupsSchema.safeParse(value ?? []);
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}
