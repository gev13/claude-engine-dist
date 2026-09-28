import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { blockStyleSchema } from '@/lib/blockStyle';
import { BODY, EYEBROWS, HEADINGS, SUBHEADINGS, blockStyleToCss, rowToCss } from '@/lib/blockStyle-css';
import { chromeSchema, resolveChrome } from '@/lib/chrome';
import { itemStyleSchema, itemStyleToCss } from '@/lib/itemStyle';
import { themeSchema } from '@/lib/theme';
import { themeToCss } from '@/lib/theme-css';

/* 3.13 — sizes a site owner reasonably wants different on a phone: the
   buttons' padding and label size per screen tier, and a figures row's
   number size on tablets and phones. Unset keeps the wider screen's. */

vi.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => ({ push() {} }) }));
const { BlockRenderer } = await import('@/components/blocks/Renderer');

describe('buttons per screen tier', () => {
  it('write nothing until set', () => {
    expect(themeToCss(themeSchema.parse({ buttons: { paddingY: '16px' } }))).not.toMatch(/@media[^{]*\{:root\{[^}]*--he-btn-py/);
  });

  it('override padding and size on the tier they are set for', () => {
    const css = themeToCss(themeSchema.parse({ buttons: { paddingY: '16px', tablet: { paddingX: '18px' }, mobile: { paddingY: '10px', fontSize: '11px' } } }));
    expect(css).toMatch(/@media \(max-width:1024px\)\{:root\{[^}]*--he-btn-px:18px/);
    expect(css).toMatch(/@media \(max-width:768px\)\{:root\{[^}]*--he-btn-py:10px[^}]*--he-btn-size:11px/);
  });
});

describe('figure sizes per screen', () => {
  const stats = (extra: Record<string, unknown>) =>
    renderToStaticMarkup(<BlockRenderer blocks={[{ id: 's', type: 'stats', props: { variant: 'figures', items: [{ value: '1', label: 'x' }], ...extra } }] as never} />);

  it('carry a size for tablets and phones', () => {
    const html = stats({ valueSize: '56px', valueSizeTablet: '44px', valueSizeMobile: '32px' });
    expect(html).toContain('--he-figs-size:56px;--he-figs-size-tablet:44px;--he-figs-size-mobile:32px');
    expect(stats({})).not.toContain('--he-figs-size');
  });

  it('fall back to the wider screen’s, then the stylesheet’s', () => {
    const css = readFileSync(join(__dirname, '../src/styles/library-content.css'), 'utf8');
    expect(css).toContain('font-size: var(--he-figs-size-mobile, var(--he-figs-size-tablet, var(--he-figs-size, clamp(40px, 5vw, 72px))));');
  });
});


describe('gaps per screen', () => {
  it('a section’s, on tablets and phones', () => {
    const css = blockStyleToCss('g', blockStyleSchema.parse({ gap: '40px', gapTablet: '24px', gapMobile: '16px' }));
    expect(css).toContain('@media (max-width:1024px){.he-b-g{--he-gap:24px}}');
    expect(css).toContain('@media (max-width:768px){.he-b-g{--he-gap:16px}}');
  });

  it('the site’s, on tablets and phones', () => {
    const css = themeToCss(themeSchema.parse({ gap: '32px', gapMobile: '16px' }));
    expect(css).toMatch(/@media \(max-width:768px\)\{:root\{[^}]*--he-gap:16px/);
  });

  it('a card grid’s: inline as before with one value, as variables once a tier is set', () => {
    const grid = (extra: Record<string, unknown>) =>
      renderToStaticMarkup(<BlockRenderer blocks={[{ id: 'c', type: 'cardGrid', props: { cards: [{ title: 'A' }, { title: 'B' }], ...extra } }] as never} />);
    expect(grid({ gap: '24px' })).toContain('style="gap:24px"');
    const tiered = grid({ gap: '24px', gapMobile: '12px' });
    expect(tiered).toContain('he-gap-tiers has-g has-gm');
    expect(tiered).toContain('--he-g:24px;--he-g-m:12px');
    expect(tiered).not.toContain('style="gap:');
  });

  it('a row’s gap and least height', () => {
    const css = rowToCss({ id: 'r', gap: '64px', gapMobile: '24px', minHeightMobile: '0px', columns: [{ id: 'a', width: { base: 6 } }, { id: 'b', width: { base: 6 } }] } as never);
    expect(css).toContain('@media (max-width:768px){.he-r-r{gap:24px;min-height:0px}}');
  });
});

describe('phones', () => {
  it('a card’s padding and text inset', () => {
    const css = itemStyleToCss('.i', itemStyleSchema.parse({ spacing: { paddingTop: '48px' }, spacingMobile: { paddingTop: '20px' }, textInsetMobile: '8px' }));
    expect(css).toContain('@media (max-width:768px){.i{padding-top:20px;--he-item-text-inset:8px}}');
  });

  it('a band’s text box, block text sizes and the footer logo', () => {
    const band = renderToStaticMarkup(<BlockRenderer blocks={[{ id: 'b', type: 'mediaBand', props: { title: 'T', imageUrl: '/media/x.webp', textBox: { paddingBlock: '88px', paddingBlockMobile: '40px' } } }] as never} />);
    expect(band).toContain('--he-band-py-m:40px');
    expect(themeToCss(themeSchema.parse({ blockTextMobile: { lead: '15px' } }))).toMatch(/@media \(max-width:768px\)\{:root\{[^}]*--he-block-lead:15px/);
    expect(resolveChrome(chromeSchema.parse({ footer: { logoHeightMobile: 32 } })).footer.logoHeightMobile).toBe(32);
  });
});

describe('what a section’s typography reaches', () => {
  it('body leaves labels, markers, big numbers, questions and button labels alone', () => {
    for (const cls of ['.type-eyebrow', '.he-hero__kicker', '.he-mrows__num', '.he-counter__value', '.he-faq__q', '.he-cbtn *', '.he-btn *']) expect(BODY).toContain(cls);
    expect(BODY).toContain('.he-figs__label');
  });

  it('headings skip a list’s small title; questions and kickers have their roles', () => {
    expect(HEADINGS).toContain(':not(.he-ilist__title)');
    expect(SUBHEADINGS).toContain('.he-faq__q');
    expect(EYEBROWS).toContain('.he-hero__kicker');
    expect(EYEBROWS).toContain('.he-tile__eyebrow');
  });
});
