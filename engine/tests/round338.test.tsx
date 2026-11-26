import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { CardGridVariant } from '@/components/blocks/library/content';
import { blockSchemas } from '@/lib/blocks';
import { blockStyleSchema } from '@/lib/blockStyle';
import { blockStyleToCss, hasZoomedBackground } from '@/lib/blockStyle-css';
import { blogSchema } from '@/lib/blog';
import { blogCss } from '@/lib/blogCss';
import { careersCss } from '@/lib/careersLook';
import { FILL_FACES, SUBSET_RANGES } from '@/lib/fontFaces';
import { isLength } from '@/lib/lengthGrammar';
import { pageAppearanceSchema } from '@/lib/pageAppearance';
import { pictureZoom } from '@/lib/pictureZoom';
import { themeSchema } from '@/lib/theme';
import { themeToCss } from '@/lib/theme-css';

/* 3.38 — what was still different after 3.37: the variable face's optical
   sizes, one face's missing alphabets from another, zoomed section
   backgrounds, layers on a card's picture, post covers framed, and the
   smaller options. Each off, and drawn as before, until set. */

vi.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => ({ push() {} }) }));
vi.mock('@/components/site/Messages', () => ({ useMessages: () => (k: string) => k }));
const { BlockRenderer } = await import('@/components/blocks/Renderer');
const render = (blocks: unknown[]) => renderToStaticMarkup(<BlockRenderer blocks={blocks as never} />);

const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');
const style = (value: unknown) => blockStyleToCss('a', blockStyleSchema.parse(value));
const theme = (value: unknown) => themeToCss(themeSchema.parse(value));
const grid = (card: Record<string, unknown> = {}) =>
  renderToStaticMarkup(<CardGridVariant {...blockSchemas.cardGrid.parse({ variant: 'overlay', cards: [{ title: 'One', imageUrl: '/media/a.png', ...card }] })} />);

describe('the variable face at its own optical size', () => {
  it('is fetched with its optical-size axis, every other family as before', () => {
    expect(read('scripts/fetch-fonts.mjs')).toContain("'Google Sans Flex': 'opsz,wght@6..144,100..900'");
  });
});

describe('a face’s missing alphabets from another face', () => {
  it('writes nothing unset', () => {
    expect(theme({})).not.toContain('@font-face');
  });
  it('declares the face again over the other face’s files, for the alphabets it lacks only', () => {
    const out = theme({ fontFill: { googleSansFlex: 'googleSans' } });
    // 3.38.1 — under the face's own weight range, so ordinary text still finds the face's Latin; no italic copies for a face without one.
    expect(out).toContain(`@font-face{font-family:'Google Sans Flex';font-style:normal;font-weight:100 900;font-display:swap;src:url('/fonts/google/google-sans-normal-var-cyrillic.woff2') format('woff2');unicode-range:${SUBSET_RANGES.cyrillic}}`);
    expect(out).not.toMatch(/font-family:'Google Sans Flex';font-style:italic/);
    expect(out).not.toMatch(/font-family:'Google Sans Flex'[^}]*font-weight:400 700/);
    expect(out).not.toMatch(/font-family:'Google Sans Flex'[^}]*-latin\.woff2/);
    expect(FILL_FACES['Google Sans']!.some(([, , subset]) => subset === 'cyrillic')).toBe(true);
  });
  it('takes catalogue faces only', () => {
    expect(themeSchema.safeParse({ fontFill: { 'x;}': 'googleSans' } }).success).toBe(false);
    expect(themeSchema.safeParse({ fontFill: { googleSansFlex: 'Comic' } }).success).toBe(false);
  });
});

describe('the theme’s card size on plain cards', () => {
  it('reaches their words too', () => {
    expect(theme({ blockText: { card: '16px' } })).toContain('.he-ucard__body){font-size:var(--he-block-card)}');
  });
});

