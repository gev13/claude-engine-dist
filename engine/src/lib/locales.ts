/* ═══════════════════════════════════════════════════════════════════════════
   Languages — a registry, and whatever this site is configured to use
   ───────────────────────────────────────────────────────────────────────────
   This file imports nothing, deliberately. The middleware runs on the Edge
   runtime, where there is no database, and it has to decide whether `/hy` is a
   language or a page called "hy" before anything else happens.

   So the configured list comes from the environment — `ENGINE_LOCALES`, an
   ordered list whose **first entry is the default** and is served unprefixed.
   The installer writes it, Settings edits it, and a restart applies it. That
   is not a limitation of taste: Edge middleware reads `process.env` per
   request (measured, not assumed), so a restart is genuinely enough, while a
   database lookup is not available to it at any price.

   A site with one language sets `ENGINE_LOCALES=en` and never sees any of
   this: no prefixes, no switcher, no hreflang.
   ═══════════════════════════════════════════════════════════════════════════ */

export type LanguageInfo = {
  /** What the language calls itself. Never the English name — a switcher that
   *  says "Armenian" to an Armenian reader is a switcher written for us. */
  name: string;
  /** For the admin, where somebody is choosing from a list in English. */
  english: string;
  /** Open Graph wants language_TERRITORY. */
  og: string;
  /** Right-to-left scripts. Sets `dir` on <html>. */
  rtl?: true;
};

/**
 * Languages the engine knows how to label. Adding one here is all that is
 * needed for a site to be able to configure it — the routing, SEO and switcher
 * are generic.
 */
export const LANGUAGES: Record<string, LanguageInfo> = {
  en: { name: 'English', english: 'English', og: 'en_GB' },
  hy: { name: 'Հայերեն', english: 'Armenian', og: 'hy_AM' },
  ru: { name: 'Русский', english: 'Russian', og: 'ru_RU' },
  ar: { name: 'العربية', english: 'Arabic', og: 'ar_AR', rtl: true },
  az: { name: 'Azərbaycan', english: 'Azerbaijani', og: 'az_AZ' },
  bg: { name: 'Български', english: 'Bulgarian', og: 'bg_BG' },
  bn: { name: 'বাংলা', english: 'Bengali', og: 'bn_BD' },
  cs: { name: 'Čeština', english: 'Czech', og: 'cs_CZ' },
  da: { name: 'Dansk', english: 'Danish', og: 'da_DK' },
  de: { name: 'Deutsch', english: 'German', og: 'de_DE' },
  el: { name: 'Ελληνικά', english: 'Greek', og: 'el_GR' },
  es: { name: 'Español', english: 'Spanish', og: 'es_ES' },
  et: { name: 'Eesti', english: 'Estonian', og: 'et_EE' },
  fa: { name: 'فارسی', english: 'Persian', og: 'fa_IR', rtl: true },
  fi: { name: 'Suomi', english: 'Finnish', og: 'fi_FI' },
  fr: { name: 'Français', english: 'French', og: 'fr_FR' },
  ka: { name: 'ქართული', english: 'Georgian', og: 'ka_GE' },
  he: { name: 'עברית', english: 'Hebrew', og: 'he_IL', rtl: true },
  hi: { name: 'हिन्दी', english: 'Hindi', og: 'hi_IN' },
  hr: { name: 'Hrvatski', english: 'Croatian', og: 'hr_HR' },
  hu: { name: 'Magyar', english: 'Hungarian', og: 'hu_HU' },
  id: { name: 'Bahasa Indonesia', english: 'Indonesian', og: 'id_ID' },
  it: { name: 'Italiano', english: 'Italian', og: 'it_IT' },
  ja: { name: '日本語', english: 'Japanese', og: 'ja_JP' },
  kk: { name: 'Қазақша', english: 'Kazakh', og: 'kk_KZ' },
  ko: { name: '한국어', english: 'Korean', og: 'ko_KR' },
  lt: { name: 'Lietuvių', english: 'Lithuanian', og: 'lt_LT' },
  lv: { name: 'Latviešu', english: 'Latvian', og: 'lv_LV' },
  ms: { name: 'Bahasa Melayu', english: 'Malay', og: 'ms_MY' },
  nl: { name: 'Nederlands', english: 'Dutch', og: 'nl_NL' },
  no: { name: 'Norsk', english: 'Norwegian', og: 'nb_NO' },
  pl: { name: 'Polski', english: 'Polish', og: 'pl_PL' },
  pt: { name: 'Português', english: 'Portuguese', og: 'pt_PT' },
  ro: { name: 'Română', english: 'Romanian', og: 'ro_RO' },
  sk: { name: 'Slovenčina', english: 'Slovak', og: 'sk_SK' },
  sl: { name: 'Slovenščina', english: 'Slovenian', og: 'sl_SI' },
  sr: { name: 'Српски', english: 'Serbian', og: 'sr_RS' },
  sv: { name: 'Svenska', english: 'Swedish', og: 'sv_SE' },
  th: { name: 'ไทย', english: 'Thai', og: 'th_TH' },
  tr: { name: 'Türkçe', english: 'Turkish', og: 'tr_TR' },
  uk: { name: 'Українська', english: 'Ukrainian', og: 'uk_UA' },
  ur: { name: 'اردو', english: 'Urdu', og: 'ur_PK', rtl: true },
  uz: { name: "O'zbekcha", english: 'Uzbek', og: 'uz_UZ' },
  vi: { name: 'Tiếng Việt', english: 'Vietnamese', og: 'vi_VN' },
  zh: { name: '中文', english: 'Chinese', og: 'zh_CN' },
};

