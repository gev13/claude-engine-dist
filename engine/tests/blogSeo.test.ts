import { describe, expect, it } from 'vitest';
import { fillEyebrow, resolveBlog } from '@/lib/blog';
import { SOCIAL_NETWORKS, SOCIAL_SHORT, isProfile, navigationSchema, opensElsewhere, socialText } from '@/lib/navigation';
import { DEFAULT_PERMALINKS, feedPath, feedTarget, permalinksSchema } from '@/lib/permalinks';
import { customNodes, organization } from '@/lib/seo/jsonld';
import { heroImage } from '@/lib/seo/heroImage';
import { buildMetadata } from '@/lib/seo/metadata';
import { shareHref } from '@/lib/share';
import { parseSiteSettings, titleTemplate } from '@/lib/siteSettings';

/* 2.18 — blog and SEO parity: post extras, archives, feeds, titles, share
   pictures, structured data and social links. */

describe('a post’s eyebrow', () => {
  it('fills the template and tidies a dangling separator', () => {
    const values = { category: 'Strategy', date: '9 September 2026', minutes: 6, minRead: 'min read' };
    expect(fillEyebrow('{category} · {minutes} {minRead}', values)).toBe('Strategy · 6 min read');
    expect(fillEyebrow('{category} — {date}', { ...values, date: '' })).toBe('Strategy');
  });

  it('is left alone when nobody set one', () => {
    expect(resolveBlog(undefined).eyebrow).toBeUndefined();
    expect(resolveBlog({ eyebrow: '' }).eyebrow).toBeUndefined();
  });
});

describe('feeds', () => {
  it('live where WordPress had them', () => {
    expect(feedPath(DEFAULT_PERMALINKS)).toBe('/feed');
    expect(feedPath(DEFAULT_PERMALINKS, 'news')).toBe('/blog/category/news/feed');
  });

  it('are recognised by the middleware, and nothing else is', () => {
    expect(feedTarget(DEFAULT_PERMALINKS, '/feed')).toEqual({});
    expect(feedTarget(DEFAULT_PERMALINKS, '/blog/category/news/feed')).toEqual({ category: 'news' });
    expect(feedTarget(DEFAULT_PERMALINKS, '/blog/feed')).toBeNull();
    expect(feedTarget(DEFAULT_PERMALINKS, '/blog/category/../feed')).toBeNull();
    expect(feedTarget(DEFAULT_PERMALINKS, '/about')).toBeNull();
  });

  it('follow the permalinks, and can be switched off', () => {
    const custom = permalinksSchema.parse({ categoryBase: '/category', feedSegment: 'rss' });
    expect(feedTarget(custom, '/category/news/rss')).toEqual({ category: 'news' });
    expect(feedTarget(custom, '/feed')).toBeNull();
    const off = permalinksSchema.parse({ feeds: false });
    expect(feedPath(off)).toBeNull();
    expect(feedTarget(off, '/feed')).toBeNull();
  });
});

describe('titles', () => {
  it('are “Page — Site” until the site says otherwise', () => {
    expect(titleTemplate({ name: 'Northfold' })).toBe('%s — Northfold');
    expect(titleTemplate({ name: 'Northfold', titleSeparator: '|' })).toBe('%s | Northfold');
    expect(titleTemplate({ name: 'Northfold', titleFormat: 'plain' })).toBe('%s');
  });

  it('can be used exactly as written, per page', () => {
    const exact = buildMetadata({ title: 'Northfold Studio | Retention', description: '', path: '/crm', seo: { exactTitle: true } });
    expect(exact.title).toEqual({ absolute: 'Northfold Studio | Retention' });
    expect(buildMetadata({ title: 'About', description: '', path: '/about' }).title).toBe('About');
  });
});

describe('site settings', () => {
  it('keep every good field when one is bad', () => {
    const parsed = parseSiteSettings({ name: 'Site', notFoundPageId: 'not-a-uuid', titleSeparator: '|', ogImageUrl: 'javascript:alert(1)' });
    expect(parsed).toEqual({ name: 'Site', titleSeparator: '|' });
  });
});

describe('the share picture', () => {
  it('says what it is, instead of claiming 1200×630 for everything', () => {
    const meta = buildMetadata({ title: 'T', description: '', path: '/x', image: { url: '/media/a.webp', width: 1600, height: 1000, type: 'image/webp', alt: 'A room' } });
    const image = (meta.openGraph?.images as { url: string; width?: number; type?: string; alt?: string }[])[0]!;
    expect(image.url).toMatch(/\/media\/a\.webp$/);
    expect(image).toMatchObject({ width: 1600, type: 'image/webp', alt: 'A room' });
    const fallback = (buildMetadata({ title: 'T', description: '', path: '/x' }).openGraph?.images as { url: string; width?: number }[])[0]!;
    expect(fallback.url).toMatch(/og-default\.png$/);
    expect(fallback.width).toBe(1200);
  });

  it('is found in a page’s opening hero', () => {
    expect(heroImage([{ type: 'hero', props: { imageUrl: '/media/h.webp' } }])).toBe('/media/h.webp');
    expect(heroImage([{ type: 'carousel', props: { mode: 'hero', slides: [{ imageUrl: '/media/s.webp' }] } }])).toBe('/media/s.webp');
    expect(heroImage([{ type: 'heading', props: {} }])).toBeUndefined();
  });
});

describe('structured data', () => {
  it('adds a page’s own nodes and drops anything that is not one', () => {
    expect(customNodes([{ '@context': 'https://schema.org', '@type': 'Event', name: 'Launch' }, 'text', [1], { name: 'no type' }])).toEqual([{ '@type': 'Event', name: 'Launch' }]);
    expect(customNodes(undefined)).toEqual([]);
  });

  it('names the organisation’s profiles and its logo', () => {
    const node = organization({ name: 'S', description: 'D', sameAs: ['https://www.behance.net/s'], logoUrl: '/media/logo.svg' });
    expect(node.sameAs).toEqual(['https://www.behance.net/s']);
    expect((node.logo as { url: string }).url).toMatch(/\/media\/logo\.svg$/);
    expect(organization({ name: 'S', description: 'D' })).not.toHaveProperty('sameAs');
  });
});

describe('social links', () => {
  it('know every network, with a short label for each', () => {
    for (const network of SOCIAL_NETWORKS) expect(SOCIAL_SHORT[network], network).toMatch(/^.{2,4}$/);
  });

  it('label themselves by the site’s style', () => {
    const link = { network: 'behance' as const, href: 'https://www.behance.net/s' };
    expect(socialText(link, 'icon')).toBeNull();
    expect(socialText(link, 'name')).toBe('Behance');
    expect(socialText(link, 'short')).toBe('Be.');
    expect(socialText({ ...link, short: 'Bē' }, 'short')).toBe('Bē');
  });

  it('treat email and phone as links, not profiles', () => {
    const mail = { network: 'email' as const, href: 'mailto:hello@example.com' };
    expect(isProfile(mail)).toBe(false);
    expect(opensElsewhere(mail)).toBe(false);
    expect(isProfile({ network: 'x', href: 'https://x.com/s' })).toBe(true);
    expect(navigationSchema.safeParse({ social: [mail, { network: 'phone', href: 'tel:+441234567890' }], socialStyle: 'short' }).success).toBe(true);
  });
});

describe('sharing', () => {
  it('can pin to Pinterest', () => {
    expect(shareHref('pinterest', 'https://example.com/a', 'A post')).toBe('https://www.pinterest.com/pin/create/button/?url=https%3A%2F%2Fexample.com%2Fa&description=A%20post');
  });
});
