import { describe, expect, it } from 'vitest';
import {
  LANGUAGES,
  isKnownLanguage,
  localeDir,
  localeName,
  localePath,
  ogLocale,
  otherLocales,
  parseLocales,
  splitLocale,
} from '@/lib/locales';

/* ═══════════════════════════════════════════════════════════════════════════
   Languages
   ───────────────────────────────────────────────────────────────────────────
   The list is configured per site, not compiled in: a site may speak one
   language or six, and which ones is the operator's choice. Every URL passes
   through `splitLocale` on the way in and `localePath` on the way out, so both
   are pinned hard — a mistake here is not a wrong page, it is every page.
   ═══════════════════════════════════════════════════════════════════════════ */

const ONE = parseLocales('en');
const THREE = parseLocales('en,hy,ru');

describe('parseLocales', () => {
  it('treats the first entry as the default', () => {
    expect(THREE.locales).toEqual(['en', 'hy', 'ru']);
    expect(THREE.defaultLocale).toBe('en');

    const armenianFirst = parseLocales('hy,en');
    expect(armenianFirst.defaultLocale).toBe('hy');
    expect(armenianFirst.locales).toEqual(['hy', 'en']);
  });

  it('knows when a site is monolingual', () => {
    expect(ONE.multilingual).toBe(false);
    expect(THREE.multilingual).toBe(true);
  });

  it('falls back to English rather than leaving a site with no language', () => {
    for (const raw of ['', '   ', ',,,', undefined, null, '!!', 'toolongcode']) {
      const config = parseLocales(raw as string | undefined);
      expect(config.locales, String(raw)).toEqual(['en']);
      expect(config.defaultLocale).toBe('en');
    }
  });

  it('forgives the ways a hand-edited value goes wrong', () => {
    expect(parseLocales(' EN , hy ,, RU ').locales).toEqual(['en', 'hy', 'ru']);
    // A repeat is not two languages.
    expect(parseLocales('en,hy,en').locales).toEqual(['en', 'hy']);
  });

  it('accepts a language the registry has never heard of, if it is well formed', () => {
    // The engine should not be the reason a site cannot publish in Welsh.
    const config = parseLocales('en,cy');
    expect(config.locales).toEqual(['en', 'cy']);
    expect(localeName('cy')).toBe('CY');
    expect(ogLocale('cy')).toBe('cy_CY');
  });

  it('rejects segments that are not language-shaped', () => {
    // `/about` must never be mistaken for a language.
    expect(parseLocales('en,about,blog').locales).toEqual(['en']);
    expect(parseLocales('en,pt-br').locales).toEqual(['en', 'pt-br']);
  });
});

describe('the registry', () => {
  it('names each language in its own language', () => {
    expect(localeName('hy')).toBe('Հայերեն');
    expect(localeName('ru')).toBe('Русский');
    expect(localeName('ja')).toBe('日本語');
  });

  it('gives every entry an English name too, for whoever is choosing one', () => {
    for (const [code, info] of Object.entries(LANGUAGES)) {
      expect(info.english.length, code).toBeGreaterThan(0);
      expect(info.og, code).toMatch(/^[a-z]{2}_[A-Z]{2}$/);
    }
  });

  it('knows which scripts run right to left', () => {
    for (const rtl of ['ar', 'he', 'fa', 'ur']) expect(localeDir(rtl), rtl).toBe('rtl');
    for (const ltr of ['en', 'hy', 'ru', 'ja']) expect(localeDir(ltr), ltr).toBe('ltr');
  });

  it('recognises what it knows and admits what it does not', () => {
    expect(isKnownLanguage('hy')).toBe(true);
    expect(isKnownLanguage('cy')).toBe(false);
    expect(isKnownLanguage(42)).toBe(false);
  });
});

describe('splitLocale', () => {
  it('reads a prefixed path', () => {
    expect(splitLocale('/hy/about', THREE)).toEqual({ locale: 'hy', rest: '/about', prefixed: true });
    expect(splitLocale('/ru/blog/a-post', THREE)).toEqual({ locale: 'ru', rest: '/blog/a-post', prefixed: true });
  });

  it('treats a bare prefix as that language’s home page', () => {
    expect(splitLocale('/hy', THREE)).toEqual({ locale: 'hy', rest: '/', prefixed: true });
  });

  it('reports a prefixed default, so the caller can redirect it away', () => {
    expect(splitLocale('/en/about', THREE)).toEqual({ locale: 'en', rest: '/about', prefixed: true });
  });

  it('ignores a language the site does not speak', () => {
    // /fr is a page called "fr" on a site that has no French.
    expect(splitLocale('/fr/about', THREE)).toEqual({ locale: 'en', rest: '/fr/about', prefixed: false });
  });

  it('on a monolingual site, nothing is ever a prefix', () => {
    expect(splitLocale('/hy/about', ONE)).toEqual({ locale: 'en', rest: '/hy/about', prefixed: false });
  });

  it('does not mistake a page whose slug merely starts like a language', () => {
    expect(splitLocale('/ruby', THREE)).toEqual({ locale: 'en', rest: '/ruby', prefixed: false });
    expect(splitLocale('/hyphenation', THREE)).toEqual({ locale: 'en', rest: '/hyphenation', prefixed: false });
  });

  it('strips trailing slashes, so one page never has two addresses', () => {
    expect(splitLocale('/about/', THREE).rest).toBe('/about');
    expect(splitLocale('/ru/about///', THREE).rest).toBe('/about');
  });
});

describe('localePath', () => {
  it('leaves the default unprefixed and prefixes the rest', () => {
    expect(localePath('en', '/about', THREE)).toBe('/about');
    expect(localePath('hy', '/about', THREE)).toBe('/hy/about');
    expect(localePath('hy', '/', THREE)).toBe('/hy');
  });

  it('follows whichever language is configured first', () => {
    const armenianFirst = parseLocales('hy,en');
    expect(localePath('hy', '/about', armenianFirst)).toBe('/about');
    expect(localePath('en', '/about', armenianFirst)).toBe('/en/about');
  });

  it('round-trips with splitLocale for every configured language', () => {
    for (const config of [ONE, THREE, parseLocales('hy,ru,en')]) {
      for (const locale of config.locales) {
        for (const path of ['/', '/about', '/blog/a-post']) {
          const back = splitLocale(localePath(locale, path, config), config);
          expect(back.locale, `${locale} ${path}`).toBe(locale);
          expect(back.rest, `${locale} ${path}`).toBe(path);
        }
      }
    }
  });
});

describe('otherLocales', () => {
  it('lists the rest in configured order, never itself', () => {
    expect(otherLocales('en', THREE)).toEqual(['hy', 'ru']);
    expect(otherLocales('hy', THREE)).toEqual(['en', 'ru']);
    expect(otherLocales('en', ONE)).toEqual([]);
  });
});
