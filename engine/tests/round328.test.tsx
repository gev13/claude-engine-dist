import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { Footer } from '@/components/site/Footer';
import { blockSchemas } from '@/lib/blocks';
import { blockStyleSchema } from '@/lib/blockStyle';
import { blockStyleToCss } from '@/lib/blockStyle-css';
import { blogSchema, resolveBlog } from '@/lib/blog';
import { blogCss } from '@/lib/blogCss';
import { chromeSchema, resolveChrome } from '@/lib/chrome';
import { chromeCss } from '@/lib/chromeCss';
import { splitAtBlocks } from '@/lib/inlineBlocks';
import { projectLookCss, projectTemplateSchema } from '@/lib/projects';
import { projectCardLook } from '@/lib/projectCard';
import { cookieNoticeSchema } from '@/lib/cookies';
import { themeSchema } from '@/lib/theme';
import { entranceCss, linkHoverCss, themeToCss } from '@/lib/theme-css';
import { isPortableSettingKey } from '@/server/engine/transfer';

/* 3.28 — the final round: the header's dropdowns and details, the menus,
   the footer, motion, buttons, sliders and grids, the blog, projects, the
   form card and the cookie notice. Every option is off, or as before, until
   chosen — the first test of each part says so. */

vi.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => ({ push() {} }) }));

const theme = (value: unknown) => themeToCss(themeSchema.parse(value));
const css = (file: string) => readFileSync(join(__dirname, '../src/styles', file), 'utf8');

describe('an untouched site', () => {
  it('writes no theme CSS at all', () => {
    expect(theme({})).toBe('');
    expect(chromeCss(undefined)).toBe('');
    expect(chromeCss({})).toBe('');
    expect(blogCss(undefined)).toBe('');
    expect(blogCss({})).toBe('');
    expect(entranceCss(undefined)).toBe('');
    expect(projectLookCss(undefined)).toBe('');
  });

  it('resolves the chrome as it was', () => {
    const c = resolveChrome(undefined);
    expect(c.header.dropdown).toBeUndefined();
    expect(c.header.menuIcon).toBe('lines');
    expect(c.mobileMenu.submenuLayout).toBe('inline');
    expect(c.mobileMenu.itemHover).toBe('colour');
    expect(c.mobileMenu.duration).toBeUndefined();
    expect(c.footer.iconSet).toBe('line');
    expect(c.footer.activeLink).toBe(false);
    expect(c.transition).toMatchObject({ preloaderEvery: false, headerFade: false });
    expect(c.cursor).toMatchObject({ arrowStyle: 'stroke', discBlur: true, lightbox: false });
  });

  it('resolves the blog as it was', () => {
    expect(resolveBlog(undefined).look).toEqual({ card: {}, archive: {}, post: {} });
  });
});

describe('§2 — header and menus', () => {
  it('styles the dropdown, and keeps it in the page only when it fades out', () => {
    const out = chromeCss({ header: { dropdown: { align: 'start', background: 'rgba(30,30,34,0.7)', blur: 10, radius: '8px', padding: '4px', itemHeight: '38px', itemHoverColor: '#e5484d', duration: 350 } } });
    expect(out).toContain('.he-hdr .he-mega--compact{left:0;transform:none}');
    expect(out).toContain('backdrop-filter:blur(10px)');
    expect(out).toContain('.he-mega--compact.is-shown');
    expect(out).toContain('min-height:38px');
    expect(chromeSchema.safeParse({ header: { dropdown: { background: 'red;x' } } }).success).toBe(false);
  });

  it('dims the other top links, draws two bars, pads per tier', () => {
    const out = chromeCss({ header: { dimSiblings: true, menuIcon: 'bars', menuIconWidth: '22px', padding: { base: { left: '27px', right: '43px' }, mobile: { left: '16px' } } } });
    expect(out).toContain('opacity:0.5');
    expect(out).toContain('--he-mi-w:22px');
    expect(out).toContain('.he-hdr .he-hdr__inner{padding-left:27px;padding-right:43px}');
    expect(out).toContain('@media (max-width:768px){.he-hdr .he-hdr__inner{padding-left:16px}}');
  });

  it('opens sub-items beside the list and styles the drawer', () => {
    const out = chromeCss({ mobileMenu: { submenuLayout: 'beside', itemHover: 'shift', duration: 500, drawer: { activeColor: '#e5484d', backdrop: '#111111', backdropOpacity: 90, backdropBlur: 0 } } });
    expect(out).toContain('.is-sub-beside');
    expect(out).toContain('translate:16px 0');
    expect(out).toContain('he-menu-out');
    expect(out).toContain('[aria-current=page]{color:#e5484d}');
    expect(out).toContain('.he-menu-backdrop.is-drawer{background:color-mix(in srgb, #111111 90%, transparent);backdrop-filter:none}');
  });

  it('keeps the link hover byte for byte, and lets each area choose its own', () => {
    const all = linkHoverCss({ hover: 'underline' });
    expect(all).not.toContain('he-ftr__contacts');
    expect(linkHoverCss({ hover: 'sweep', areas: { header: 'none' } })).not.toContain('.he-hdr__link:hover');
    expect(linkHoverCss({ areas: { contacts: 'sweep' } })).toContain('.he-ftr__contacts a:hover>span');
  });
});

