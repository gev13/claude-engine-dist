import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { requestHost, wwwRedirectTarget } from '@/lib/host';
import { PORTABLE_SEO_KEYS, SITE_SETTING_FIELDS, parseSiteSettings } from '@/lib/siteSettings';
import { isPortableSettingKey } from '@/server/engine/transfer';

/* 3.21 — Settings → "Redirect www to the bare domain". */

const read = (file: string) => readFileSync(path.join(process.cwd(), file), 'utf8');
const headers = (map: Record<string, string>) => ({ get: (name: string) => map[name] ?? null });
const go = (host: string, extra: Partial<Parameters<typeof wwwRedirectTarget>[0]> = {}) =>
  wwwRedirectTarget({ enabled: true, host, siteUrl: 'https://example.com', path: '/about', search: '?a=1', ...extra });

describe('the host a request was made to', () => {
  it('prefers the proxy’s forwarded host, lower-cased, without a port', () => {
    expect(requestHost(headers({ host: 'WWW.Example.com:443' }))).toBe('www.example.com');
    expect(requestHost(headers({ host: '127.0.0.1:3000', 'x-forwarded-host': 'www.example.com, proxy.internal' }))).toBe('www.example.com');
    expect(requestHost(headers({}))).toBe('');
  });
});

describe('where a www request goes', () => {
  it('goes to the site’s own address, path and query kept', () => {
    expect(go('www.example.com')).toBe('https://example.com/about?a=1');
    expect(go('www.example.com', { path: '/media/2026/09/a.png', search: '' })).toBe('https://example.com/media/2026/09/a.png');
  });

  it('stays put when switched off, or already bare', () => {
    expect(go('www.example.com', { enabled: false })).toBeNull();
    expect(go('example.com')).toBeNull();
  });

  it('never follows a host that is not the site’s own', () => {
    expect(go('www.evil.example')).toBeNull();
    expect(go('www.example.com.evil.example')).toBeNull();
    expect(go('www.sub.example.com')).toBeNull();
  });

  it('leaves a site whose own address is the www form alone, rather than loop', () => {
    expect(go('www.example.com', { siteUrl: 'https://www.example.com' })).toBeNull();
    expect(go('www.example.com', { siteUrl: 'not a url' })).toBeNull();
  });

  it('never writes a protocol-relative path into the address', () => {
    expect(go('www.example.com', { path: '//evil.example/x' })).toBe('https://example.com/?a=1');
  });
});

describe('the setting', () => {
  it('is a Settings switch that is never exported', () => {
    expect(SITE_SETTING_FIELDS['seo.wwwRedirect']).toBe('wwwRedirect');
    expect((PORTABLE_SEO_KEYS as readonly string[]).includes('seo.wwwRedirect')).toBe(false);
    expect(isPortableSettingKey('seo.wwwRedirect')).toBe(false);
    expect(parseSiteSettings({ wwwRedirect: true })).toEqual({ wwwRedirect: true });
  });

  it('reaches the middleware through the routing cache, cleared on save', () => {
    expect(read('src/server/routing/config.ts')).toContain('wwwRedirect: byKey.get(WWW_SETTING_KEY) === true');
    expect(read('src/app/api/admin/settings/route.ts')).toContain('invalidateRouting();');
    const middleware = read('src/middleware.ts');
    // First thing the middleware does, before the admin gate and the locale rewrite.
    expect(middleware.indexOf('wwwRedirectTarget({')).toBeLessThan(middleware.indexOf("pathname.startsWith('/admin')"));
    // Every www request, files included — and still never the API, whose bodies must arrive untouched.
    expect(middleware).toContain(`{ source: '/((?!api/).*)', has: [{ type: 'header', key: 'host', value: 'www\\\\..*' }] }`);
    expect(middleware).toContain(`{ source: '/((?!api/).*)', has: [{ type: 'header', key: 'x-forwarded-host', value: 'www\\\\..*' }] }`);
    // A file that only the www matchers let in is served untouched.
    expect(middleware).toContain('if (OUTSIDE_SITE.test(pathname)) return NextResponse.next();');
  });
});
