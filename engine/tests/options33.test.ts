import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { blockStyleSchema } from '@/lib/blockStyle';
import { blockStyleToCss } from '@/lib/blockStyle-css';
import { resolveBlog } from '@/lib/blog';
import { themeSchema } from '@/lib/theme';
import { themeToCss } from '@/lib/theme-css';

/* 3.3 — found by the first full site build: a section's own heading size
   needs a phone size, the contained FAQ must follow cut corners, a panel's
   content should line up with the page's, the blog's bar belongs on its
   category pages, and an edge-to-edge hero reaches up behind the notch. */

const css = (file: string) => readFileSync(join(__dirname, '../src/styles', file), 'utf8');

describe('a section’s own sizes on smaller screens', () => {
  it('apply at the tablet and phone widths, and only when set', () => {
    const style = blockStyleSchema.parse({ typography: { heading: { size: '56px', sizeTablet: '44px', sizeMobile: '32px' } } });
    const out = blockStyleToCss('b1', style);
    expect(out).toContain('@media (max-width:1024px){.he-b-b1 :is(h1,h2,h3,h4,h5,h6){font-size:44px}}');
    expect(out).toContain('@media (max-width:768px){.he-b-b1 :is(h1,h2,h3,h4,h5,h6){font-size:32px}}');
    expect(blockStyleToCss('b1', blockStyleSchema.parse({ typography: { heading: { size: '56px' } } }))).not.toContain('max-width:768px');
  });
});

describe('the contained FAQ', () => {
  it('follows the card corners, and keeps its own radius otherwise', () => {
    expect(css('library-variants.css')).toMatch(/\.he-faq\.is-contained \{[^}]*border-radius: var\(--he-box-radius, 18px\); clip-path: var\(--he-card-clip, none\)/);
    expect(themeToCss(themeSchema.parse({ shape: { cards: { style: 'cut' } } }))).toContain('--he-box-radius:0px');
    expect(themeToCss(themeSchema.parse({}))).not.toContain('--he-box-radius');
  });
});

describe('a panel’s content in line with the page', () => {
  it('is written only when chosen', () => {
    expect(themeToCss(themeSchema.parse({}))).not.toContain('.he-panel>.shell');
    const out = themeToCss(themeSchema.parse({ panel: { alignContent: true } }));
    expect(out).toContain('@media (width>=64rem){.he-panel>.shell,.he-panel>*>.shell,.he-ftr.is-panel>.shell{padding-inline:max(16px,calc(var(--spacing-gutter) - min(var(--he-panel-inset,24px),3vw)))}}');
  });
});

describe('the blog’s bar on its category pages', () => {
  it('is off, and the search stays at the end of the bar, until chosen', () => {
    expect(resolveBlog(undefined)).toMatchObject({ archiveBar: false, searchBelow: false });
    expect(resolveBlog({ archiveBar: true, searchInBar: true, searchBelow: true })).toMatchObject({ archiveBar: true, searchBelow: true });
  });
});

describe('the edge-to-edge hero under the notch header', () => {
  it('reaches up by exactly the clearance the header leaves', () => {
    expect(css('library-chrome.css')).toMatch(/#main > :first-child \{ --he-ns-now: var\(--he-ns-base, 80px\); border-top: var\(--he-ns-now\) solid transparent; \}/);
    expect(css('library-blocks.css')).toContain('inset: calc(-1 * var(--he-ns-now, 0px)) 0 0 auto;');
  });
});