describe('§3 — the footer', () => {
  it('draws filled icons only when asked', () => {
    const base = { siteName: 'Northwind', columns: [], social: [{ network: 'linkedin' as const, href: 'https://example.com/in' }] };
    expect(renderToStaticMarkup(<Footer {...base} />)).toContain('fill="none"');
    expect(renderToStaticMarkup(<Footer {...base} filledIcons />)).toContain('fill-rule="evenodd"');
  });
  it('writes equal columns, the link rhythm and the current link', () => {
    const out = chromeCss({ footer: { columns: 'equal', linkGap: '13px', activeWeight: '600', dividerColor: '#ffffff' } });
    expect(out).toContain('repeat(calc(var(--he-footer-cols) + 1),minmax(0,1fr))');
    expect(out).toContain('.he-ftr a[aria-current=page]{font-weight:600}');
    expect(resolveChrome({ footer: { activeColor: '#fff' } }).footer.activeLink).toBe(true);
  });
});

describe('§4 — motion', () => {
  it('moves the entrances as set, and has a slow fade', () => {
    const out = entranceCss({ distance: '32px', duration: 400, easing: 'ease' });
    expect(out).toContain('translateY(32px)');
    expect(out).toContain('calc(400ms * var(--he-motion,1)) ease');
    expect(themeSchema.safeParse({ reveal: 'fadeSlow' }).success).toBe(true);
    expect(blockStyleSchema.safeParse({ reveal: 'rise', revealItems: true }).success).toBe(true);
    expect(css('library-effects.css')).toContain('.he-reveal--fadeSlow');
  });
  it('checks the rails, the cursor and the loading screen', () => {
    expect(chromeSchema.safeParse({ rails: { barTrack: 'transparent', barFill: 'rgba(255,255,255,0.75)', barPlace: 'below', inset: '48px' } }).success).toBe(true);
    expect(chromeSchema.safeParse({ cursor: { follow: 120, arrowStyle: 'filled', arrowSize: 20, discBlur: false } }).success).toBe(true);
    expect(chromeSchema.safeParse({ transition: { preloaderImage: 'javascript:alert(1)' } }).success).toBe(false);
    expect(resolveChrome({ transition: { preloader: true, preloaderEvery: true } }).transition.preloaderEvery).toBe(false);
    expect(resolveChrome({ transition: { style: 'fade', preloader: true, preloaderEvery: true } }).transition.preloaderEvery).toBe(true);
  });
});

