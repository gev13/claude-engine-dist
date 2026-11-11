import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { CardGridVariant, MediaBand } from '@/components/blocks/library/content';
import { HeadingBlock, TeamBlock } from '@/components/blocks/library/elements';
import { blockSchemas, parseBlock } from '@/lib/blocks';
import { blockStyleSchema } from '@/lib/blockStyle';
import { blockStyleToCss, rowToCss } from '@/lib/blockStyle-css';
import { blogCss } from '@/lib/blogCss';
import { blogSchema } from '@/lib/blog';
import { careersCss, careersLookSchema, resolveCareersLook } from '@/lib/careersLook';
import { chromeSchema } from '@/lib/chrome';
import { chromeCss } from '@/lib/chromeCss';
import { COOKIE_BOX, cookieNoticeSchema } from '@/lib/cookies';
import { MESSAGES } from '@/lib/messages';
import { arrowCursor } from '@/lib/pointerArrow';
import { themeSchema } from '@/lib/theme';
import { themeToCss } from '@/lib/theme-css';
import { typeRule, typeVars } from '@/lib/typeStyle';

/* 3.33 — the options a design needed so that it takes no custom CSS. Every
   one is off, and draws what it drew before, until set. */

vi.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => ({ push() {} }) }));

const css = (file: string) => readFileSync(join(__dirname, '../src/styles', file), 'utf8');
const style = (value: unknown) => blockStyleToCss('a', blockStyleSchema.parse(value));
const col = (id: string, base = 6, more: Record<string, unknown> = {}) => ({ id, width: { base }, ...more });

describe('rows: exact tracks', () => {
  it('writes twelfths while unset', () => {
    expect(rowToCss({ id: 'r', columns: [col('a', 6), col('b', 6)] })).toContain('grid-template-columns:minmax(0,6fr) minmax(0,6fr)');
  });
  it('writes the tracks given, fractions as minmax so a long word cannot widen them', () => {
    const out = rowToCss({ id: 'r', tracks: { base: '592fr 230px' }, columns: [col('a'), col('b')] });
    expect(out).toContain('grid-template-columns:minmax(0,592fr) 230px');
  });
  it('carries a written list down a tier, until the columns stack', () => {
    const out = rowToCss({ id: 'r', tracks: { base: '2fr 1fr' }, columns: [col('a', 6, { width: { base: 6, mobile: 12 } }), col('b', 6, { width: { base: 6, mobile: 12 } })] });
    expect(out).toContain('@media (max-width:768px){.he-r-r{grid-template-columns:minmax(0,1fr)}}');
  });
  it('gives a tier its own list', () => {
    expect(rowToCss({ id: 'r', tracks: { mobile: '230px 1fr' }, columns: [col('a'), col('b')] })).toContain('@media (max-width:768px){.he-r-r{grid-template-columns:230px minmax(0,1fr)}}');
  });
  it('refuses a list that could break out of the style element', () => {
    expect(blockSchemas.row.safeParse({ columns: [col('a', 12)], tracks: { base: '1fr;}body{' } }).success).toBe(false);
    expect(rowToCss({ id: 'r', tracks: { base: '1fr;}' }, columns: [col('a', 12)] })).not.toContain(';}');
  });
});

describe('columns: alignment per tier', () => {
  it('survives the parse the renderer reads through', () => {
    const block = parseBlock({ id: 'r', type: 'row', props: { columns: [{ id: 'a', width: { base: 12 }, alignSelf: { base: 'start' }, justify: { mobile: 'between' }, blocks: [] }] } });
    const column = (block?.props as { columns: { alignSelf?: unknown; justify?: unknown }[] }).columns[0]!;
    expect(column.alignSelf).toEqual({ base: 'start' });
    expect(column.justify).toEqual({ mobile: 'between' });
  });
  it('writes nothing while unset', () => {
    expect(rowToCss({ id: 'r', columns: [col('a')] })).not.toContain('align-self');
    expect(rowToCss({ id: 'r', columns: [col('a')] })).not.toContain('justify-content');
  });
  it('places a column and spreads its blocks, on the tier asked', () => {
    const out = rowToCss({ id: 'r', columns: [col('a', 6, { alignSelf: { base: 'start' }, justify: { mobile: 'between' } })] });
    expect(out).toContain('.he-r-r>.he-c-a{align-self:start}');
    expect(out).toContain('@media (max-width:768px){.he-r-r>.he-c-a{display:flex;flex-direction:column;justify-content:space-between}}');
  });
});

