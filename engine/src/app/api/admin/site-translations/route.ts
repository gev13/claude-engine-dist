import { inArray } from 'drizzle-orm';
import { z } from 'zod';
import { localeConfig } from '@/lib/locales';
import { MESSAGES, MESSAGES_SETTING_KEY, type MessageKey } from '@/lib/messages';
import { applyStrings, collectStrings } from '@/lib/translate';
import { badRequest, handle, ok, readJson } from '@/server/api/respond';
import { requireUser } from '@/server/api/guard';
import { audit } from '@/server/auth/audit';
import { clientIp } from '@/server/auth/rateLimit';
import { revalidateEverything } from '@/server/content/revalidate';
import { localeKey } from '@/server/content/localisedSettings';
import { db } from '@/server/db';
import { settings } from '@/server/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* ═══════════════════════════════════════════════════════════════════════════
   Translating everything that is not page content (package 8)
   ───────────────────────────────────────────────────────────────────────────
   Three things live here, because they are the three a site has beyond its
   pages: the site's own details, its menus, and the engine's own words.

   Menus are translated with the same machinery as a page: the navigation JSON
   is walked, its labels offered as text and its addresses left alone, and the
   translation is the original's structure with the new words in it. A menu
   therefore cannot gain or lose an item per language — which is the point.
   ═══════════════════════════════════════════════════════════════════════════ */

const NAVIGATION_KEY = 'navigation';
const SITE_KEYS = ['site.name', 'site.tagline', 'site.description', 'site.contactEmail'] as const;

async function readRaw(keys: string[]): Promise<Map<string, unknown>> {
  try {
    const rows = await db.select().from(settings).where(inArray(settings.key, keys));
    return new Map(rows.map((row) => [row.key, row.value]));
  } catch {
    return new Map();
  }
}

async function writeSetting(key: string, value: unknown, userId: string) {
  await db
    .insert(settings)
    .values({ key, value: value as never, updatedById: userId })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: value as never, updatedById: userId, updatedAt: new Date() },
    });
}

export async function GET(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'settings:write');
    if (!guard.ok) return guard.response;

    const locale = new URL(request.url).searchParams.get('locale');
    const config = localeConfig();
    if (!locale || !config.locales.includes(locale)) {
      return badRequest('Which language?');
    }
    if (locale === config.defaultLocale) {
      return badRequest('That is the main language — it is the original, not a translation.');
    }

    const suffix = (key: string) => localeKey(key, locale, config.defaultLocale);
    const raw = await readRaw([
      NAVIGATION_KEY,
      suffix(NAVIGATION_KEY),
      MESSAGES_SETTING_KEY,
      suffix(MESSAGES_SETTING_KEY),
      ...SITE_KEYS,
      ...SITE_KEYS.map(suffix),
    ]);

    /* Menus: the original's labels, beside whatever has been written for them. */
    const sourceNav = raw.get(NAVIGATION_KEY) ?? {};
    const targetNav = raw.get(suffix(NAVIGATION_KEY));
    const translatedNav = new Map(
      (targetNav ? collectStrings(targetNav) : []).map((entry) => [entry.path, entry.value]),
    );

    const storedMessages = (raw.get(suffix(MESSAGES_SETTING_KEY)) ?? {}) as Record<string, unknown>;

    return ok({
      locale,
      defaultLocale: config.defaultLocale,
      site: SITE_KEYS.map((key) => ({
        key,
        source: typeof raw.get(key) === 'string' ? (raw.get(key) as string) : '',
        target: typeof raw.get(suffix(key)) === 'string' ? (raw.get(suffix(key)) as string) : '',
      })),
      menus: collectStrings(sourceNav).map((entry) => {
        const current = translatedNav.get(entry.path);
        return {
          path: entry.path,
          key: entry.key,
          source: entry.value,
          target: current && current !== entry.value ? current : '',
        };
      }),
      words: (Object.keys(MESSAGES) as MessageKey[]).map((key) => ({
        key,
        source: MESSAGES[key],
        target: typeof storedMessages[key] === 'string' ? (storedMessages[key] as string) : '',
      })),
    });
  });
}

const schema = z.object({
  locale: z.string().trim().min(2).max(8),
  site: z.record(z.string(), z.string().max(500)).default({}),
  menus: z.record(z.string(), z.string().max(500)).default({}),
  words: z.record(z.string(), z.string().max(1000)).default({}),
});

export async function PUT(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'settings:write');
    if (!guard.ok) return guard.response;

    const parsed = await readJson(request, schema);
    if (!parsed.ok) return parsed.response;
    const input = parsed.data;

    const config = localeConfig();
    if (!config.locales.includes(input.locale)) return badRequest('That language is not configured.');
    if (input.locale === config.defaultLocale) {
      return badRequest('The main language is the original; edit it in Settings and Menus.');
    }

    const suffix = (key: string) => localeKey(key, input.locale, config.defaultLocale);

    // The site's own details, one key at a time — a site can translate its
    // tagline without restating its contact address.
    for (const key of SITE_KEYS) {
      const value = input.site[key];
      if (typeof value === 'string' && value.trim() !== '') {
        await writeSetting(suffix(key), value, guard.user.id);
      }
    }

    // Menus: the original's structure with the translated labels in it, so a
    // menu cannot gain or lose an item per language.
    if (Object.keys(input.menus).length > 0) {
      const raw = await readRaw([NAVIGATION_KEY]);
      const sourceNav = raw.get(NAVIGATION_KEY);
      if (sourceNav) {
        await writeSetting(suffix(NAVIGATION_KEY), applyStrings(sourceNav, input.menus), guard.user.id);
      }
    }

    // The engine's own words. Unknown keys are dropped rather than stored:
    // the catalogue is the contract.
    const words: Record<string, string> = {};
    for (const [key, value] of Object.entries(input.words)) {
      if (key in MESSAGES && typeof value === 'string' && value.trim() !== '') words[key] = value;
    }
    if (Object.keys(words).length > 0) {
      await writeSetting(suffix(MESSAGES_SETTING_KEY), words, guard.user.id);
    }

    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: 'site.translations.update',
      targetType: 'site',
      summary: `Updated the ${input.locale} translation of the site's menus, details and wording`,
      ip: clientIp(request.headers),
    });

    // The menus and the wording are in every page's chrome.
    revalidateEverything();

    return ok({ locale: input.locale, saved: true });
  });
}
