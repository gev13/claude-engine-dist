import 'server-only';
import { inArray } from 'drizzle-orm';
import { type SiteSettings, parseSiteSettings } from '@/lib/siteSettings';
import { site } from '@/lib/site';
import { db } from '@/server/db';
import { settings } from '@/server/db/schema';

/**
 * The keys the Settings screen writes. They are stored one row per key rather
 * than as a single blob, because that is the shape the screen already uses and
 * the shape an individual `settings:write` PATCH expects.
 */
export const SITE_SETTING_KEYS = [
  'site.name',
  'site.tagline',
  'site.description',
  'site.contactEmail',
  'site.dateFormat',
  'site.timeZone',
  'seo.discourageSearchEngines',
  'seo.defaultRobots',
] as const;

const KEY_TO_FIELD: Record<string, keyof SiteSettings> = {
  'site.name': 'name',
  'site.tagline': 'tagline',
  'site.description': 'description',
  'site.contactEmail': 'contactEmail',
  'site.dateFormat': 'dateFormat',
  'site.timeZone': 'timeZone',
  'seo.discourageSearchEngines': 'discourageSearchEngines',
  'seo.defaultRobots': 'defaultRobots',
};

export type ResolvedSiteSettings = Required<Pick<SiteSettings, 'name' | 'tagline' | 'description' | 'contactEmail'>> &
  SiteSettings;

/**
 * Read the site settings, falling back to the bundled constants field by field.
 *
 * Field-by-field rather than all-or-nothing: setting a tagline should not blank
 * the site name.
 */
export async function getSiteSettings(): Promise<ResolvedSiteSettings> {
  let saved: SiteSettings = {};

  try {
    const rows = await db
      .select()
      .from(settings)
      .where(inArray(settings.key, [...SITE_SETTING_KEYS]));

    const shaped: Record<string, unknown> = {};
    for (const row of rows) {
      const field = KEY_TO_FIELD[row.key];
      if (field) shaped[field] = row.value;
    }
    saved = parseSiteSettings(shaped);
  } catch {
    // Leave the bundled constants in place.
  }

  return {
    ...saved,
    name: saved.name || site.name,
    tagline: saved.tagline || site.tagline,
    description: saved.description || site.description,
    contactEmail: saved.contactEmail || site.email,
  };
}
