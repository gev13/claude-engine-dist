import { describe, expect, it } from 'vitest';
import { buildMetadata } from '@/lib/seo/metadata';
import { urlSet } from '@/lib/seo/sitemap';
import { parseLocales } from '@/lib/locales';

/** The three the Wellar site is configured for. */
const LANGS = parseLocales('en,hy,ru');

/* ═══════════════════════════════════════════════════════════════════════════
   Multilingual SEO
   ───────────────────────────────────────────────────────────────────────────
   Two mistakes here are worse than having no translations at all, and neither
   shows up by looking at the site:

     • a canonical pointing at another language tells Google the translation is
       a duplicate and should not be indexed;
     • an hreflang set that is not reciprocal and self-referential is discarded
       in full.

   So both are pinned rather than eyeballed.
   ═══════════════════════════════════════════════════════════════════════════ */

const THREE = [
  { locale: 'en' as const, path: '/about' },
  { locale: 'hy' as const, path: '/mer-masin' },
  { locale: 'ru' as const, path: '/o-nas' },
];

const base = { title: 'About', description: 'About us', siteName: 'Wellar', config: LANGS };

describe('canonical', () => {
  it('is the page’s own URL in its own language, never the English one', () => {
    const hy = buildMetadata({ ...base, path: '/mer-masin', locale: 'hy', translations: THREE });
    expect(hy.alternates?.canonical).toMatch(/\/hy\/mer-masin$/);

    const ru = buildMetadata({ ...base, path: '/o-nas', locale: 'ru', translations: THREE });
    expect(ru.alternates?.canonical).toMatch(/\/ru\/o-nas$/);
  });

  it('leaves the default locale unprefixed', () => {
    const en = buildMetadata({ ...base, path: '/about', locale: 'en', translations: THREE });
    expect(en.alternates?.canonical).toMatch(/\/about$/);
    expect(en.alternates?.canonical).not.toMatch(/\/en\//);
  });

  it('still honours an explicit canonical from the SEO record', () => {
    const forced = buildMetadata({
      ...base,
      path: '/about',
      locale: 'hy',
      translations: THREE,
      seo: { canonicalUrl: 'https://example.com/elsewhere' },
    });
    expect(forced.alternates?.canonical).toBe('https://example.com/elsewhere');
  });
});

describe('hreflang', () => {
  it('names every language the page exists in, including itself', () => {
    const languages = buildMetadata({ ...base, path: '/mer-masin', locale: 'hy', translations: THREE }).alternates
      ?.languages as Record<string, string>;

    expect(Object.keys(languages).sort()).toEqual(['en', 'hy', 'ru', 'x-default']);
    // Self-referential: the Armenian page lists the Armenian URL.
    expect(languages.hy).toMatch(/\/hy\/mer-masin$/);
    expect(languages.ru).toMatch(/\/ru\/o-nas$/);
    expect(languages.en).toMatch(/\/about$/);
  });

  it('points x-default at the default locale', () => {
    const languages = buildMetadata({ ...base, path: '/o-nas', locale: 'ru', translations: THREE }).alternates
      ?.languages as Record<string, string>;
    expect(languages['x-default']).toBe(languages.en);
  });

  it('is reciprocal — each language produces the same set', () => {
    const sets = THREE.map(
      (t) =>
        buildMetadata({ ...base, path: t.path, locale: t.locale, translations: THREE }).alternates?.languages as Record<
          string,
          string
        >,
    );
    expect(sets[1]).toEqual(sets[0]);
    expect(sets[2]).toEqual(sets[0]);
  });

  it('advertises nothing when a page exists in one language only', () => {
    // Promising a translation that is not there is worse than promising none.
    const alone = buildMetadata({
      ...base,
      path: '/about',
      locale: 'en',
      translations: [{ locale: 'en', path: '/about' }],
    });
    expect(alone.alternates?.languages).toBeUndefined();
  });

  it('advertises nothing when the caller knows of no translations at all', () => {
    expect(buildMetadata({ ...base, path: '/about' }).alternates?.languages).toBeUndefined();
  });
});

describe('open graph locale', () => {
  it('uses the page’s own locale with a territory', () => {
    expect(buildMetadata({ ...base, path: '/mer-masin', locale: 'hy', translations: THREE }).openGraph?.locale).toBe(
      'hy_AM',
    );
    expect(buildMetadata({ ...base, path: '/about', locale: 'en', translations: THREE }).openGraph?.locale).toBe(
      'en_GB',
    );
  });

  it('lists the others as alternates, and never itself', () => {
    const og = buildMetadata({ ...base, path: '/o-nas', locale: 'ru', translations: THREE }).openGraph as {
      alternateLocale?: string[];
    };
    expect(og.alternateLocale).toEqual(['en_GB', 'hy_AM']);
    expect(og.alternateLocale).not.toContain('ru_RU');
  });

  it('defaults to English when no locale is given, as it always did', () => {
    expect(buildMetadata({ ...base, path: '/about' }).openGraph?.locale).toBe('en_GB');
  });
});

describe('the sitemap', () => {
  it('writes each URL at its own localised address', () => {
    const xml = urlSet([{ path: '/mer-masin', locale: 'hy', alternates: THREE }], LANGS);
    expect(xml).toContain('<loc>');
    expect(xml).toMatch(/<loc>[^<]*\/hy\/mer-masin<\/loc>/);
  });

  it('carries every alternate beside the URL, x-default included', () => {
    const xml = urlSet([{ path: '/about', locale: 'en', alternates: THREE }], LANGS);
    expect(xml).toMatch(/hreflang="en"/);
    expect(xml).toMatch(/hreflang="hy"[^>]*\/hy\/mer-masin/);
    expect(xml).toMatch(/hreflang="ru"[^>]*\/ru\/o-nas/);
    expect(xml).toMatch(/hreflang="x-default"/);
  });

  it('is self-referential even for a page with no translations', () => {
    const xml = urlSet([{ path: '/only-english', locale: 'en' }], LANGS);
    expect(xml).toMatch(/hreflang="en"[^>]*\/only-english/);
    expect(xml).toMatch(/hreflang="x-default"[^>]*\/only-english/);
  });

  it('does not emit x-default for a page that has no default-locale version', () => {
    // Armenian only: there is no English URL to nominate as the default.
    const xml = urlSet([{ path: '/miayn-hayeren', locale: 'hy', alternates: [{ locale: 'hy', path: '/miayn-hayeren' }] }], LANGS);
    expect(xml).toMatch(/hreflang="hy"/);
    expect(xml).not.toMatch(/hreflang="x-default"/);
  });

  it('still escapes what it writes', () => {
    const xml = urlSet([{ path: '/a&b', locale: 'en' }], LANGS);
    expect(xml).toContain('&amp;');
    expect(xml).not.toMatch(/<loc>[^<]*[^&]&[^a]/);
  });
});