describe('§5 — buttons', () => {
  it('draws the arrow, the text button and the large size as set', () => {
    const out = theme({ buttons: { arrowStyle: 'filled', arrowSize: '24px', arrowGap: '4px', arrowHover: 'slide', textUnderline: false, large: { height: '52px' } } });
    expect(out).toContain('fill:currentColor');
    expect(out).toContain('he-arrow-slide');
    expect(out).toContain('.he-cbtn.is-text:hover{border-color:transparent}');
    expect(out).toContain('height:52px;padding-block:0');
  });
  it('gives a section its own button colours', () => {
    const out = blockStyleToCss('b1', blockStyleSchema.parse({ buttonColors: { outline: { border: '#e5484d', text: '#e5484d' } } }));
    expect(out).toContain('--he-btn-outline-text:#e5484d');
    expect(blockStyleSchema.safeParse({ buttonColors: { primary: { background: 'red;x' } } }).success).toBe(false);
  });
});

describe('§6 — sliders, cards and grids', () => {
  const slides = [{ title: 'One' }, { title: 'Two' }];
  it('takes the carousel’s new options, each optional', () => {
    const parsed = blockSchemas.carousel.parse({ slides });
    expect(parsed.arrowBox).toBeUndefined();
    expect(parsed.slideHover).toBeUndefined();
    expect(blockSchemas.carousel.safeParse({ slides, arrowBox: 36, arrowFill: 'rgb(20,20,20)', arrowGap: '10px', arrowDisabled: 50, arrowHover: 'none', slideHover: 'none', desktopAt1024: true, counter: { roll: true } }).success).toBe(true);
  });
  it('swipes at a share per tier, from 20%', () => {
    const out = blockStyleToCss('b1', blockStyleSchema.parse({ swipeOn: 'tablet', swipeWidth: 29, swipeWidthMobile: 84 }));
    expect(out).toContain('flex:0 0 29%');
    expect(out).toContain('@media (max-width:768px)');
  });
  it('reaches into the gutter only from tablets up', () => {
    expect(blockStyleToCss('b1', blockStyleSchema.parse({ bleed: '15px' }))).toContain('@media (min-width:769px){.he-b-b1{margin-inline:calc(0px - 15px)}}');
  });
  it('takes the other grids’ and blocks’ details', () => {
    expect(blockSchemas.cardGrid.safeParse({ cards: [], columnsTablet: 4 }).success).toBe(true);
    expect(blockSchemas.projects.safeParse({ pagination: 'infinite', card: { titleGap: '0', revealSize: '15px', bodyBackground: 'rgba(255,255,255,0.06)', bodyPadding: '20px 24px' } }).success).toBe(true);
    expect(projectCardLook({ titleGap: '0' }).className).toContain('has-title-gap');
    expect(blockSchemas.image.safeParse({ url: '/media/a.png', size: 'natural', align: 'right', maxWidth: '250px' }).success).toBe(true);
    expect(blockSchemas.prose.safeParse({ paragraphGap: '0' }).success).toBe(true);
    expect(blockSchemas.gallery.safeParse({ images: [{ url: '/media/a.png' }], masonryOrder: 'turn', gapLength: '30px', batchOnce: true, viewer: { backdrop: '#111111', peek: true, closeSide: 'left', arrows: 'bottomRight', counter: false } }).success).toBe(true);
  });
});

describe('§7 — the blog', () => {
  it('draws the contained card from its own panel and padding', () => {
    const out = blogCss(blogSchema.parse({ look: { card: { style: 'contained', panel: 'rgba(255,255,255,0.06)', padding: '18px 30px', radius: '8px', titleSize: '20px', chipStyle: 'filled' } } }));
    expect(out).toContain('.he-pcards .he-ucard{padding:18px 30px;background-color:rgba(255,255,255,0.06);border-radius:8px;overflow:hidden}');
    expect(out).toContain('--he-pc-px:30px');
    expect(out).toContain('font-size:20px');
  });
  it('styles an archive and a post', () => {
    const out = blogCss(blogSchema.parse({ look: { archive: { pagerAlign: 'left', pagerHideDisabled: true, gridTop: '40px' }, post: { width: '1120px', linkUnderline: false, tableLines: 'rows', sidebarTablet: true } } }));
    expect(out).toContain('.he-pager{justify-content:flex-start}');
    expect(out).toContain('[data-disabled]{display:none}');
    expect(out).toContain('.he-post{--container-shell:1120px}');
    expect(out).toContain('.he-post .prose-edge a{text-decoration:none}');
    expect(blogSchema.safeParse({ look: { card: { panel: 'red;x' } } }).success).toBe(false);
  });
  it('places a post’s blocks inside its article', () => {
    const html = '<p>One</p><p>[[block:2]]</p><p>Two</p><p>[[block:9]]</p>';
    const { parts, placed } = splitAtBlocks(html, 3);
    expect(parts).toEqual(['<p>One</p>', 1, '<p>Two</p><p>[[block:9]]</p>']);
    expect([...placed]).toEqual([1]);
    expect(splitAtBlocks('<p>x</p>', 0).parts).toEqual(['<p>x</p>']);
  });
});