describe('the Design panel', () => {
  it('background on phones: a colour, a picture, or none', () => {
    expect(style({})).toBe('');
    expect(style({ background: { mobile: { color: '#123456' } } })).toContain('@media (max-width:768px){.he-b-a{background-color:#123456}.he-b-a>*{background:transparent}}');
    expect(style({ background: { mobile: { clear: true } } })).toContain('background-color:transparent;background-image:none');
    expect(style({ background: { mobile: { imageUrl: '/media/a.png', position: 'top' } } })).toContain('background-image:url("/media/a.png");background-position:top');
  });
  it('a column keeps its blocks’ own backgrounds', () => {
    const out = blockStyleToCss('c', blockStyleSchema.parse({ background: { mobile: { color: '#123456' } } }), 'he-c', false, '.he-r-r>');
    expect(out).not.toContain('>*{background:transparent}');
  });
  it('a width without centring, and on phones', () => {
    expect(style({ maxWidth: '560px' })).toContain('margin-inline:auto');
    const out = style({ maxWidth: '560px', maxWidthAlign: 'start', maxWidthMobile: '320px' });
    expect(out).toContain('margin-left:0;margin-right:auto');
    expect(out).toContain('@media (max-width:768px){.he-b-a{max-width:320px}}');
  });
  it('a panel set aside or inset differently on phones', () => {
    expect(style({ panel: true })).not.toContain('@media');
    expect(style({ panel: true, panelMobile: 'off' })).toContain('@media (max-width:768px){.he-b-a{margin-inline:0;background-color:transparent;clip-path:none}}');
    expect(style({ panel: true, panelInsetMobile: '4px' })).toContain('@media (max-width:768px){.he-b-a{margin-inline:4px}}');
  });
  it('alignment and colour per tier; the eyebrow’s row and its rule', () => {
    expect(style({ typography: { body: { alignMobile: 'left', colorMobile: '#111' } } })).toMatch(/@media \(max-width:768px\)\{[^}]*text-align:left;color:#111/);
    const out = style({ typography: { eyebrow: { align: 'center', rule: false, alignMobile: 'left' } } });
    expect(out).toContain('.he-b-a .he-eyebrow{justify-content:center}');
    expect(out).toContain('.he-b-a .he-eyebrow__rule{display:none}');
    expect(out).toContain('.he-b-a .he-eyebrow{justify-content:flex-start}');
  });
  it('a centred button stack stays centred on phones', () => {
    expect(style({ buttonsMobile: 'fit' })).toContain('.he-b-a .he-btns.is-center{align-items:center}');
  });
});

describe('heading', () => {
  const heading = (extra: Record<string, unknown> = {}) => renderToStaticMarkup(<HeadingBlock {...blockSchemas.heading.parse({ title: 'A title', subtitle: 'Words', ...extra })} />);
  it('draws as before when unset', () => {
    expect(heading()).not.toContain('has-w');
    expect(heading()).not.toContain('is-m-');
  });
  it('carries the subtitle’s width and a phone alignment', () => {
    const html = heading({ align: 'center', alignMobile: 'left', subtitleWidth: '560px', subtitleWidthMobile: '320px' });
    expect(html).toContain('is-m-left');
    expect(html).toContain('--he-hd-sub-w:560px');
    expect(html).toContain('--he-hd-sub-w-m:320px');
  });
});

describe('card grid: pictures with text over them', () => {
  const grid = (extra: Record<string, unknown> = {}, card: Record<string, unknown> = {}) =>
    renderToStaticMarkup(<CardGridVariant {...blockSchemas.cardGrid.parse({ variant: 'overlay', cards: [{ title: 'One', imageUrl: '/media/a.png', ...card }, { title: 'Two', imageUrl: '/media/b.png' }, { title: 'Three', imageUrl: '/media/c.png' }], ...extra })} />);
  it('draws as before when unset', () => {
    const html = grid();
    for (const word of ['has-text-pad', 'has-row-tracks', 'has-own-h', 'he-ocard__points', 'is-at-m-']) expect(html).not.toContain(word);
  });
  it('sizes each card by its row’s written tracks, in turn', () => {
    const html = grid({ rowTracks: ['1fr', '668fr 508fr'], gap: '10px' });
    expect(html).toContain('has-row-tracks');
    expect(html).toContain('--he-rt-share:1.000000');
    expect(html).toContain('--he-rt-share:0.568027');
    expect(html).toContain('--he-rt-gap:10px');
  });
  it('carries a card’s own height, words’ width, phone picture and bullet lists', () => {
    const html = grid({ pointsColumns: 2 }, { height: '500px', heightMobile: '404px', textWidth: '300px', imageUrlMobile: '/media/m.png', imagePositionMobile: 'top left', points: ['First', 'Second'] });
    expect(html).toContain('--he-ocard-own-h:500px');
    expect(html).toContain('--he-ocard-tw:300px');
    expect(html).toContain('is-at-m-top-left');
    expect(html).toContain('he-ocard__points');
    expect(html).toContain('--he-ocard-pcols:2');
  });
  it('refuses tracks that are not fractions', () => {
    expect(blockSchemas.cardGrid.safeParse({ variant: 'overlay', cards: [], rowTracks: ['1fr;}'] }).success).toBe(false);
  });
});

describe('media band', () => {
  const band = (extra: Record<string, unknown> = {}) => renderToStaticMarkup(<MediaBand {...blockSchemas.mediaBand.parse({ imageUrl: '/media/a.png', title: 'A title', ...extra })} />);
  it('draws as before when unset', () => {
    const html = band();
    for (const word of ['has-title-indent', 'is-group-center', 'has-fade-m', 'is-bg-m-', 'is-title-flow-m']) expect(html).not.toContain(word);
  });
  it('carries the indent, the centred group, the phone place, anchor and fade', () => {
    const html = band({ titleIndent: '46px', textGroup: 'center', textEnd: '41px', positionMobile: 'top', imagePositionMobile: 'bottom', fadeMobile: { color: '#112233', height: '337px' } });
    expect(html).toContain('--he-band-indent:46px');
    expect(html).toContain('is-group-center');
    expect(html).toContain('is-m-top');
    expect(html).toContain('is-bg-m-bottom');
    expect(html).toContain('--he-band-fade-m:#112233');
  });
});

describe('team', () => {
  const members = Array.from({ length: 6 }, (_, i) => ({ name: `Name ${i}` }));
  const team = (extra: Record<string, unknown> = {}) => renderToStaticMarkup(<TeamBlock {...blockSchemas.team.parse({ variant: 'portrait', members, ...extra })} />);
  it('keeps one number for every screen until a phone number is set', () => {
    const html = team({ initial: 4 });
    expect(html).toContain('is-later');
    expect(html).not.toContain('has-tier-more');
  });
  it('hides each tier’s own later members', () => {
    const html = team({ initial: 4, initialMobile: 2 });
    expect(html).toContain('has-tier-more');
    expect(html).toContain('is-later-d');
    expect(html).toContain('is-later-m');
  });
  it('carries the portrait’s padding, photo and name colour', () => {
    const html = team({ cardPadding: '80px 10px 0', photoFit: 'cover', photoPosition: 'center top', members: [{ name: 'One', nameColor: '#123456' }] });
    expect(html).toContain('--he-team-pad:80px 10px 0');
    expect(html).toContain('is-photo-cover');
    expect(html).toContain('color:#123456');
  });
});

describe('post cards', () => {
  it('generates the pointer from a colour and a size, without an upload', () => {
    const out = arrowCursor('#ffffff', '#102030', 48);
    expect(out).toMatch(/^url\("data:image\/svg\+xml,[^"]+"\) 24 24,pointer$/);
    expect(decodeURIComponent(out)).toContain('fill="#ffffff"');
    expect(decodeURIComponent(out)).toContain('stroke="#102030"');
  });
  it('ignores a bad colour', () => {
    expect(decodeURIComponent(arrowCursor('red;}', 'x'))).toContain('fill="#ffffff"');
  });
  it('honours allLink in every layout', () => {
    const source = readFileSync(join(__dirname, '../src/components/blocks/dynamic.tsx'), 'utf8');
    expect(source.match(/<AllWriting/g)).toHaveLength(source.match(/p\.allLink !== false && <AllWriting/g)!.length);
  });
  it('takes the extras in the block and the blog alike', () => {
    expect(blockSchemas.postList.safeParse({ card: { arrow: 'pointer', arrowSize: 48, titleType: { size: '26px' }, heightMobile: '487px' } }).success).toBe(true);
    expect(blogSchema.safeParse({ card: { arrow: 'pointer' } }).success).toBe(true);
    expect(blockSchemas.postList.safeParse({ card: { arrowColor: 'red;}' } }).success).toBe(false);
  });
});

describe('type styles', () => {
  it('writes only what is set, and drops what fails', () => {
    expect(typeRule('.x', undefined)).toEqual([]);
    expect(typeRule('.x', { size: '12px', sizeMobile: '10px' })).toEqual(['.x{font-size:12px}', '@media (max-width:768px){.x{font-size:10px}}']);
    expect(typeVars('p', { size: '12px', color: 'red;}' } as never)).toEqual({ '--he-p-size': '12px' });
  });
});

describe('blog details', () => {
  const blog = (look: Record<string, unknown>) => blogCss(blogSchema.parse({ look }));
  it('writes nothing while unset', () => {
    expect(blogCss(undefined)).toBe('');
    expect(blog({ archive: {}, post: {} })).toBe('');
  });
  it('dresses the category bar and its chips', () => {
    const out = blog({ archive: { barBackground: '#eeeeee', barBackgroundMobile: 'transparent', chipFill: 'rgba(255,255,255,0.6)', chipActiveFill: '#112233', chipRadius: '0 16px 0 16px' } });
    expect(out).toContain('.he-arch-bar{background-color:#eeeeee}');
    expect(out).toContain('@media (max-width:768px){.he-arch-bar{background-color:transparent}}');
    expect(out).toContain('.he-arch-bar .he-chip[aria-current]{background-color:#112233}');
  });
  it('lays out the cover-aside post', () => {
    const out = blog({ post: { asideColumns: '1fr 1fr', asideGap: '40px', asideTintStops: 'rgba(0,0,0,0.2) 25%, #000 92%', asidePanel: '#eeeeee', headingGap: '8px' } });
    expect(out).toContain('grid-template-columns:minmax(0,1fr) minmax(0,1fr)');
    expect(out).toContain('linear-gradient(to bottom,rgba(0,0,0,0.2) 25%, #000 92%)');
    expect(out).toContain('.he-post-aside-sec{background-color:#eeeeee;border-width:0}');
  });
  it('refuses stops that could break out', () => {
    expect(blogSchema.safeParse({ look: { post: { asideTintStops: 'red;}body{' } } }).success).toBe(false);
  });
});

describe('careers details', () => {
  it('writes nothing while unset, and keeps the outline button', () => {
    expect(careersCss({})).toBe('');
    expect(resolveCareersLook(undefined).buttonLook).toBe('outline');
    expect(resolveCareersLook(undefined).page).toBe('standard');
  });
  it('dresses the listing, the cards and the advert', () => {
    const out = careersCss(
      careersLookSchema.parse({
        sectionBackground: '#eeeeee',
        cardShadow: '18px 17px 54px rgba(0,0,0,0.1)',
        cardMinHeightMobile: '227px',
        excerptLines: 2,
        advertColumns: '744fr 572fr',
        sticky: true,
        panelRadius: '0 60px 0 60px',
        applyPaddingMobile: '40px',
        coverPosition: '72% 50%',
      }),
    );
    expect(out).toContain('.he-jobs-sec{background-color:#eeeeee;border-width:0}');
    expect(out).toContain('box-shadow:18px 17px 54px rgba(0,0,0,0.1)');
    expect(out).toContain('.he-jobc__excerpt{-webkit-line-clamp:2;line-clamp:2}');
    expect(out).toContain('grid-template-columns:minmax(0,744fr) minmax(0,572fr)');
    expect(out).toContain('position:sticky');
    expect(out).toContain('.he-job-aside__cover .he-fill{object-position:72% 50%}');
  });
  it('refuses a value that could break out of the style element', () => {
    for (const bad of [{ cardShadow: 'x;}' }, { advertColumns: '1fr;}' }, { coverPosition: '1%;}' }, { panelRadius: '0;}' }]) expect(careersLookSchema.safeParse(bad).success).toBe(false);
  });
  it('has the eyebrow’s word in Site translations', () => {
    expect(MESSAGES).toHaveProperty(['careers.hiring']);
    const page = readFileSync(join(__dirname, '../src/app/(site)/[locale]/careers/[slug]/page.tsx'), 'utf8');
    expect(page).toContain("t('careers.hiring')");
  });
});

describe('cookie notice', () => {
  it('stays as it was until set', () => {
    const notice = cookieNoticeSchema.parse({});
    for (const key of ['corners', 'left', 'centerMobile', 'buttonRadius', 'noWrapMobile']) expect(notice).not.toHaveProperty(key);
  });
  it('takes px boxes only', () => {
    expect(COOKIE_BOX.test('0 40px 0 40px')).toBe(true);
    expect(cookieNoticeSchema.safeParse({ corners: '1px;}' }).success).toBe(false);
  });
});

describe('footer, menu and languages', () => {
  const chrome = (value: unknown) => chromeCss(chromeSchema.parse(value));
  it('writes nothing while unset', () => {
    expect(chrome({})).toBe('');
    expect(chrome({ footer: {}, mobileMenu: {}, languages: {} })).toBe('');
  });
  it('dresses the sign-up, the icons, the menu’s links and languages', () => {
    const out = chrome({
      footer: { newsletterLook: 'split', newsletterGap: '8px', newsletterSendRadius: '0 16px 0 16px', socialColor: '#112233' },
      mobileMenu: { itemColor: '#222222', noCurrentMark: true, barColor: '#eeeeee' },
      languages: { menuSize: '20px' },
    });
    expect(out).toContain('.he-ftr .he-ftr__nl.is-split .he-ftr__nlrow{gap:8px}');
    expect(out).toContain('.he-ftr .he-ftr__social a{color:#112233}');
    expect(out).toContain('.he-menu .he-menu__row[aria-current]');
    expect(out).toContain('font-size:20px');
  });
});

describe('languages with longer words', () => {
  const theme = (value: unknown) => themeToCss(themeSchema.parse(value));
  it('writes nothing while unset', () => expect(theme({})).toBe(''));
  it('scales a language’s headings, on phones too', () => {
    const out = theme({ localeTypography: { xy: { headingScale: 0.9, headingScaleMobile: 0.7, hyphens: true } } });
    expect(out).toContain(':root:lang(xy) :is(h1,h2,h3,h4,h5,h6){zoom:0.9}');
    expect(out).toContain('@media (max-width:768px){:root:lang(xy) :is(h1,h2,h3,h4,h5,h6){zoom:0.7}}');
    expect(out).toContain('hyphens:auto');
  });
  it('frosts the fields', () => {
    const out = theme({ fields: { blur: 8, shadow: '0 4px 20px rgba(0,0,0,0.1)' } });
    expect(out).toContain('backdrop-filter:blur(8px)');
    expect(out).toContain('box-shadow:0 4px 20px rgba(0,0,0,0.1)');
  });
});

describe('gallery: a height of its own', () => {
  const images = [{ url: '/media/a.png' }];
  it('keeps the shape while unset', () => {
    expect(blockSchemas.gallery.parse({ images })).not.toHaveProperty('height');
    expect(css('library-showcase.css')).toContain('.he-gal.is-grid.is-portrait .he-gal__media { aspect-ratio: 3 / 4; }');
  });
  it('replaces the shape, per tier, in a rule written after it', () => {
    expect(blockSchemas.gallery.safeParse({ images, height: '487px', heightMobile: '500px' }).success).toBe(true);
    expect(css('library-details.css')).toContain('.he-gal.is-grid.has-h .he-gal__media { height: var(--he-gal-h); aspect-ratio: auto; }');
    expect(css('library-details.css')).toContain('.he-gal.is-grid.has-h-m .he-gal__media { height: var(--he-gal-h-m); aspect-ratio: auto; }');
  });
  it('refuses a value that could break out of a style attribute', () => {
    expect(blockSchemas.gallery.safeParse({ images, height: '487px;}' }).success).toBe(false);
  });
});

describe('the stylesheet', () => {
  it('is keyed to what only an option writes, apart from the long-word fix', () => {
    const sheet = css('library-details.css');
    expect(sheet).toContain('@layer he-details');
    expect(sheet).toContain('overflow-wrap: break-word');
  });
  it('is imported', () => expect(css('globals.css')).toContain("@import './library-details.css';"));
});
