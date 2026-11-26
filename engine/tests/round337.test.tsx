import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { CardGridVariant, MediaBand } from '@/components/blocks/library/content';
import { ShowAll } from '@/components/blocks/library/elements-client';
import { blockSchemas } from '@/lib/blocks';
import { blockStyleSchema } from '@/lib/blockStyle';
import { blockStyleToCss } from '@/lib/blockStyle-css';
import { itemStyleSchema, itemStyleToCss } from '@/lib/itemStyle';
import { pictureZoom } from '@/lib/pictureZoom';
import { FONT_CATALOGUE } from '@/lib/fontCatalogue';
import { themeSchema } from '@/lib/theme';
import { themeToCss } from '@/lib/theme-css';

/* 3.37 — pictures placed per screen, section backgrounds sized and layered,
   the theme's paragraph sizes, and the smaller options from the same round.
   Each off, and drawn as before, until set. */

vi.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => ({ push() {} }) }));
vi.mock('@/components/site/Messages', () => ({ useMessages: () => (k: string) => k }));
const { BlockRenderer } = await import('@/components/blocks/Renderer');
const render = (blocks: unknown[]) => renderToStaticMarkup(<BlockRenderer blocks={blocks as never} />);

const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');
const style = (value: unknown) => blockStyleToCss('a', blockStyleSchema.parse(value));
const theme = (value: unknown) => themeToCss(themeSchema.parse(value));
const grid = (extra: Record<string, unknown> = {}, card: Record<string, unknown> = {}) =>
  renderToStaticMarkup(<CardGridVariant {...blockSchemas.cardGrid.parse({ variant: 'overlay', cards: [{ title: 'One', body: 'Words', imageUrl: '/media/a.png', ...card }, { title: 'Two', imageUrl: '/media/b.png' }], ...extra })} />);
const band = (extra: Record<string, unknown> = {}) => renderToStaticMarkup(<MediaBand {...blockSchemas.mediaBand.parse({ title: 'T', body: 'One\n\nTwo', imageUrl: '/media/a.png', ...extra })} />);

