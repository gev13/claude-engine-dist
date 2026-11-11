import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { CardGridVariant } from '@/components/blocks/library/content';
import { ScrollPin } from '@/components/blocks/library/ScrollPin';
import { blockSchemas } from '@/lib/blocks';
import { blockStyleSchema } from '@/lib/blockStyle';
import { blockStyleToCss } from '@/lib/blockStyle-css';
import { cardMotion, shadowReach } from '@/lib/cardMotion';
import { chromeSchema } from '@/lib/chrome';
import { chromeCss } from '@/lib/chromeCss';

/* 3.34 — a section pinned to the scroll, the card grid's lift tuned, a row of
   cards that widen, and the footer's spacing on phones. Each off, and drawn
   as before, until set. */

vi.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => ({ push() {} }) }));

const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');
const style = (value: unknown) => blockStyleToCss('a', blockStyleSchema.parse(value));
const footer = (value: unknown) => chromeCss(chromeSchema.parse({ footer: value }));
const grid = (extra: Record<string, unknown> = {}, card: Record<string, unknown> = {}) =>
  renderToStaticMarkup(
    <CardGridVariant
      {...blockSchemas.cardGrid.parse({ variant: 'overlay', cards: [{ title: 'One', imageUrl: '/media/a.png', ...card }, { title: 'Two', imageUrl: '/media/b.png' }, { title: 'Three', imageUrl: '/media/c.png' }], ...extra })}
    />,
  );

describe('a section pinned to the scroll', () => {
  it('writes nothing until set', () => {
    expect(style({ swipeOn: 'always' })).not.toContain('--he-pin');
  });
  it('writes the header room and the counter and line looks, nothing else', () => {
    const out = style({
      scrollPin: { at: ['base', 'mobile'], offset: '84px', counter: true, counterFont: 'display', counterSize: '44px', counterColor: '#222', counterTotalColor: '#999', line: true, lineWidth: '200px', lineHeight: '2px', lineTrack: '#ddd', lineFill: '#c00' },
    });
    expect(out).toContain(
      '.he-b-a{--he-pin-offset:84px;--he-pin-count-font:var(--font-display);--he-pin-count-size:44px;--he-pin-count-color:#222;--he-pin-count-total:#999;--he-pin-line-w:200px;--he-pin-line-h:2px;--he-pin-line-track:#ddd;--he-pin-line-fill:#c00}',
    );
  });
  it('writes nothing for a pin on no tier', () => {
    expect(style({ scrollPin: { at: [], offset: '84px' } })).not.toContain('--he-pin');
  });
  it('refuses values that could break out of the style element', () => {
    expect(blockStyleSchema.safeParse({ scrollPin: { at: ['base'], offset: '1px;}' } }).success).toBe(false);
    expect(blockStyleSchema.safeParse({ scrollPin: { at: ['base'], counterColor: 'red;}' } }).success).toBe(false);
    expect(blockStyleSchema.safeParse({ scrollPin: { at: ['phone'] } }).success).toBe(false);
  });
  it('draws only an empty run on the server — nothing moves before the script', () => {
    expect(renderToStaticMarkup(<ScrollPin at={['base']} counter line />)).toBe('<div class="he-pin-run" aria-hidden="true"></div>');
  });
  it('is rendered by blocks and rows, and its stylesheet keys every rule to the script’s marks', () => {
    expect(read('src/components/blocks/Renderer.tsx').match(/scrollPin\(style\)/g)).toHaveLength(2);
    const sheet = read('src/styles/library-scroll.css');
    expect(sheet).toContain(".he-pin-run { display: block; height: 0; }");
    for (const ruleLine of sheet.split('\n').filter((line) => line.startsWith('[') || line.startsWith(':is('))) expect(ruleLine).toMatch(/data-he-pin/);
    expect(read('src/styles/globals.css')).toContain("@import './library-scroll.css';");
  });
});

