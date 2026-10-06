import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ProseBlock } from '@/components/blocks';
import { blockSchemas } from '@/lib/blocks';
import { blockStyleSchema } from '@/lib/blockStyle';
import { blockStyleToCss } from '@/lib/blockStyle-css';
import { chromeSchema, resolveChrome } from '@/lib/chrome';
import { projectCardLook } from '@/lib/projectCard';
import { themeSchema } from '@/lib/theme';
import { richTextCss, themeToCss } from '@/lib/theme-css';

/* 3.26 — round 7: rich text from the theme, text-only card sliders, project
   card type and gaps, the space after a card's picture, a card-link role per
   block, duplicate files in an import (importCheck.test.ts), the menu's
   details and the header's lit link. Every option is off, or as before,
   until chosen. */

const styles = join(__dirname, '../src/styles');
const css = (file: string) => readFileSync(join(styles, file), 'utf8');
const theme = (value: unknown) => themeToCss(themeSchema.parse(value));

describe('C1 — rich text follows the theme when asked', () => {
  it('writes nothing for an untouched theme, and leaves the utility as it was', () => {
    expect(theme({})).toBe('');
    expect(richTextCss(undefined)).toBe('');
    const globals = css('globals.css');
    expect(globals).toContain('font-size: calc(var(--he-h2-size) * 0.85);');
    expect(globals).toContain('& > * + * { margin-top: 1.1em; }');
  });

  it('takes the body role, the heading scale, the spacing and the lists', () => {
    const out = theme({ richText: { text: 'body', headingScale: 1, paragraphGap: '1.35em', headingTop: '48px', subheadingTop: '40px', headingBottom: '16px', listMarker: 'disc', listIndent: '32px', listGap: '4px' } });
    expect(out).toContain('.prose-edge{font-size:var(--he-body-size);line-height:var(--he-body-line)}');
    expect(out).toContain('.prose-edge h2{font-size:calc(var(--he-h2-size) * 1)}');
    expect(out).toContain('.prose-edge>*+*{margin-top:1.35em}');
    // The space after a heading is written before the space above one, so a heading after a heading takes the latter.
    expect(out.indexOf(':is(h2,h3,h4)+*{margin-top:16px}')).toBeLessThan(out.indexOf('.prose-edge :is(h2,h3){margin-top:48px}'));
    expect(out).toContain('.prose-edge ul{list-style:disc;padding-left:32px}');
    expect(out).toContain('.prose-edge ul>li::before{content:none}');
    expect(out).toContain('.prose-edge li+li{margin-top:4px}');
  });

  it('checks the values', () => {
    expect(themeSchema.safeParse({ richText: { headingScale: 3 } }).success).toBe(false);
    expect(themeSchema.safeParse({ richText: { paragraphGap: '1em;x' } }).success).toBe(false);
  });

  it('lets plain paragraphs run the full width', () => {
    const base = { paragraphs: ['One'] };
    expect(renderToStaticMarkup(<ProseBlock {...blockSchemas.prose.parse(base)} />)).toContain('max-w-[62ch]');
    const full = renderToStaticMarkup(<ProseBlock {...blockSchemas.prose.parse({ ...base, measure: 'full' })} />);
    expect(full).not.toContain('max-w-[62ch]');
    expect(full).toContain('max-w-none');
  });
});

describe('C2 — text-only card sliders', () => {
  const slides = [{ title: 'Brand positioning', body: 'Text' }, { title: 'Messaging' }];
  it('keeps every slide as before until told otherwise', () => {
    const parsed = blockSchemas.carousel.parse({ slides });
    expect(parsed.slideNoPicture).toBeUndefined();
    expect(parsed.autoplayButton).toBeUndefined();
  });
  it('takes the box, the gap, bare chevrons and an autoplay with no button', () => {
    expect(
      blockSchemas.carousel.safeParse({ slides, slideNoPicture: 'none', slideBackground: 'rgba(150,144,162,0.06)', slidePadding: '20px', slideGap: '30px', slideGapMobile: '16px', arrowStyle: 'chevron', autoplay: true, loop: false, autoplayButton: false }).success,
    ).toBe(true);
    expect(blockSchemas.carousel.safeParse({ slides, slideBackground: 'red;x' }).success).toBe(false);
    expect(css('library-blocks.css')).toContain('.he-car.has-slide-gap .he-car__track { --gap: var(--he-car-gap); }');
  });
});

describe('C3 — project card type and gaps', () => {
  it('writes each only when set', () => {
    expect(projectCardLook({ titleSize: '19.92px', titleWeight: '600', titleTracking: '-0.03em', categorySize: '15.58px', textGap: '12px', columnGap: '32px', rowGap: '32px' })).toEqual({
      className: ['has-title-size', 'has-title-tracking', 'has-cat-size', 'has-text-gap', 'has-col-gap', 'has-row-gap', 'has-title-weight'],
      style: {
        '--he-proj-title-size': '19.92px',
        '--he-proj-title-tracking': '-0.03em',
        '--he-proj-cat-size': '15.58px',
        '--he-proj-text-gap': '12px',
        '--he-proj-col-gap': '32px',
        '--he-proj-row-gap': '32px',
        '--he-proj-title-weight': '600',
      },
    });
    expect(blockSchemas.projects.safeParse({ card: { titleSize: '20px;x' } }).success).toBe(false);
  });
});

describe('C4 — the space after a card’s picture', () => {
  it('parses per tier and makes up the difference from the space between parts', () => {
    expect(blockSchemas.cardGrid.safeParse({ cards: [], mediaGap: '20px', mediaGapTablet: '16px', mediaGapMobile: '12px' }).success).toBe(true);
    expect(css('library-content.css')).toContain('margin-bottom: calc(var(--he-fgrid-mg) - var(--he-fgrid-pg, 0px));');
  });
});

describe('C5 — a card-link role per block', () => {
  it('styles the card links after body text, so they can differ from it', () => {
    const style = blockStyleSchema.parse({ typography: { body: { size: '22px' }, cardLink: { size: '16.4px', weight: '400' } } });
    const out = blockStyleToCss('b1', style);
    const body = out.indexOf('font-size:22px');
    const link = out.indexOf('font-size:16.4px');
    expect(body).toBeGreaterThan(-1);
    expect(link).toBeGreaterThan(body);
    expect(out).toContain('.he-fgrid__more');
  });
});

describe('C7/C8 — the menu’s details and the lit link', () => {
  it('keeps the menu and the header as they were', () => {
    const c = resolveChrome(undefined);
    expect(c.header.activeMatch).toBe('section');
    expect(c.mobileMenu.itemLineHeight).toBeUndefined();
    expect(c.mobileMenu.itemPadding).toBeUndefined();
    expect(c.mobileMenu.columnPadding).toBeUndefined();
    expect(c.mobileMenu.socialPlace).toBe('below');
  });
  it('checks the new values', () => {
    expect(chromeSchema.safeParse({ header: { activeMatch: 'exact' }, mobileMenu: { itemLineHeight: '1.2', itemPadding: '4px', columnPadding: '54px', socialPlace: 'beside', onPhones: { variant: 'drawer', itemLineHeight: '24px', itemPadding: '8px', itemColor: 'rgba(255,255,255,0.75)' } } }).success).toBe(true);
    expect(chromeSchema.safeParse({ mobileMenu: { itemLineHeight: 'tall' } }).success).toBe(false);
    expect(chromeSchema.safeParse({ mobileMenu: { onPhones: { itemColor: 'red;x' } } }).success).toBe(false);
  });
});
