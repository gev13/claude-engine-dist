import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { LocaleLinksProvider } from '@/components/ui/LocaleLinks';
import Link from '@/components/ui/SiteLink';
import { parseLocales, withLocale } from '@/lib/locales';

/* 3.30.1 — on a page in another language, the links the engine writes stay
   in that language. The default language's links are left exactly as they
   were. */

vi.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => ({ push() {} }) }));

const config = parseLocales('en,ru,hy');

describe('withLocale', () => {
  it('prefixes a site path on a page in another language', () => {
    expect(withLocale('/', 'ru', config)).toBe('/ru');
    expect(withLocale('/blog/first-post', 'ru', config)).toBe('/ru/blog/first-post');
    expect(withLocale('/careers/designer?ref=list#apply', 'hy', config)).toBe('/hy/careers/designer?ref=list#apply');
    expect(withLocale('/?q=cocoa', 'ru', config)).toBe('/ru?q=cocoa');
  });
  it('leaves the default language alone', () => {
    for (const href of ['/', '/blog/first-post', '/careers']) expect(withLocale(href, 'en', config)).toBe(href);
    expect(withLocale('/about', undefined, config)).toBe('/about');
  });
  it('never prefixes twice, and leaves a link to another language as it is', () => {
    expect(withLocale('/ru/blog/first-post', 'ru', config)).toBe('/ru/blog/first-post');
    expect(withLocale('/hy', 'ru', config)).toBe('/hy');
    expect(withLocale('/en/about', 'ru', config)).toBe('/en/about');
  });
  it('leaves files, the app’s own routes and anything off the site alone', () => {
    for (const href of ['/media/2026/10/a.webp', '/_next/static/x.js', '/api/forms', '/admin', '/llms.txt', '/blog/feed.xml', '/sitemaps/pages.xml']) {
      expect(withLocale(href, 'ru', config)).toBe(href);
    }
    for (const href of ['https://example.com/', '//example.com/x', 'mailto:a@example.com', 'tel:+100', '#cookie-settings', 'about']) {
      expect(withLocale(href, 'ru', config)).toBe(href);
    }
  });
  it('ignores a language the site does not have', () => {
    expect(withLocale('/about', 'de', config)).toBe('/about');
  });
});

describe('SiteLink', () => {
  const page = (locale: string, href: string) =>
    renderToStaticMarkup(
      <LocaleLinksProvider value={{ locale, defaultLocale: config.defaultLocale, locales: config.locales }}>
        <Link href={href}>x</Link>
      </LocaleLinksProvider>,
    );
  it('writes the page’s language into a site path', () => {
    expect(page('ru', '/blog/first-post')).toContain('href="/ru/blog/first-post"');
    expect(page('ru', '/')).toContain('href="/ru"');
  });
  it('renders exactly what it did in the default language and outside the site', () => {
    expect(page('en', '/blog/first-post')).toBe(renderToStaticMarkup(<Link href="/blog/first-post">x</Link>));
    expect(renderToStaticMarkup(<Link href="/about">x</Link>)).toContain('href="/about"');
  });
});

describe('a page with no translation', () => {
  it('goes to the main language’s page, after the managed redirects and before the 404', async () => {
    vi.resetModules();
    const calls: string[] = [];
    vi.doMock('next/navigation', () => ({
      redirect: (to: string) => {
        calls.push(`redirect ${to}`);
        throw new Error('NEXT_REDIRECT');
      },
      permanentRedirect: (to: string) => {
        calls.push(`permanent ${to}`);
        throw new Error('NEXT_REDIRECT');
      },
      notFound: () => {
        calls.push('404');
        throw new Error('NEXT_NOT_FOUND');
      },
    }));
    vi.doMock('@/server/content/redirects', () => ({ findRedirect: async () => null, recordNotFound: async () => calls.push('logged') }));
    const { handleMiss } = await import('@/server/content/miss');
    await expect(handleMiss('/about', async () => '/about')).rejects.toThrow('NEXT_REDIRECT');
    await expect(handleMiss('/gone', async () => null)).rejects.toThrow('NEXT_NOT_FOUND');
    await expect(handleMiss('/gone')).rejects.toThrow('NEXT_NOT_FOUND');
    expect(calls).toEqual(['redirect /about', 'logged', '404', 'logged', '404']);
    vi.doUnmock('next/navigation');
    vi.doUnmock('@/server/content/redirects');
  });
});
