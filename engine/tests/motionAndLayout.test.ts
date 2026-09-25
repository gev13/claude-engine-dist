import { describe, expect, it } from 'vitest';
import { blockSchemas, parseBlock } from '@/lib/blocks';
import { blockStyleToCss, rowToCss } from '@/lib/blockStyle-css';
import { hiddenTiers } from '@/lib/blockStyle';
import { cardHoverProps, cardHoverSchema, wantsTilt } from '@/lib/cardHover';
import { chromeSchema, resolveChrome } from '@/lib/chrome';
import { pageAppearanceCss, readPageAppearance } from '@/lib/pageAppearance';
import { navigationSchema } from '@/lib/navigation';
import { themeSchema } from '@/lib/theme';
import { themeToCss } from '@/lib/theme-css';

/* 2.19 — header, menus, cursor, transitions, reveal footer and rails; page
   colours; per-tier visibility and column order; card hover; testimonials;
   long galleries. Every option is off until chosen. */

describe('the site chrome', () => {
  it('resolves every new option to what the site already did', () => {
    const chrome = resolveChrome(undefined);
    expect(chrome.header).toMatchObject({ background: 'solid', behaviour: 'always', logoMobile: 'left', height: {} });
    expect(chrome.mobileMenu).toMatchObject({ source: 'main', size: 'large', entrance: 'none', opacity: 100, hoverImages: false });
    expect(chrome.footer).toMatchObject({ reveal: false, revealOnMobile: false });
    expect(chrome.footer.background).toBeUndefined();
    expect(chrome.cursor.style).toBe('off');
    expect(chrome.transition).toEqual({ style: 'off', preloader: false });
    expect(chrome.rails).toBeNull();
  });

  it('can stop motion for everyone, which retires the visitor’s switch', () => {
    expect(resolveChrome(undefined).reduceMotion).toBe(false);
    const off = resolveChrome(chromeSchema.parse({ reduceMotion: true, motionToggle: true }));
    expect(off.reduceMotion).toBe(true);
    expect(off.motionToggle).toBe(false);
  });

  it('fills the rails in once they are switched on', () => {
    const rails = resolveChrome(chromeSchema.parse({ rails: { enabled: true } })).rails;
    expect(rails).toMatchObject({ scrollSide: 'left', socialSide: 'right', minWidth: 1181 });
  });

  it('refuses a footer colour or a rail path that could escape its place', () => {
    expect(chromeSchema.safeParse({ footer: { background: 'red;}body{display:none' } }).success).toBe(false);
    expect(chromeSchema.safeParse({ rails: { hideOn: ['javascript:alert(1)'] } }).success).toBe(false);
    expect(chromeSchema.safeParse({ rails: { hideOn: ['/blog/*'] } }).success).toBe(true);
    expect(chromeSchema.safeParse({ mobileMenu: { phone: '<b>' } }).success).toBe(false);
  });

  it('keeps an overlay menu beside the header’s', () => {
    const parsed = navigationSchema.safeParse({ overlay: [{ id: 'a', label: 'Work', href: '/work', imageUrl: '/media/work.webp' }] });
    expect(parsed.success).toBe(true);
  });
});

