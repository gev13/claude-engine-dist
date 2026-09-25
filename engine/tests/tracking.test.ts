import { describe, expect, it } from 'vitest';
import { captchaApplies, captchaSettingsSchema, publicCaptcha } from '@/lib/captcha';
import { consentVersion, cookieNoticeSchema, decodeConsent, encodeConsent, choiceKind } from '@/lib/cookies';
import { CSP_ORIGIN, buildCsp, mergeSources } from '@/lib/csp';
import { integrationSources, resolveIntegrations, sourceHosts, thirdParties } from '@/lib/integrations';
import { loaderSource } from '@/server/integrations/loader';
import { publicCsp } from '@/server/routing/config';

/* 2.16 — tags, consent, the policy they add up to, and the CAPTCHA switch. */

const gate = { gate: false, version: 8, cookie: 'he_consent', regionRequired: false, regionCookie: 'he_region' };

describe('the integrations loader', () => {
  it('loads nothing when nothing is switched on', () => {
    const source = loaderSource(resolveIntegrations(undefined), gate);
    // The vendors' loaders are written in; the list of what to load is empty.
    const config = JSON.parse(/var C = (.*);\n/.exec(source)![1]!) as { items: unknown[] };
    expect(config.items).toEqual([]);
    // heTrack still exists, so a form's conversion call is always safe.
    expect(source).toContain('w.heTrack');
  });

  it('sets the consent default before any Google tag', () => {
    const settings = resolveIntegrations({ consentMode: true, ga4: { enabled: true, id: 'G-ABC1234567' } });
    const source = loaderSource(settings, { ...gate, gate: true });
    expect(source).toContain('G-ABC1234567');
    const consentAt = source.indexOf("'consent', 'default'") >= 0 ? source.indexOf("'consent', 'default'") : source.indexOf("'consent','default'");
    expect(consentAt).toBeGreaterThan(-1);
    expect(consentAt).toBeLessThan(source.indexOf('googletagmanager.com/gtag/js'));
  });

  it('leaves out an id that does not match its vendor', () => {
    const settings = resolveIntegrations({ ga4: { enabled: true, id: 'G-1"</script><script>alert(1)//' } });
    expect(loaderSource(settings, gate)).not.toContain('alert(1)');
  });
});

describe('the public content policy', () => {
  it('is the base policy with nothing switched on', () => {
    expect(publicCsp(new Map())).toBe(buildCsp({ isProd: process.env.NODE_ENV === 'production' }));
  });

  it('adds a tag’s hosts only while it is on', () => {
    const on = publicCsp(new Map([['integrations', { meta: { enabled: true, id: '123456789012345' } }]]));
    expect(on).toContain('https://connect.facebook.net');
    const off = publicCsp(new Map([['integrations', { meta: { enabled: false, id: '123456789012345' } }]]));
    expect(off).not.toContain('facebook');
  });

  it('adds the CAPTCHA provider’s hosts', () => {
    const csp = publicCsp(new Map([['captcha', { provider: 'turnstile', siteKey: '1x00000000000000000000AA' }]]));
    expect(csp).toMatch(/script-src[^;]*https:\/\/challenges\.cloudflare\.com/);
    expect(csp).toMatch(/frame-src[^;]*https:\/\/challenges\.cloudflare\.com/);
  });

  it('keeps a legacy GA4 id working until integrations are saved', () => {
    expect(publicCsp(new Map([['code', { analyticsId: 'G-ABC1234567' }]]))).toContain('googletagmanager');
    expect(publicCsp(new Map<string, unknown>([['code', { analyticsId: 'G-ABC1234567' }], ['integrations', {}]]))).not.toContain('googletagmanager');
  });

  it('accepts only plain https origins from an editor', () => {
    expect(CSP_ORIGIN.test('https://cdn.example.com')).toBe(true);
    expect(CSP_ORIGIN.test('https://*.example.com')).toBe(true);
    expect(CSP_ORIGIN.test("https://example.com 'unsafe-eval'")).toBe(false);
    expect(CSP_ORIGIN.test('https://example.com; script-src *')).toBe(false);
    expect(CSP_ORIGIN.test('http://example.com')).toBe(false);
  });

  it('merges sources without repeating a host', () => {
    expect(mergeSources({ script: ['https://a.com'] }, { script: ['https://a.com', 'https://b.com'] }).script).toEqual(['https://a.com', 'https://b.com']);
  });

  it('names every third party with its hosts', () => {
    const settings = resolveIntegrations({ ga4: { enabled: true, id: 'G-ABC1234567' } });
    const list = thirdParties(settings);
    expect(list.map((p) => p.name)).toEqual(['Google Analytics 4']);
    expect(list[0]!.hosts).toEqual(expect.arrayContaining(sourceHosts(integrationSources(settings))));
  });
});