describe('§8 — projects', () => {
  it('writes the template’s details only when set', () => {
    expect(projectLookCss({})).toBe('');
    const out = projectLookCss(projectTemplateSchema.parse({ look: { titleSize: '82px', titleSizeTablet: '56px', archiveGap: '120px' } }).look);
    expect(out).toContain('.he-prj-head h1{font-size:82px;max-width:none}');
    expect(out).toContain('.he-prja-head+.he-proj-sec{padding-top:120px}');
  });
});

describe('§9 / §10 — the form card and the cookie notice', () => {
  it('takes the form’s and the notice’s details', () => {
    const fields = [{ id: 'name', type: 'text', label: 'Name' }];
    expect(blockSchemas.form.safeParse({ formName: 'Contact', fields, cardBleed: '20px', fieldInset: '20px', bleedMobile: true, submitBorder: '#e5484d', submitBorderWidth: 1 }).success).toBe(true);
    expect(cookieNoticeSchema.safeParse({ textSize: 15, textWeight: '400', bottom: 24, insetMobile: 16, padding: '16px 20px' }).success).toBe(true);
    expect(cookieNoticeSchema.safeParse({ padding: '16px;x' }).success).toBe(false);
  });
});

describe('§1 — the main language’s words travel', () => {
  it('lets `messages` and its translations through the transfer', () => {
    expect(isPortableSettingKey('messages')).toBe(true);
    expect(isPortableSettingKey('messages:hy')).toBe(true);
    expect(isPortableSettingKey('messages;drop')).toBe(false);
  });
});

describe('3.28.1 — the follow-up', () => {
  it('makes each spacing the whole space, on the section’s inner column', () => {
    const out = blogCss(blogSchema.parse({ look: { archive: { gridTop: '40px', barPadding: '16px', top: '120px' }, post: { coverGap: '27px' } } }));
    expect(out).toContain('.he-arch-list>.shell{padding-top:40px}');
    expect(out).toContain('.he-arch-bar>.shell{padding-block:16px}');
    expect(out).toContain('.he-arch-head>.shell{padding-top:120px}');
    expect(out).toContain('.he-post-ctt+section>.shell{padding-top:0}');
    expect(projectLookCss(projectTemplateSchema.parse({ look: { heroGap: '43px' } }).look)).toContain('.he-prj-head>.shell{padding-top:43px}');
  });
  it('takes the older post, a negative tracking, the inline link and the tags’ start', () => {
    expect(blogSchema.safeParse({ upNext: { pick: 'older' } }).success).toBe(true);
    expect(blogSchema.safeParse({ look: { card: { titleTracking: '-0.6px' } } }).success).toBe(true);
    expect(blogSchema.safeParse({ look: { archive: { barPadding: '16px 24px 8px' } } }).success).toBe(false);
    expect(cookieNoticeSchema.safeParse({ linkPlace: 'inline' }).success).toBe(true);
    expect(projectTemplateSchema.safeParse({ look: { tagsStart: 7 } }).success).toBe(true);
    expect(projectTemplateSchema.safeParse({ look: { tagsStart: 12 } }).success).toBe(false);
  });
  it('keeps a column menu’s list as it is when the sub-items open beside it', () => {
    const out = chromeCss({ mobileMenu: { submenuLayout: 'beside' } });
    expect(out).toContain('.is-sub-beside:not(.has-column) .he-menu__body{display:grid');
    expect(out).toContain('.is-sub-beside.has-column .he-menu__beside{position:absolute');
  });
});

