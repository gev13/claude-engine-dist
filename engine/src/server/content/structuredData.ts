import 'server-only';
import { cache } from 'react';
import type { Locale } from '@/lib/locales';
import { SCHEMA_SETTING_KEY, parseSiteSchema, type SiteSchema } from '@/lib/structuredData';
import { readLocalised } from './localisedSettings';

/**
 * 3.20 — Admin → Structured data. Never throws: a missing, malformed or
 * unreadable row is read as empty, which is exactly what the engine emitted
 * before the screen existed. Per language like the menus, since topics and
 * areas are words.
 */
export const getSiteSchema = cache(async (locale?: Locale): Promise<SiteSchema> => {
  try {
    return parseSiteSchema(await readLocalised(SCHEMA_SETTING_KEY, locale));
  } catch {
    return {};
  }
});
