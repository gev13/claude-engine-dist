import 'server-only';
import { cache } from 'react';
import { type Locale } from '@/lib/locales';
import { MESSAGES_SETTING_KEY, type Messages, mergeMessages } from '@/lib/messages';
import { readLocalised } from './localisedSettings';

/**
 * The engine's own words, in a language.
 *
 * Wrapped in React's per-request `cache`, because the site layout and several
 * blocks all want them on the same render and there is no reason to ask the
 * database more than once for it.
 */
export const getMessages = cache(async (locale?: Locale): Promise<Messages> => {
  const stored = await readLocalised(MESSAGES_SETTING_KEY, locale);
  return mergeMessages(stored);
});
