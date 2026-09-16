import 'server-only';
import { inArray } from 'drizzle-orm';
import { localeConfig, type Locale } from '@/lib/locales';
import { db } from '@/server/db';
import { settings } from '@/server/db/schema';

/* ═══════════════════════════════════════════════════════════════════════════
   Settings that differ per language
   ───────────────────────────────────────────────────────────────────────────
   A translated value lives under a suffixed key: `navigation` is shared,
   `navigation:hy` is the Armenian one. A read asks for the suffixed key and
   falls back to the shared one, so a language nobody has translated yet still
   renders — in the main language — rather than rendering nothing.

   The alternative was a `locale` column on `settings`, but `key` is that
   table's primary key: changing it would be a disruptive migration on the row
   holding the install marker and the encrypted mail configuration, and every
   `eq(settings.key, …)` in the engine would start matching several rows.

   Secrets and policy — `mail`, `security`, `install.completed` — are simply
   never suffixed. There is no such thing as an Armenian SMTP password.
   ═══════════════════════════════════════════════════════════════════════════ */

/** `navigation` + `hy` → `navigation:hy`. The default language uses the bare key. */
export function localeKey(key: string, locale: Locale, defaultLocale: Locale): string {
  return locale === defaultLocale ? key : `${key}:${locale}`;
}

/** Split `navigation:hy` back into its parts. */
export function splitLocaleKey(key: string): { key: string; locale: Locale | null } {
  const at = key.lastIndexOf(':');
  if (at <= 0) return { key, locale: null };
  return { key: key.slice(0, at), locale: key.slice(at + 1) };
}

/**
 * Read one settings value for a language, falling back to the shared one.
 *
 * Both rows are fetched in a single query rather than two round trips — this
 * runs in the site layout, on every page.
 */
export async function readLocalised(key: string, locale?: Locale): Promise<unknown | undefined> {
  const config = localeConfig();
  const wanted = locale ?? config.defaultLocale;
  const suffixed = localeKey(key, wanted, config.defaultLocale);

  try {
    const rows = await db
      .select()
      .from(settings)
      .where(inArray(settings.key, suffixed === key ? [key] : [suffixed, key]));

    const translated = rows.find((row) => row.key === suffixed);
    if (translated && translated.value !== null && translated.value !== undefined) return translated.value;
    return rows.find((row) => row.key === key)?.value;
  } catch {
    return undefined;
  }
}

/**
 * Read several keys at once for a language, each falling back to its shared
 * value. Returns a map keyed by the **unsuffixed** name, so callers never see
 * the suffix.
 */
export async function readLocalisedMany(keys: readonly string[], locale?: Locale): Promise<Record<string, unknown>> {
  const config = localeConfig();
  const wanted = locale ?? config.defaultLocale;
  const suffixed = keys.map((key) => localeKey(key, wanted, config.defaultLocale));

  const out: Record<string, unknown> = {};
  try {
    const rows = await db
      .select()
      .from(settings)
      .where(inArray(settings.key, [...new Set([...keys, ...suffixed])]));

    const byKey = new Map(rows.map((row) => [row.key, row.value]));
    for (const key of keys) {
      const translated = byKey.get(localeKey(key, wanted, config.defaultLocale));
      out[key] = translated !== undefined && translated !== null ? translated : byKey.get(key);
    }
  } catch {
    /* an unreachable database leaves the bundled fallbacks in place */
  }
  return out;
}