describe('the card grid’s lift, tuned', () => {
  it('leaves an untuned lift, and every other grid, as drawn', () => {
    const plain = grid({ hover: 'lift' });
    expect(plain).not.toContain('has-lift');
    expect(plain).not.toContain('--he-lift');
    expect(cardMotion({ hover: 'zoom', liftDistance: '10px' }).className).toEqual([]);
  });
  it('carries the distance, shadow, zoom, lengths and easing, with room for the shadow', () => {
    const out = grid({ hover: 'lift', liftDistance: '10px', liftShadow: '0 30px 60px -30px rgba(0,0,0,.35)', liftZoom: 1.07, liftDuration: 500, liftZoomDuration: 800, liftEasing: 'soft' });
    expect(out).toContain('has-lift');
    expect(out).toContain('has-lift-zoom');
    expect(out).toContain('--he-lift-d:10px');
    expect(out).toContain('--he-lift-zoom:1.07');
    expect(out).toContain('--he-lift-t:500ms');
    expect(out).toContain('--he-lift-zt:800ms');
    expect(out).toContain('--he-lift-ease:cubic-bezier(0.2,0.7,0.2,1)');
    expect(out).toContain('--he-lift-room-t:calc(10px + 0px)');
    expect(out).toContain('--he-lift-room-b:60px');
  });
  it('measures how far a shadow reaches', () => {
    expect(shadowReach('0 30px 60px -30px rgba(0,0,0,.3)')).toEqual({ up: 0, down: 60 });
    expect(shadowReach('0 4px 20px #000')).toEqual({ up: 16, down: 24 });
    expect(shadowReach(undefined)).toEqual({ up: 0, down: 0 });
  });
  it('refuses a shadow or a zoom out of bounds', () => {
    expect(blockSchemas.cardGrid.safeParse({ cards: [], liftShadow: '0 0 0 red;}' }).success).toBe(false);
    expect(blockSchemas.cardGrid.safeParse({ cards: [], liftZoom: 3 }).success).toBe(false);
    expect(blockSchemas.cardGrid.safeParse({ cards: [], liftEasing: 'steps(2)' }).success).toBe(false);
  });
  it('lifts only for pointers that hover', () => {
    const sheet = read('src/styles/library-scroll.css');
    expect(sheet).toMatch(/@media \(hover: hover\) \{\n\s+\.he-fgrid\.has-lift > \.he-fgrid__item:hover \{ translate: 0 calc\(-1 \* var\(--he-lift-d, 6px\)\)/);
  });
});

describe('a row of cards that widen', () => {
  it('is off until set, and only for pictures with text over them', () => {
    expect(grid()).not.toContain('is-expand');
    expect(grid()).not.toContain('tabindex');
    expect(cardMotion({ variant: 'cards', expand: 1.3 }).className).toEqual([]);
  });
  it('carries the factor, length and easing; cards without a link take a tap', () => {
    const out = grid({ expand: 1.3, expandDuration: 700, expandEasing: 'soft' });
    expect(out).toContain('is-expand');
    expect(out).not.toContain('is-expand-reveal');
    expect(out).toContain('--he-expand:1.3');
    expect(out).toContain('--he-expand-t:700ms');
    expect(out.match(/tabindex="-1"/g)).toHaveLength(3);
  });
  it('puts cards whose words wait to be revealed in the tab order', () => {
    const out = grid({ expand: 1.3, expandText: 'reveal' });
    expect(out).toContain('is-expand-reveal');
    expect(out.match(/tabindex="0"/g)).toHaveLength(3);
  });
  it('leaves a linked card to its link', () => {
    expect(grid({ expand: 1.3 }, { href: '/a' }).match(/tabindex="-1"/g)).toHaveLength(2);
  });
  it('steps aside for a bento and exact row widths', () => {
    expect(grid({ expand: 1.3, rowTracks: ['1fr 1fr 1fr'] })).not.toContain('is-expand');
    expect(grid({ expand: 1.3 }, { span: 6 })).not.toContain('is-expand');
  });
  it('refuses a factor out of bounds', () => {
    expect(blockSchemas.cardGrid.safeParse({ cards: [], expand: 1 }).success).toBe(false);
    expect(blockSchemas.cardGrid.safeParse({ cards: [], expand: 9 }).success).toBe(false);
  });
  it('widens from tablets up only; phones keep the stacked cards', () => {
    const sheet = read('src/styles/library-scroll.css');
    for (const line of sheet.split('\n').filter((l) => /is-expand/.test(l) && /flex-grow: var\(--he-expand\)/.test(l))) expect(line.startsWith('    ')).toBe(true);
    expect(sheet).toContain('@media (width > 48rem) {\n    .he-fgrid.is-expand { display: flex; flex-wrap: nowrap; }');
  });
});

describe('the footer on phones', () => {
  it('writes nothing until set', () => {
    expect(footer({})).toBe('');
  });
  it('sets the sign-up’s width, and on phones', () => {
    expect(footer({ newsletterWidth: '100%' })).toContain('.he-ftr .he-ftr__nl{max-width:100%}');
    expect(footer({ newsletterWidth: 'none', newsletterWidthMobile: '100%' })).toContain('.he-ftr .he-ftr__nl{max-width:none}@media (max-width:768px){.he-ftr .he-ftr__nl{max-width:100%}}');
  });
  it('makes the space between the parts the only one on phones', () => {
    const out = footer({ gapMobile: '60px' });
    expect(out).toContain('@media (max-width:768px){.he-ftr .he-ftr__grid{row-gap:60px}');
    expect(out).toContain('.he-ftr .he-ftr__grid>:is(.he-ftr__lead,.he-ftr__middle){padding-bottom:0}');
    expect(out).toContain('.he-ftr.is-links-first .he-ftr__grid>:is(.he-ftr__col,.he-ftr__stack):is(:last-of-type,:has(+ .he-ftr__langrow)){margin-bottom:0}');
  });
  it('spaces the links and the languages on phones', () => {
    expect(footer({ linkGapMobile: '24px' })).toBe('@media (max-width:768px){.he-ftr .he-ftr__links{row-gap:24px}.he-ftr .he-ftr__links a{padding-block:0}}');
    expect(footer({ languagesGapMobile: '12px' })).toBe('@media (max-width:768px){.he-ftr .he-langs{gap:12px}}');
  });
  it('refuses values that could break out of the style element', () => {
    expect(chromeSchema.safeParse({ footer: { newsletterWidth: '1px;}' } }).success).toBe(false);
    expect(chromeSchema.safeParse({ footer: { linkGapMobile: 'auto' } }).success).toBe(false);
  });
});
