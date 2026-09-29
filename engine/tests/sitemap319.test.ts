/**
 * @vitest-environment jsdom
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { messageReader, MESSAGES } from '@/lib/messages';
import { sitemapIndex, urlSet } from '@/lib/seo/sitemap';
import { collectImages, mediaImagePath } from '@/lib/seo/sitemapImages';
import { SITEMAP_STYLESHEET_PATH, sitemapStylesheet, textOn } from '@/lib/seo/sitemapXsl';
import { PORTABLE_SEO_KEYS, SITE_SETTING_FIELDS, parseSiteSettings } from '@/lib/siteSettings';
import { isPortableSettingKey } from '@/server/engine/transfer';
import { checkSetting } from '@/server/engine/importCheck';
import type { LocaleConfig } from '@/lib/locales';

/* 3.19 — the sitemaps: readable in a browser, and listing the pictures on
   each address. Both off until Settings switches them on. */

const EN: LocaleConfig = { locales: ['en'], defaultLocale: 'en', multilingual: false } as LocaleConfig;
const read = (file: string) => readFileSync(path.join(process.cwd(), file), 'utf8');

describe('an untouched sitemap', () => {
  it('has no stylesheet instruction and no image namespace', () => {
    const xml = urlSet([{ path: '/about' }], EN);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n')).toBe(true);
    expect(xml).not.toContain('xml-stylesheet');
    expect(xml).not.toContain('image');
    expect(sitemapIndex([{ path: '/sitemaps/pages.xml' }])).not.toContain('xml-stylesheet');
  });
});

describe('the stylesheet instruction', () => {
  it('points both kinds of document at the stylesheet', () => {
    const pi = `<?xml-stylesheet type="text/xsl" href="${SITEMAP_STYLESHEET_PATH}"?>`;
    expect(urlSet([], EN, { stylesheet: SITEMAP_STYLESHEET_PATH }).split('\n')[1]).toBe(pi);
    expect(sitemapIndex([], { stylesheet: SITEMAP_STYLESHEET_PATH }).split('\n')[1]).toBe(pi);
  });

  it('refuses anything but a same-site path', () => {
    for (const stylesheet of ['//evil.example/x.xsl', 'https://evil.example/x.xsl', '/a"?><x', 'x.xsl']) {
      expect(urlSet([], EN, { stylesheet })).not.toContain('xml-stylesheet');
    }
  });
});

describe('pictures on an address', () => {
  it('are listed as absolute, escaped image:loc entries under the image namespace', () => {
    const xml = urlSet([{ path: '/about', images: ['/media/a&b.png', 'https://cdn.example/c.jpg'] }], EN);
    expect(xml).toContain('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"');
    expect(xml).toMatch(/<image:image>\s*<image:loc>http[^<]+\/media\/a&amp;b\.png<\/image:loc>\s*<\/image:image>/);
    expect(xml).toContain('<image:loc>https://cdn.example/c.jpg</image:loc>');
    // well-formed
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
    expect(doc.getElementsByTagNameNS('http://www.google.com/schemas/sitemap-image/1.1', 'loc')).toHaveLength(2);
  });

  it('are found anywhere in a block tree, a post body or a cover, once each', () => {
    const blocks = [
      { id: 'a', type: 'hero', props: { imageUrl: '/media/hero.webp', imageUrlMobile: '/media/hero-m.webp?w=480' } },
      {
        id: 'b',
        type: 'row',
        props: { columns: [{ id: 'c', blocks: [{ id: 'd', type: 'cardGrid', props: { cards: [{ imageUrl: '/media/card.png' }, { imageUrl: '/media/hero.webp' }] } }] }] },
      },
      { id: 'e', type: 'image', props: { src: '/media/hidden.png' }, style: { disabled: true } },
      { id: 'f', type: 'text', props: { body: 'See /media/not-a-picture.pdf and /images/x.png' } },
    ];
    const body = '<p>Hi</p><img alt="x" src="http://site.test/media/inline.jpg?w=960"><img src="/elsewhere.png">';
    expect(collectImages(['/media/cover.jpg', body, blocks], 'http://site.test')).toEqual([
      '/media/cover.jpg',
      '/media/inline.jpg',
      '/media/hero.webp',
      '/media/hero-m.webp',
      '/media/card.png',
    ]);
  });

  it('stop at the limit', () => {
    const many = Array.from({ length: 20 }, (_, i) => `/media/p${i}.png`);
    expect(collectImages([many], '', 5)).toHaveLength(5);
  });

  it('are only this site’s media pictures', () => {
    expect(mediaImagePath('/media/a.svg')).toBe('/media/a.svg');
    expect(mediaImagePath('/media/film.mp4')).toBeNull();
    expect(mediaImagePath('https://other.example/media/a.png', 'http://site.test')).toBeNull();
    expect(mediaImagePath('/media/a b.png')).toBeNull();
  });
});