describe('the consent cookie', () => {
  const notice = cookieNoticeSchema.parse({ enabled: true, mode: 'consent', categories: { analytics: { enabled: true }, marketing: { enabled: true } } });

  it('reads back what was written', () => {
    const version = consentVersion(notice);
    const raw = encodeConsent({ analytics: true, marketing: false, preferences: false }, version);
    expect(decodeConsent(raw, version)).toEqual({ analytics: true, marketing: false, preferences: false });
  });

  it('is asked again when the categories on offer change', () => {
    const before = consentVersion(notice);
    const after = consentVersion({ ...notice, categories: { ...notice.categories, preferences: { ...notice.categories.preferences, enabled: true } } });
    expect(after).not.toBe(before);
    expect(decodeConsent(encodeConsent({ analytics: true, marketing: true, preferences: false }, before), after)).toBeNull();
  });

  it('is asked again after “Ask everyone again”', () => {
    expect(consentVersion({ ...notice, version: notice.version + 1 })).not.toBe(consentVersion(notice));
  });

  it('treats a mangled cookie as no answer rather than throwing', () => {
    expect(decodeConsent('%E0%A4%A', 8)).toBeNull();
    expect(decodeConsent('', 8)).toBeNull();
  });

  it('counts answers the way the anonymous log does', () => {
    expect(choiceKind({ analytics: true, marketing: true, preferences: true }, ['analytics', 'marketing'])).toBe('accepted');
    expect(choiceKind({ analytics: false, marketing: false, preferences: false }, ['analytics', 'marketing'])).toBe('rejected');
    expect(choiceKind({ analytics: true, marketing: false, preferences: false }, ['analytics', 'marketing'])).toBe('custom');
  });
});

describe('CAPTCHA', () => {
  const settings = captchaSettingsSchema.parse({ provider: 'turnstile', siteKey: '1x00000000000000000000AA' });

  it('is off by default, and never on the admin sign-in unless chosen', () => {
    const defaults = captchaSettingsSchema.parse({});
    expect(defaults.provider).toBe('none');
    expect(defaults.surfaces.login).toBe(false);
    expect(defaults.surfaces.form).toBe(true);
  });

  it('tells the page nothing until both keys are held', () => {
    expect(publicCaptcha(settings, false)).toBeNull();
    const shown = publicCaptcha(settings, true);
    expect(shown).toMatchObject({ provider: 'turnstile', siteKey: '1x00000000000000000000AA' });
    expect(JSON.stringify(shown)).not.toContain('secret');
  });

  it('lets a form override the site’s choice either way', () => {
    const on = publicCaptcha({ ...settings, surfaces: { ...settings.surfaces, form: false } }, true);
    expect(captchaApplies(on, 'form')).toBe(false);
    expect(captchaApplies(on, 'form', 'on')).toBe(true);
    expect(captchaApplies(publicCaptcha(settings, true), 'form', 'off')).toBe(false);
    expect(captchaApplies(null, 'form', 'on')).toBe(false);
  });

  it('refuses a site key that could break out of the page', () => {
    expect(captchaSettingsSchema.safeParse({ provider: 'turnstile', siteKey: 'abc"></script>' }).success).toBe(false);
  });
});