describe('a picture zoomed and placed in its box', () => {
  it('writes nothing unset', () => {
    expect(pictureZoom({})).toEqual({ className: [], style: {} });
    expect(band()).not.toMatch(/has-p[zf]|--he-p[zf]/);
    expect(grid()).not.toMatch(/has-p[zf]|--he-p[zf]/);
  });
  it('scales by the zoom about the focus, per screen', () => {
    expect(pictureZoom({ imageZoom: 124.5, imageFocusMobile: '46% 50%', imageZoomTablet: 110, imageFit: 'fill' })).toEqual({
      className: ['has-pz', 'has-pz-t', 'has-pf-m', 'has-pfit'],
      style: { '--he-pz': '1.245', '--he-pz-t': '1.1', '--he-pf-m': '46% 50%', '--he-pfit': 'fill' },
    });
  });
  it('reaches a media band and a card', () => {
    expect(band({ imageZoom: 120, imageFocus: '30% 20%' })).toMatch(/class="[^"]*he-band[^"]*has-pz has-pf"[^>]*style="--he-pz:1.2;--he-pf:30% 20%/);
    expect(grid({}, { imageZoomMobile: 115, imageFocusMobile: '50% 0%' })).toContain('has-pz-m has-pf-m');
    const css = read('src/styles/library-details.css');
    expect(css).toContain('.he-band.has-pz .he-band__bg, .he-ocard.has-pz .he-ocard__bg');
    expect(css).toContain('scale: var(--he-pz)');
  });
  it('refuses what isn’t a zoom or a place', () => {
    expect(blockSchemas.mediaBand.safeParse({ imageZoom: 50 }).success).toBe(false);
    expect(blockSchemas.mediaBand.safeParse({ imageFocus: '1px;}' }).success).toBe(false);
  });
});

describe('a section background sized, placed and layered', () => {
  it('writes the picture as before when unset', () => {
    expect(style({ background: { imageUrl: '/media/a.png', size: 'cover', position: 'top' } })).toContain('.he-b-a{background-image:url("/media/a.png");background-size:cover;background-position:top}');
  });
  it('takes written sizes and places over the choices, and on phones', () => {
    const out = style({ background: { imageUrl: '/media/a.png', size: 'cover', sizeCustom: '120% auto', positionCustom: '-30px 10%', mobile: { sizeCustom: '900px auto', positionCustom: 'left 12px' } } });
    expect(out).toContain('background-size:120% auto;background-position:-30px 10%');
    expect(out).toContain('@media (max-width:768px){.he-b-a{background-size:900px auto;background-position:left 12px}');
  });
  it('draws a gradient under or over the picture, filling the section', () => {
    const under = style({ background: { imageUrl: '/media/a.png', gradientLayer: 'under', gradient: { stops: '#112233 20%, #445566 80%', angle: '180' } } });
    expect(under).toContain('background-image:url("/media/a.png"),linear-gradient(180deg,#112233 20%,#445566 80%);background-size:auto,100% 100%;background-position:0% 0%,0% 0%;background-repeat:repeat,no-repeat');
    const over = style({ background: { imageUrl: '/media/a.png', size: 'cover', gradientLayer: 'over', gradient: { from: '#000', to: '#fff' } } });
    expect(over).toContain('background-image:linear-gradient(135deg,#000,#fff),url("/media/a.png");background-size:100% 100%,cover');
  });
  it('keeps a gradient to sections without a picture unless it is layered', () => {
    expect(style({ background: { imageUrl: '/media/a.png', gradient: { stops: '#112233 20%, #445566 80%' } } })).not.toContain('linear-gradient');
  });
  it('gives phones a gradient of their own, in the wider screen’s direction', () => {
    const out = style({ background: { imageUrl: '/media/a.png', gradientLayer: 'under', gradient: { stops: '#111111 10%, #222222 90%', angle: '180' }, mobile: { gradient: { stops: '#333333 0%, #444444 100%' }, positionCustom: '-10px 0' } } });
    expect(out).toContain('@media (max-width:768px){.he-b-a{background-image:url("/media/a.png"),linear-gradient(180deg,#333333 0%,#444444 100%);background-size:auto,100% 100%;background-position:-10px 0,0% 0%');
  });
  it('refuses what could break out of the rule', () => {
    expect(blockStyleSchema.safeParse({ background: { sizeCustom: '1px;}' } }).success).toBe(false);
    expect(blockStyleSchema.safeParse({ background: { positionCustom: 'url(x)' } }).success).toBe(false);
    expect(blockStyleSchema.safeParse({ background: { gradient: { stops: 'red 10%; x' } } }).success).toBe(false);
  });
});

describe('the bands’ and cards’ paragraphs at the theme’s sizes', () => {
  it('writes nothing unset', () => {
    const out = theme({});
    expect(out).not.toContain('--he-block-body');
    expect(out).not.toContain('--he-block-card');
  });
  it('sizes them everywhere, a block’s own type still winning', () => {
    const out = theme({ blockText: { body: '16px', card: '15.5px' } });
    expect(out).toContain('--he-block-body:16px');
    expect(out).toContain('@layer he-details{.he-lbody{font-size:var(--he-block-body)}}');
    expect(out).toContain('@layer he-details{:is(.he-ocard__body,.he-ocard__points li,.he-plst__excerpt){font-size:var(--he-block-card)}}');
  });
  it('on phones only, when only the phone size is set', () => {
    expect(theme({ blockTextMobile: { body: '15px' } })).toContain('@media (max-width:768px){@layer he-details{.he-lbody{font-size:var(--he-block-body)}}}');
  });
  it('lets a post card’s own excerpt type fall back to it', () => {
    expect(read('src/styles/library-details.css')).toContain('var(--he-plst-e-size, var(--he-block-card, revert-layer))');
  });
});

describe('the body face', () => {
  it('has Google Sans Flex in the catalogue, self-hosted', () => {
    expect(FONT_CATALOGUE.some((f) => f.key === 'googleSansFlex' && f.family === 'Google Sans Flex')).toBe(true);
    expect(read('src/styles/fonts-google.css')).toContain("font-family: 'Google Sans Flex'");
  });
});

describe('buttons, stacked on phones in a centred band', () => {
  it('stay centred, each at its own width', () => {
    expect(style({ buttonsMobile: 'fit' })).toContain('.he-b-a .he-band:is(.is-m-center,.is-m-bottomCenter) .he-actions{align-items:center}');
  });
  it('take colours of their own on phones', () => {
    expect(style({ buttonColorsMobile: { primary: { background: '#ffffff' } } })).toBe('@media (max-width:768px){.he-b-a{--he-btn-primary-bg:#ffffff}}');
  });
  it('draw the arrow at a thickness of its own', () => {
    expect(theme({ buttons: { arrowStroke: 1.5 } })).toMatch(/\.he-jobc__btn>svg:last-child\{stroke-width:1\.5\}/);
    expect(themeSchema.safeParse({ buttons: { arrowStroke: 9 } }).success).toBe(false);
  });
});

describe('a media band’s words on phones', () => {
  it('splits paragraphs only with a gap between them', () => {
    expect(band()).toContain('<p class="he-lbody">One\n\nTwo</p>');
    const split = band({ textBox: { paragraphGap: '10px', insetMobile: '12px', bodyWidthMobile: 'min(300px, 60vw)', actionsGapMobile: '24px' } });
    expect(split).toContain('<p class="he-lbody">One</p><p class="he-lbody">Two</p>');
    expect(split).toContain('--he-band-inset-m:12px;--he-band-body-m:min(300px, 60vw);--he-band-actions-gap-m:24px;--he-band-pgap:10px');
  });
  it('keeps a phone fade over a phone picture, and its own eyebrow space over the site’s', () => {
    expect(read('src/styles/library-upgrades.css')).toContain('.he-band.has-mobile-media.has-fade:not(.has-fade-m)::after');
    const details = read('src/styles/library-details.css');
    expect(details.slice(details.lastIndexOf('@layer'))).not.toContain('has-eyebrow-gap');
    expect(details).toMatch(/\n\.he-band__inner\.has-eyebrow-gap \.he-eyebrow \{ margin-bottom: var\(--he-band-eyebrow-gap\); \}/);
  });
});

describe('type of a section’s own', () => {
  it('spaces words and breaks lines per screen, and takes normal line height', () => {
    const out = style({ typography: { heading: { wordSpacing: '-4px', wrap: 'wrap', wrapMobile: 'balance', lineHeight: 'normal' }, eyebrow: { spaceBelow: '12px', spaceBelowMobile: '8px' } } });
    expect(out).toContain('line-height:normal');
    expect(out).toContain('word-spacing:-4px;text-wrap:wrap');
    expect(out).toContain('text-wrap:balance');
    expect(out).toMatch(/@media \(max-width:768px\)\{[^@]*\.he-b-a \.he-eyebrow\{margin-bottom:8px\}/);
    expect(blockStyleSchema.safeParse({ typography: { body: { wrap: 'nowrap' } } }).success).toBe(false);
  });
  it('sets the heading’s measure per screen', () => {
    expect(style({ titleWidthMobile: '320px' })).toBe('@media (max-width:768px){.he-b-a{--he-title-measure:320px}}');
  });
});

describe('one card apart from the rest', () => {
  it('gives its title a size, spacing and width of its own, heavier than the block’s type', () => {
    const out = itemStyleToCss('.he-i-x-0', itemStyleSchema.parse({ titleSize: '26px', titleTrackingMobile: '-0.2px' }));
    expect(out).toBe('.he-i-x-0.he-i-x-0 :is(h1,h2,h3,h4,h5,h6):not(.type-eyebrow){font-size:26px}@media (max-width:768px){.he-i-x-0.he-i-x-0 :is(h1,h2,h3,h4,h5,h6):not(.type-eyebrow){letter-spacing:-0.2px}}');
  });
  it('takes its phone corners', () => {
    const out = itemStyleToCss('.he-i-x-0', itemStyleSchema.parse({ corners: { style: 'leaf', size: 60, sizeMobile: 40 } }));
    expect(out).toContain('@media (max-width:768px){.he-i-x-0{border-radius:0px 40px 0px 40px');
  });
});

describe('pictures with text over them', () => {
  it('draw as before with nothing set', () => {
    const html = grid();
    expect(html).not.toMatch(/has-lg|has-hi|--he-ocard-lg|--he-ocard-pin/);
  });
  it('take a label gap, a head inset, a bullet indent and a two-length bullet gap', () => {
    const html = grid({ labelGap: '16px', labelGapMobile: '10px', headInset: '24px', pointsInset: '20px', pointsGap: '9px 16px' });
    expect(html).toContain('has-lg has-lg-m has-hi');
    expect(html).toContain('--he-ocard-pgap:9px 16px;--he-ocard-lg:16px;--he-ocard-lg-m:10px;--he-ocard-hi:24px;--he-ocard-pin:20px');
    expect(blockSchemas.cardGrid.safeParse({ pointsGap: '1px 2px 3px' }).success).toBe(false);
  });
  it('count the card number as a label, shown as coloured', () => {
    expect(style({ typography: { cardLabel: { color: '#123456' } } })).toContain('.he-ocard__num):not(.type-eyebrow){color:#123456}.he-b-a .he-ocard__num{opacity:1}');
  });
  it('let a card’s own height win over the grid’s, and the part gap reach the words', () => {
    const css = read('src/styles/library-details.css');
    expect(css).toContain('.he-fgrid.is-overlay .he-ocard.he-ocard.has-own-h { min-height: var(--he-ocard-own-h); }');
    expect(css).toContain('.he-fgrid.is-overlay.has-pg .he-ocard__text > * + * { margin-top: var(--he-fgrid-pg); }');
  });
});

describe('a sliding row', () => {
  it('takes a card width as a length, and side arrows set in', () => {
    const out = style({ swipeOn: 'always', swipeCardWidth: '400px', swipeCardWidthMobile: '320px', swipeArrows: 'sides', swipeArrowInset: '100px' });
    expect(out).toContain(':not(.he-swipe-track *))>*{flex:0 0 400px}');
    expect(out).toContain(':not(.he-swipe-track *))>*{flex:0 0 320px}}');
    expect(out).toContain('.he-b-a .he-swipe-nav.is-sides{padding-inline:100px}');
    expect(style({ swipeOn: 'always', swipeArrowInset: '100px' })).not.toContain('padding-inline:100px');
  });
});

describe('the smaller blocks', () => {
  it('a text block’s title gap marks the title only when set', () => {
    const plain = render([{ id: 'p', type: 'prose', props: { title: 'T', paragraphs: ['x'] } }]);
    expect(plain).not.toContain('he-prose__title');
    const own = render([{ id: 'p', type: 'prose', props: { title: 'T', paragraphs: ['x'], titleGap: '24px', titleGapMobile: '8px' } }]);
    expect(own).toContain('he-prose-tg he-prose-tg-m');
    expect(own).toContain('--he-prose-tg:24px;--he-prose-tg-m:8px');
    expect(own).toContain('he-prose__title');
  });
  it('a heading’s subtitle gap on phones', () => {
    const html = render([{ id: 'h', type: 'heading', props: { title: 'T', subtitle: 'S', subtitleGapMobile: '40px' } }]);
    expect(html).toContain('he-hd__sub has-gap-m');
    expect(html).toContain('--he-hd-sub-gap-m:40px');
  });
  it('link rows: a width for the words, and the rules between or below', () => {
    const plain = render([{ id: 'l', type: 'checkLists', props: { layout: 'linkRows', lists: [{ items: ['a'] }] } }]);
    expect(plain).not.toMatch(/is-rules-|has-tw|--he-ilist-tw/);
    const own = render([{ id: 'l', type: 'checkLists', props: { layout: 'linkRows', textWidth: '320px', rules: 'below', lists: [{ items: ['a'] }] } }]);
    expect(own).toContain('is-rules-below has-tw');
    expect(own).toContain('--he-ilist-tw:320px');
  });
  it('the team’s show-all button: its arrow turned, on phones, and its distance', () => {
    expect(renderToStaticMarkup(<ShowAll arrow />)).not.toMatch(/he-show__(up|arrow)|has-gap|style=/);
    const html = renderToStaticMarkup(<ShowAll arrow="upRight" arrowMobile={false} gap="60px" gapMobile="40px" />);
    expect(html).toContain('class="he-show__more has-gap has-gap-m" style="--he-show-gap:60px;--he-show-gap-m:40px"');
    expect(html).toContain('he-show__up he-show__arrow-d');
    expect(renderToStaticMarkup(<ShowAll arrowMobile />)).toContain('he-show__arrow-m');
  });
  it('the gallery’s magnifier set in from each edge apart', () => {
    const css = read('src/styles/library-details.css');
    expect(css).toContain('top: var(--he-gal-zoom-y, var(--he-gal-zoom-at, 12px)); right: var(--he-gal-zoom-x, var(--he-gal-zoom-at, 12px))');
  });
});
