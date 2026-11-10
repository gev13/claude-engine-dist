import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SITE_SETTING_FIELDS, parseSiteSettings } from '@/lib/siteSettings';
import { SECURITY_TXT_PATH, contactUri, expiryOf, securityTxt } from '@/lib/securityTxt';

/* 3.32 — /.well-known/security.txt (RFC 9116) from five Settings fields.
   Off until it has a contact and an expiry ahead; a passed expiry stops it. */

const settings = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock('@/server/content/siteSettings', () => ({ getSiteSettings: async () => settings.value }));

const NOW = new Date('2026-11-10T12:00:00.000Z');
const SITE = 'https://example.com';

describe('the file', () => {
  it('writes the RFC shape, Canonical from the site address', () => {
    const state = securityTxt({ contact: ['security@example.com'], expires: '2027-10-31', languages: ['en'] }, SITE, NOW);
    expect(state).toMatchObject({ serving: true });
    if (state.serving) {
      expect(state.body).toBe(
        'Contact: mailto:security@example.com\nExpires: 2027-10-31T23:59:59.000Z\nPreferred-Languages: en\nCanonical: https://example.com/.well-known/security.txt\n',
      );
    }
  });

  it('carries every field it is given, in order, and several contacts', () => {
    const state = securityTxt(
      {
        contact: ['mailto:sec@example.com', 'https://example.com/report', 'tel:+44 20 1234 5678'],
        expires: '2027-06-01T00:00:00Z',
        languages: ['en', 'hy'],
        encryption: 'https://example.com/pgp-key.txt',
        policy: 'https://example.com/disclosure',
      },
      `${SITE}/`,
      NOW,
    );
    expect(state.serving && state.body.split('\n')).toEqual([
      'Contact: mailto:sec@example.com',
      'Contact: https://example.com/report',
      'Contact: tel:+44 20 1234 5678',
      'Expires: 2027-06-01T00:00:00.000Z',
      'Encryption: https://example.com/pgp-key.txt',
      'Preferred-Languages: en, hy',
      'Canonical: https://example.com/.well-known/security.txt',
      'Policy: https://example.com/disclosure',
      '',
    ]);
  });

  it('is not served without a contact, without an expiry, or once the expiry has passed', () => {
    expect(securityTxt({}, SITE, NOW)).toMatchObject({ serving: false, reason: expect.stringMatching(/contact/) });
    expect(securityTxt({ contact: ['a@example.com'] }, SITE, NOW)).toMatchObject({ serving: false, reason: expect.stringMatching(/expiry/) });
    expect(securityTxt({ contact: ['a@example.com'], expires: '2026-11-09' }, SITE, NOW)).toMatchObject({ serving: false, reason: expect.stringMatching(/has passed/) });
    // The expiry day itself still counts.
    expect(securityTxt({ contact: ['a@example.com'], expires: '2026-11-10' }, SITE, NOW).serving).toBe(true);
  });

  it('warns about an expiry more than a year ahead or less than a month away', () => {
    expect(securityTxt({ contact: ['a@example.com'], expires: '2028-01-01' }, SITE, NOW).notes.join()).toMatch(/less than a year/);
    expect(securityTxt({ contact: ['a@example.com'], expires: '2026-11-20' }, SITE, NOW).notes.join()).toMatch(/set a later date/);
  });

  it('leaves out anything that is not an address, and can never be given a second line', () => {
    expect(contactUri('a@example.com\nExpires: 2099-01-01')).toBeNull();
    expect(contactUri('javascript:alert(1)')).toBeNull();
    expect(contactUri('http://example.com/report')).toBeNull();
    expect(expiryOf('2027-10-31\nContact: x')).toBeNull();
    expect(expiryOf('next year')).toBeNull();
    const state = securityTxt(
      { contact: ['not an address', 'a@example.com'], expires: '2027-01-01', encryption: 'ftp://x', policy: 'https://x.test/p\nContact: mailto:evil@x.test', languages: ['en', 'not a tag'] },
      SITE,
      NOW,
    );
    expect(state.serving).toBe(true);
    if (state.serving) {
      expect(state.body).not.toContain('evil');
      expect(state.body).not.toContain('ftp:');
      expect(state.body.match(/^Contact:/gm)).toHaveLength(1);
      expect(state.body).toContain('Preferred-Languages: en\n');
    }
    expect(state.notes.length).toBeGreaterThanOrEqual(3);
  });
});

describe('the settings behind it', () => {
  it('are Settings keys, read and checked like the others', () => {
    for (const key of ['securitytxt.contact', 'securitytxt.expires', 'securitytxt.languages', 'securitytxt.encryption', 'securitytxt.policy']) {
      expect(Object.keys(SITE_SETTING_FIELDS)).toContain(key);
    }
    expect(parseSiteSettings({ securityContact: ['a@example.com'], securityLanguages: ['en', 'x y'] })).toEqual({ securityContact: ['a@example.com'] });
  });
});

describe('the route', () => {
  beforeEach(() => {
    settings.value = {};
  });

  it('answers 404 until filled in, then plain text', async () => {
    const { GET } = await import('../src/app/.well-known/security.txt/route');
    expect((await GET()).status).toBe(404);
    settings.value = { securityContact: ['security@example.com'], securityExpires: '2099-01-01' };
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/plain; charset=utf-8');
    const body = await res.text();
    expect(body).toMatch(/^Contact: mailto:security@example\.com\nExpires: 2099-01-01T23:59:59\.000Z\n/);
    expect(body).toContain(`Canonical: `);
    expect(body).toContain(SECURITY_TXT_PATH);
  });
});