describe('a section background zoomed about a point', () => {
  it('adds nothing unset', () => {
    expect(hasZoomedBackground(blockStyleSchema.parse({ background: { imageUrl: '/media/a.png' } }))).toBe(false);
    expect(render([{ id: 'h', type: 'heading', style: { background: { imageUrl: '/media/a.png' } }, props: { title: 'T' } }])).not.toContain('he-bgz');
  });
  it('draws the picture on a layer of its own, zoomed at the focus, a gradient over it', () => {
    const value = { background: { imageUrl: '/media/a.png', zoom: 120, focus: '0% 0%', gradientLayer: 'over', gradient: { stops: '#000000 0%, #ffffff 100%', angle: '270' } } };
    const out = style(value);
    expect(out).not.toContain('.he-b-a{background-image:url');
    expect(out).toContain('.he-b-a>.he-bgz::before{background:url("/media/a.png") 0% 0%/cover no-repeat;transform-origin:0% 0%;scale:1.2}');
    expect(out).toContain('.he-b-a>.he-bgz::after{background:linear-gradient(270deg,#000000 0%,#ffffff 100%)}');
    expect(render([{ id: 'h', type: 'heading', style: value, props: { title: 'T' } }])).toContain('<span class="he-bgz" aria-hidden="true"></span>');
  });
  it('keeps a gradient under it on the section, and zooms on phones alone when asked', () => {
    const under = style({ background: { imageUrl: '/media/a.png', zoom: 110, gradientLayer: 'under', gradient: { stops: '#000000 0%, #ffffff 100%' } } });
    expect(under).toContain('background-image:linear-gradient(135deg,#000000 0%,#ffffff 100%)');
    const phone = style({ background: { imageUrl: '/media/a.png', size: 'cover', mobile: { zoom: 130, focus: '50% 0%' } } });
    expect(phone).toContain('.he-b-a{background-image:url("/media/a.png");background-size:cover}');
    expect(phone).toContain('.he-b-a>.he-bgz{display:none}');
    expect(phone).toContain('@media (max-width:768px){.he-b-a>.he-bgz{display:block}.he-b-a>.he-bgz::before{background:url("/media/a.png") 50% 0%/cover no-repeat;transform-origin:50% 0%;scale:1.3}');
  });
  it('refuses what isn’t a zoom or a place', () => {
    expect(blockStyleSchema.safeParse({ background: { zoom: 20 } }).success).toBe(false);
    expect(blockStyleSchema.safeParse({ background: { focus: '1px;}' } }).success).toBe(false);
  });
});

describe('layers on a card’s picture', () => {
  it('draw nothing unset', () => {
    expect(grid()).not.toMatch(/has-ov|has-under|--he-ocard-ov|--he-ocard-u/);
  });
  it('lay a gradient over it, and on phones, and a colour and picture under it', () => {
    const html = grid({ imageOverlay: { stops: 'rgba(0,0,0,0) 40%, rgba(0,0,0,0.5) 100%', angle: -87.1 }, imageOverlayMobile: { stops: '#000000 0%, #111111 100%' }, underlay: { color: '#123456', imageUrl: '/media/b.png', size: '100% auto', position: '50% 100%' } });
    expect(html).toContain('has-ov has-ov-m has-under');
    expect(html).toContain('--he-ocard-ov:linear-gradient(-87.1deg,rgba(0,0,0,0) 40%, rgba(0,0,0,0.5) 100%)');
    expect(html).toContain('--he-ocard-uc:#123456;--he-ocard-ui:url(&quot;/media/b.png&quot;);--he-ocard-us:100% auto;--he-ocard-up:50% 100%');
  });
  it('take a fit per screen', () => {
    expect(pictureZoom({ imageFitMobile: 'fill' })).toEqual({ className: ['has-pfit-m'], style: { '--he-pfit-m': 'fill' } });
  });
  it('refuse what could break out', () => {
    expect(blockSchemas.cardGrid.safeParse({ cards: [{ title: 'x', imageOverlay: { stops: 'red 1%; x' } }] }).success).toBe(false);
    expect(blockSchemas.cardGrid.safeParse({ cards: [{ title: 'x', underlay: { imageUrl: 'javascript:x' } }] }).success).toBe(false);
  });
});

