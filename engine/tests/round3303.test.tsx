/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LanguageSwitcher, readAlternates } from '@/components/site/LanguageSwitcher';
import { parseLocales } from '@/lib/locales';
import { buildMetadata } from '@/lib/seo/metadata';

/* 3.30.3 — the language switcher follows the page it is on, and the blog
   index and research archive say which language they are in. */

vi.mock('next/navigation', () => ({ usePathname: () => window.location.pathname, useRouter: () => ({ push() {} }) }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const setHead = (links: [string, string][], canonical?: string) => {
  document.head.innerHTML =
    (canonical ? `<link rel="canonical" href="${canonical}">` : '') + links.map(([code, href]) => `<link rel="alternate" hreflang="${code}" href="${href}">`).join('');
};

afterEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
});

describe('readAlternates', () => {
  it('gives this site’s addresses as paths and leaves x-default out', () => {
    setHead([['en', `${location.origin}/about`], ['ru', `${location.origin}/ru/about`], ['x-default', `${location.origin}/about`]]);
    expect(readAlternates(document)).toEqual({ en: '/about', ru: '/ru/about' });
  });
  it('counts the canonical’s host as this site, whatever host the page was reached at', () => {
    setHead([['en', 'https://www.example.com/about'], ['ru', 'https://www.example.com/ru/about']], 'https://www.example.com/ru/about');
    expect(readAlternates(document)).toEqual({ en: '/about', ru: '/ru/about' });
  });
  it('keeps another site’s address whole', () => {
    setHead([['en', 'https://elsewhere.example/about']], `${location.origin}/about`);
    expect(readAlternates(document)).toEqual({ en: 'https://elsewhere.example/about' });
  });
});

describe('the switcher after an in-app navigation', () => {
  it('reads the new page’s addresses when the head changes', async () => {
    setHead([['en', `${location.origin}/`], ['ru', `${location.origin}/ru`]]);
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    await act(async () => root.render(<LanguageSwitcher locales={['en', 'ru']} current="ru" defaultLocale="en" look={{ look: 'inline' }} />));
    const hrefs = () => [...host.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(hrefs()).toEqual(['/', '/ru']);
    // Next swaps the head's tags in for the new route without remounting the header.
    await act(async () => {
      setHead([['en', `${location.origin}/about`], ['ru', `${location.origin}/ru/about`]]);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(hrefs()).toEqual(['/about', '/ru/about']);
    await act(async () => root.unmount());
  });
});

describe('the blog index and research archive in another language', () => {
  const config = parseLocales('en,ru,hy');
  it('are their own canonical, with every language in the set', () => {
    const meta = buildMetadata({ title: 'Blog', description: '', path: '/blog', locale: 'ru', translations: config.locales.map((code) => ({ locale: code, path: '/blog' })), config, siteName: 'Northwind' });
    expect(String(meta.alternates?.canonical)).toMatch(/\/ru\/blog$/);
    expect(Object.keys(meta.alternates?.languages ?? {})).toEqual(['en', 'x-default', 'ru', 'hy']);
  });
  it('pass their language and every language from the catch-all, and the careers listing names itself', () => {
    const page = readFileSync(join(__dirname, '../src/app/(site)/[locale]/[[...slug]]/page.tsx'), 'utf8');
    expect(page).toContain('translations: everyLanguage(blogIndexPath(permalinks))');
    expect(page).toContain('translations: everyLanguage(researchPath(permalinks))');
    const careers = readFileSync(join(__dirname, '../src/app/(site)/[locale]/careers/page.tsx'), 'utf8');
    expect(careers).toContain('translations: config.locales.map(');
  });
});
