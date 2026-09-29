import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { organization, website } from '@/lib/seo/jsonld';
import { PORTABLE_SEO_KEYS, SITE_SETTING_FIELDS, parseSiteSettings, siteSettingsSchema } from '@/lib/siteSettings';
import { isPortableSettingKey } from '@/server/engine/transfer';
import { checkSetting } from '@/server/engine/importCheck';
import { seoSchema } from '@/server/api/schemas';

/* 3.18 — search engines: the organization in full, a search box only where
   there is a search, the SEO settings travelling with an export, and the
   page editor's "exactly this title" saving. */

const base = { name: 'Northfold', description: 'A site.' };

describe('the Organization node', () => {
  it('adds each organization detail only when set', () => {
    const bare = organization(base);
    for (const key of ['legalName', 'alternateName', 'foundingDate', 'telephone', 'address', 'image']) expect(bare).not.toHaveProperty(key);
    const full = organization({
      ...base,
      contactEmail: 'hello@example.com',
      legalName: 'Northfold Ltd',
      alternateName: 'North Fold',
      foundingDate: '2024',
      phone: '+44 20 1234 5678',
      addressLocality: 'London',
      addressCountry: 'GB',
      searchLogoUrl: '/media/logo.png',
      logoUrl: '/media/logo.svg',
    });
    expect(full).toMatchObject({
      legalName: 'Northfold Ltd',
      alternateName: 'North Fold',
      foundingDate: '2024',
      telephone: '+44 20 1234 5678',
      address: { '@type': 'PostalAddress', addressLocality: 'London', addressCountry: 'GB' },
    });
    // The raster logo wins over an SVG one: search engines do not take SVG.
    expect(JSON.stringify(full.logo)).toContain('/media/logo.png');
    expect(JSON.stringify(full.contactPoint)).toContain('+44 20 1234 5678');
  });

  it('takes only a raster logo for search engines', () => {
    expect(siteSettingsSchema.shape.searchLogoUrl.safeParse('/media/a.png').success).toBe(true);
    expect(siteSettingsSchema.shape.searchLogoUrl.safeParse('/media/a.svg').success).toBe(false);
    expect(parseSiteSettings({ foundingDate: 'last year', twitterHandle: '@gg', googleVerification: 'abc<script>' })).toEqual({ twitterHandle: '@gg' });
  });
});

describe('the WebSite node', () => {
  it('offers a search box only when there is a search to send it to', () => {
    expect(website(base)).not.toHaveProperty('potentialAction');
    expect(JSON.stringify(website({ ...base, searchPath: '/blog' }))).toContain('/blog?q={search_term_string}');
  });
});

describe('SEO settings in a content export', () => {
  it('travel, but the switch that hides a site from search engines never does', () => {
    for (const key of PORTABLE_SEO_KEYS) expect(isPortableSettingKey(key), key).toBe(true);
    expect(isPortableSettingKey('site.searchLogoUrl')).toBe(true);
    expect(isPortableSettingKey('seo.discourageSearchEngines')).toBe(false);
    expect(isPortableSettingKey('seo.defaultRobots')).toBe(false);
  });

  it('are checked against their own fields on import', () => {
    expect(checkSetting('seo.ogImageUrl', '/media/share.png')).toEqual({ ok: true, value: '/media/share.png' });
    expect(checkSetting('seo.titleFormat', 'shouting').ok).toBe(false);
    expect(checkSetting('site.legalName', 'Northfold Ltd').ok).toBe(true);
    expect(Object.keys(SITE_SETTING_FIELDS)).toEqual(expect.arrayContaining([...PORTABLE_SEO_KEYS]));
  });
});

describe('a page’s SEO', () => {
  it('keeps "exactly this title" (the page routes now share this schema)', () => {
    expect(seoSchema.parse({ title: 'Exact', exactTitle: true })).toEqual({ title: 'Exact', exactTitle: true });
  });
});

describe('the page routes', () => {
  it('use the shared SEO rules rather than a copy of their own', () => {
    for (const file of ['../src/app/api/admin/pages/route.ts', '../src/app/api/admin/pages/[id]/route.ts']) {
      const source = readFileSync(path.join(__dirname, file), 'utf8');
      expect(source, file).not.toContain('const seoSchema');
      expect(source, file).toMatch(/import \{[^}]*seoSchema[^}]*\} from '@\/server\/api\/schemas'/);
    }
  });
});