describe('post covers framed', () => {
  it('a post keeps its own cover framing', () => {
    expect(pageAppearanceSchema.parse({ cover: { imageZoom: 120, imageFocus: '0% 100%' } }).cover).toEqual({ imageZoom: 120, imageFocus: '0% 100%' });
    expect(pageAppearanceSchema.safeParse({ cover: { imageZoom: 20 } }).success).toBe(false);
    expect(read('src/styles/library-details.css')).toContain('.he-plst__media.has-pz .he-fill, .he-post-aside__card.has-pz .he-post-aside__img');
  });
  it('the blog post’s cover per screen, under a post’s own framing', () => {
    const out = blogCss(blogSchema.parse({ look: { post: { asideCoverZoomMobile: 130, asideCoverFocusMobile: '0% 100%' } } }));
    expect(out).toContain('@layer he-details{@media (max-width:768px){.he-post-aside__img{scale:1.3;object-position:0% 100%;transform-origin:0% 100%}}}');
  });
  it('the article’s first heading has no space above it, counting what this tier hides', () => {
    const none = blogCss(blogSchema.parse({ look: { post: { headingGap: '8px' } } }));
    expect(none).not.toContain(':first-child');
    const out = blogCss(blogSchema.parse({ look: { post: { sectionGap: '9px' } } }));
    expect(out).toContain('.he-post .prose-edge>:is(h2,h3):first-child{margin-top:0}');
    expect(out).toContain('@media (width <= 48rem){.he-post .prose-edge>.he-hide-mobile:first-child+:is(h2,h3),');
  });
  it('post card sizes take min(), max() and calc() like the theme’s', () => {
    expect(blogSchema.safeParse({ card: { imageBox: { width: 'max(400px, 110%)' } } }).success).toBe(true);
  });
});

describe('the smaller options', () => {
  it('lengths take calc() of plain lengths, inside min(), max() and clamp() too', () => {
    expect(isLength('calc(100vw - 468px)')).toBe(true);
    expect(isLength('max(0px, calc(100vw - 468px))')).toBe(true);
    expect(isLength('calc(100% + 2rem - 4px)')).toBe(true);
    expect(isLength('calc(100vw-468px)')).toBe(false);
    expect(isLength('calc(1px);}')).toBe(false);
    expect(isLength('calc(var(--x) + 1px)')).toBe(false);
  });
  it('the pinned counter set in from the row’s end', () => {
    expect(style({ scrollPin: { at: ['base'], counterInset: '80px' } })).toContain('--he-pin-count-inset:80px');
    expect(read('src/styles/library-scroll.css')).toContain('.he-pin__progress { margin-right: var(--he-pin-count-inset, 0px); }');
  });
  it('bullet columns as wide as their words', () => {
    expect(grid()).not.toContain('is-points-auto');
    const html = renderToStaticMarkup(<CardGridVariant {...blockSchemas.cardGrid.parse({ variant: 'overlay', pointsColumnWidth: 'auto', cards: [{ title: 'One' }] })} />);
    expect(html).toContain('is-points-auto');
  });
  it('gallery pictures and an image block zoomed', async () => {
    const { ImageBlock } = await import('@/components/blocks/index');
    const image = (props: Record<string, unknown>) => renderToStaticMarkup(<ImageBlock {...blockSchemas.image.parse({ url: '/media/a.png', ...props })} />);
    const plain = image({});
    expect(plain).not.toContain('he-img-zoom');
    const zoomed = image({ imageZoom: 110 });
    expect(zoomed).toContain('<span class="he-img-zoom has-pz" style="--he-pz:1.1">');
    expect(read('src/styles/library-details.css')).toContain('.he-gal__item.has-pz .he-gal__media .he-fill');
  });
  it('the careers card button’s own arrow', () => {
    expect(careersCss({ buttonArrowSize: '10px', buttonArrowStroke: 1.5 })).toContain('.he-jobc .he-jobc__btn>svg:last-child{width:10px;height:10px;stroke-width:1.5}');
    expect(careersCss({})).not.toContain('stroke-width');
  });
});