describe('a page’s own colours', () => {
  const theme = themeSchema.parse({ colorsAlt: { background: '#ffffff', textPrimary: '#111111' } });

  it('are nothing until set', () => {
    expect(pageAppearanceCss(readPageAppearance(undefined), theme)).toBe('');
    expect(pageAppearanceCss(readPageAppearance({ background: 'url(x)' }), theme)).toBe('');
  });

  it('write a background and the alternate palette', () => {
    const css = pageAppearanceCss(readPageAppearance({ background: '#000000', scheme: 'alt' }), theme);
    expect(css).toContain('background-color:#000000');
    expect(css).toMatch(/^:root\{/);
  });

  it('give sections a class for the alternate palette', () => {
    expect(themeToCss(theme)).toContain('.he-scheme-alt{');
    expect(themeToCss(themeSchema.parse({}))).not.toContain('.he-scheme-alt');
  });
});

describe('visibility per tier', () => {
  it('hides a block on exactly the tiers chosen', () => {
    const css = blockStyleToCss('a1', { hideAt: ['tablet'] });
    expect(css).toContain('(min-width:769px) and (max-width:1024px)');
    expect(css).not.toContain('(max-width:768px)');
  });

  it('reads the old “hide below” setting as the tiers it covered', () => {
    expect(hiddenTiers({ hideOn: ['tablet', 'mobile'] })).toEqual(['tablet', 'mobile']);
    expect(hiddenTiers({ hideAt: ['base', 'mobile'] })).toEqual(['base', 'mobile']);
    expect(hiddenTiers(undefined)).toEqual([]);
  });
});

describe('column order', () => {
  const row = (order?: Record<string, number>) => ({
    id: 'r1',
    columns: [
      { id: 'c1', width: { base: 6 } },
      { id: 'c2', width: { base: 6 }, ...(order ? { order } : {}) },
    ],
  });

  it('changes nothing until a place is chosen', () => {
    expect(rowToCss(row())).not.toContain('order:');
  });

  it('places a column first at a tier, the others behind it in their written order', () => {
    const css = rowToCss(row({ tablet: 1 }));
    expect(css).toContain('@media (max-width:1024px){.he-r-r1>.he-c-c1{order:2}.he-r-r1>.he-c-c2{order:1}}');
    expect(css).not.toContain('max-width:1440px){.he-r-r1');
  });

  it('carries a place down to the smaller tiers it does not name', () => {
    const three = {
      id: 'r2',
      columns: [
        { id: 'a', width: { base: 4 } },
        { id: 'b', width: { base: 4 }, order: { laptop: 2, mobile: 1 } },
        { id: 'c', width: { base: 4 }, order: { tablet: 1 } },
      ],
    };
    const css = rowToCss(three);
    // Desktop: b second, the others around it as written.
    expect(css).toContain('@media (max-width:1440px){.he-r-r2>.he-c-a{order:1}.he-r-r2>.he-c-b{order:2}.he-r-r2>.he-c-c{order:3}}');
    // Tablet: c first, b keeps its desktop second place, a takes what is left.
    expect(css).toContain('@media (max-width:1024px){.he-r-r2>.he-c-a{order:3}.he-r-r2>.he-c-b{order:2}.he-r-r2>.he-c-c{order:1}}');
    // Phone: b and c both first — b, written earlier, wins; c takes the next slot.
    expect(css).toContain('@media (max-width:768px){.he-r-r2>.he-c-a{order:3}.he-r-r2>.he-c-b{order:1}.he-r-r2>.he-c-c{order:2}}');
  });

  it('is kept by the parser, and refused past six', () => {
    const parsed = parseBlock({ id: 'r1', type: 'row', props: row({ mobile: 1 }) });
    expect((parsed?.props as { columns: { order?: unknown }[] }).columns[1]!.order).toEqual({ mobile: 1 });
    expect(blockSchemas.row.safeParse(row({ mobile: 9 })).success).toBe(false);
  });
});

describe('card hover', () => {
  it('leaves an untouched card’s markup alone', () => {
    expect(cardHoverProps(undefined)).toEqual({});
    expect(cardHoverProps({ effect: 'none' })).toEqual({});
  });

  it('tilts with its own perspective and angle, checked again', () => {
    const tilt = cardHoverProps({ effect: 'tilt', perspective: 6000, maxAngle: 12, glare: true });
    expect(tilt.className).toBe('he-ch he-ch--tilt has-glare');
    expect(tilt.style).toEqual({ '--he-ch-persp': '6000px', '--he-ch-max': '12' });
    expect(cardHoverProps({ effect: 'tilt', perspective: 1e9 } as never).style).toMatchObject({ '--he-ch-persp': '1100px' });
    expect(wantsTilt({ effect: 'tilt' })).toBe(true);
    expect(wantsTilt({ effect: 'lift', zoom: true })).toBe(false);
    expect(cardHoverProps({ effect: 'lift', zoom: true }).className).toBe('he-ch he-ch--lift has-zoom');
  });

  it('is offered on post lists, the blog and projects', () => {
    expect(cardHoverSchema.safeParse({ effect: 'spin' }).success).toBe(false);
    const list = blockSchemas.postList.parse({ card: { hover: { effect: 'tilt' } } });
    expect(list.card?.hover?.effect).toBe('tilt');
    expect(blockSchemas.projects.safeParse({ items: [{ title: 'A' }], cardHover: { effect: 'grow' } }).success).toBe(true);
  });
});

describe('testimonials', () => {
  const review = { name: 'Ana', text: 'Great partner.' };

  it('take a role, a company and a logo on a coloured circle, with no stars', () => {
    const parsed = blockSchemas.reviews.parse({
      layout: 'masonry',
      hideRatings: true,
      card: { background: '#111111', radius: 8, border: false },
      items: [{ ...review, role: 'Head of CRM', company: 'Bet Co', avatarColor: '#1f6feb' }],
    });
    expect(parsed.items[0]).toMatchObject({ role: 'Head of CRM', company: 'Bet Co', avatarColor: '#1f6feb' });
    expect(parsed.items[0]!.rating).toBeUndefined();
  });

  it('refuse a colour that is not one', () => {
    expect(blockSchemas.reviews.safeParse({ items: [{ ...review, avatarColor: 'red;x' }] }).success).toBe(false);
    expect(blockSchemas.reviews.safeParse({ items: [review], card: { radius: 400 } }).success).toBe(false);
  });

  it('give the quote slider the same company and circle', () => {
    const parsed = blockSchemas.carousel.safeParse({ mode: 'quotes', slides: [{ body: 'Yes', title: 'Ana', caption: 'CEO', company: 'Bet Co', avatarColor: '#000' }] });
    expect(parsed.success).toBe(true);
  });
});

describe('long galleries', () => {
  const image = { url: '/media/a.webp' };

  it('hold two hundred pictures and show every one by default', () => {
    const parsed = blockSchemas.gallery.parse({ images: Array.from({ length: 200 }, () => image) });
    expect(parsed.images).toHaveLength(200);
    expect(parsed.pagination).toBe('none');
    expect(blockSchemas.gallery.safeParse({ images: Array.from({ length: 201 }, () => image) }).success).toBe(false);
  });

  it('can load more, or keep loading as the visitor scrolls', () => {
    expect(blockSchemas.gallery.parse({ images: [image], pagination: 'infinite', perPage: 9 })).toMatchObject({ pagination: 'infinite', perPage: 9 });
  });
});