describe('the stylesheet', () => {
  const t = messageReader(MESSAGES);
  const xsl = sitemapStylesheet({ siteName: 'Northfold & Co', lang: 'en', accent: '#ffcc00', t });

  it('is well-formed XSLT with the site’s words, name and colour', () => {
    const doc = new DOMParser().parseFromString(xsl, 'application/xml');
    expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
    expect(doc.documentElement.localName).toBe('stylesheet');
    expect(xsl).toContain('Northfold &amp; Co');
    expect(xsl).toContain('background: #ffcc00; color: #000000;');
    expect(xsl).toContain('This sitemap lists <xsl:value-of select="count(sm:urlset/sm:url)"/> addresses.');
    expect(xsl).toContain('<meta name="robots" content="noindex, follow"/>');
  });

  it('shows the pictures column only when a picture is listed', () => {
    expect(xsl).toContain('<xsl:if test="sm:urlset/sm:url/image:image">');
  });

  it('takes translated words', () => {
    const hy = messageReader({ ...MESSAGES, 'sitemap.title': 'Կայքի քարտեզ', 'sitemap.urlCount': '{n} հասցե' });
    const out = sitemapStylesheet({ siteName: 'N', lang: 'hy', accent: '#000', t: hy });
    expect(out).toContain('<h1>Կայքի քարտեզ</h1>');
    expect(out).toContain('<xsl:value-of select="count(sm:urlset/sm:url)"/> հասցե');
    expect(out).toContain('<html lang="hy">');
  });

  it('never writes anything but a colour into its style', () => {
    for (const accent of ['red;}</style><script>', 'transparent', '', 'url(x)']) {
      const out = sitemapStylesheet({ siteName: 'N', lang: 'en', accent, t });
      expect(out).toContain('background: #1f1f1f;');
    }
    expect(sitemapStylesheet({ siteName: 'N', lang: '"><x', accent: '#000', t })).toContain('<html lang="en">');
  });

  it('picks readable header text', () => {
    expect(textOn('#000000')).toBe('#ffffff');
    expect(textOn('#fff')).toBe('#000000');
    expect(textOn('#17bde7')).toBe('#000000');
    expect(textOn('#a4286a')).toBe('#ffffff');
    expect(textOn('rgb(0 0 0)')).toBe('#ffffff');
  });
});

describe('the settings', () => {
  it('are two switches that travel with an export and are checked on import', () => {
    expect(SITE_SETTING_FIELDS['seo.sitemapStyle']).toBe('sitemapStyle');
    expect(SITE_SETTING_FIELDS['seo.sitemapImages']).toBe('sitemapImages');
    for (const key of ['seo.sitemapStyle', 'seo.sitemapImages'] as const) {
      expect(PORTABLE_SEO_KEYS).toContain(key);
      expect(isPortableSettingKey(key)).toBe(true);
    }
    expect(parseSiteSettings({ sitemapStyle: true, sitemapImages: 'yes' })).toEqual({ sitemapStyle: true });
    expect(checkSetting('seo.sitemapStyle', true)).toEqual({ ok: true, value: true });
    expect(checkSetting('seo.sitemapStyle', 'on').ok).toBe(false);
  });

  it('reach every sitemap route', () => {
    for (const route of ['sitemap.xml', 'sitemaps/pages.xml', 'sitemaps/services.xml', 'sitemaps/blog.xml', 'sitemaps/careers.xml', 'sitemaps/projects.xml']) {
      expect(read(`src/app/${route}/route.ts`)).toContain('setup.options');
    }
  });
});