/** A locale code this engine has a label for. */
export type Locale = string;

export function isKnownLanguage(code: unknown): code is Locale {
  return typeof code === 'string' && Object.prototype.hasOwnProperty.call(LANGUAGES, code);
}

export function languageInfo(code: Locale): LanguageInfo {
  return LANGUAGES[code] ?? { name: code.toUpperCase(), english: code.toUpperCase(), og: `${code}_${code.toUpperCase()}` };
}

export function localeName(code: Locale): string {
  return languageInfo(code).name;
}

export function ogLocale(code: Locale): string {
  return languageInfo(code).og;
}

export function localeDir(code: Locale): 'ltr' | 'rtl' {
  return languageInfo(code).rtl ? 'rtl' : 'ltr';
}

/* ── What this site is configured to speak ────────────────────────────────── */

export type LocaleConfig = {
  /** In order. The first is the default and is served without a prefix. */
  locales: Locale[];
  defaultLocale: Locale;
  /** True when more than one language is configured. */
  multilingual: boolean;
};

export const LOCALES_ENV = 'ENGINE_LOCALES';

/**
 * Parse an `ENGINE_LOCALES` value. Pure, so it can be tested without an
 * environment — and forgiving, because a malformed value must not take a site
 * down. Anything unrecognisable falls back to English alone.
 */
export function parseLocales(raw: string | undefined | null): LocaleConfig {
  const seen: Locale[] = [];
  for (const part of (raw ?? '').split(',')) {
    const code = part.trim().toLowerCase();
    if (!code) continue;
    // Shape first, registry second: an unknown but well-formed code still
    // works, it just gets a plain label.
    if (!/^[a-z]{2,3}(-[a-z]{2,4})?$/.test(code)) continue;
    if (!seen.includes(code)) seen.push(code);
  }
  const locales = seen.length > 0 ? seen : ['en'];
  return { locales, defaultLocale: locales[0]!, multilingual: locales.length > 1 };
}

/**
 * The configured languages, from the environment.
 *
 * Safe on the Edge runtime and on the server; **not** for client components,
 * which are given the list as props by whatever server component renders them.
 */
export function localeConfig(): LocaleConfig {
  return parseLocales(process.env[LOCALES_ENV]);
}

/* ── Paths ────────────────────────────────────────────────────────────────── */

/**
 * Split a path into its locale and the rest, against a configured list.
 *
 * `prefixed` says whether the locale was actually in the URL, which is how the
 * middleware tells `/en/about` (a second address: redirect) from `/about`
 * (the real one: rewrite).
 */
export function splitLocale(
  pathname: string,
  config: LocaleConfig,
): { locale: Locale; rest: string; prefixed: boolean } {
  const trimmed = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const [, first = '', ...others] = trimmed.split('/');
  const candidate = first.toLowerCase();

  if (config.locales.includes(candidate)) {
    const rest = `/${others.join('/')}`.replace(/\/+$/, '') || '/';
    return { locale: candidate, rest, prefixed: true };
  }

  return { locale: config.defaultLocale, rest: trimmed.replace(/\/+$/, '') || '/', prefixed: false };
}

/** Build the public URL for a path in a language. The default is unprefixed. */
export function localePath(locale: Locale, path: string, config: LocaleConfig): string {
  const clean = (path.startsWith('/') ? path : `/${path}`).replace(/\/+$/, '') || '/';
  if (locale === config.defaultLocale) return clean;
  return clean === '/' ? `/${locale}` : `/${locale}${clean}`;
}

/** The other configured languages, in configured order. */
export function otherLocales(locale: Locale, config: LocaleConfig): Locale[] {
  return config.locales.filter((candidate) => candidate !== locale);
}
