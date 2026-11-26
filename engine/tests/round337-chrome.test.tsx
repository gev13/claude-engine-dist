import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { chromeSchema, resolveChrome, type Chrome } from '@/lib/chrome';
import { chromeCss } from '@/lib/chromeCss';
import { navigationSchema } from '@/lib/navigation';
import { themeSchema } from '@/lib/theme';
import { themeToCss } from '@/lib/theme-css';

/* 3.37 — the header's gap after its links and its exact edges, the phone
   menu's close X and language row, the language codes' colour and faces, the
   footer's thirds, wordmark and sign-up details, a footer link's colour and
   phone place, a social link's own mark. Every one is off, and drawn as
   before, until set; the four fixes are pinned at the end. */

vi.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => ({ push() {} }) }));
const { Header } = await import('@/components/site/Header');
const { Footer } = await import('@/components/site/Footer');
const { FooterColumn } = await import('@/components/site/SiteExtras');

const css = (chrome: unknown) => chromeCss(chromeSchema.parse(chrome));
const styles = (file: string) => readFileSync(join(process.cwd(), 'src/styles', file), 'utf8');
const header = (chrome: Chrome, more: Record<string, unknown> = {}) =>
  renderToStaticMarkup(
    <Header
      siteName="Site"
      chrome={resolveChrome(chrome)}
      nav={[{ id: 'a', label: 'About', href: '/about' }]}
      cta={null}
      secondaryCta={null}
      primaryServices={[]}
      secondaryServices={[]}
      contact={{ social: [] }}
      {...more}
    />,
  );
const footer = (more: Record<string, unknown> = {}) => renderToStaticMarkup(<Footer siteName="Site" columns={[]} social={[]} {...more} />);
const HOSTILE = '12px;}body{color:red';

describe('nothing changes while nothing is set', () => {
  it('writes no rule for an empty chrome or empty new groups', () => {
    expect(css({})).toBe('');
    expect(css({ header: { padding: { base: {} } }, mobileMenu: { closeIcon: {} }, languages: { faces: {} }, footer: {} })).toBe('');
    expect(themeToCss(themeSchema.parse({ chrome: {} }))).toBe('');
  });
  it('draws the header, the menu and the footer with none of the new classes or properties', () => {
    const html = header({}, { locales: ['en', 'ru'], locale: 'en', defaultLocale: 'en', brand: { logoType: 'image', logoUrl: '/media/logo.png' } });
    for (const mark of ['he-menu__x', 'is-langs-after', 'he-soc-own', '<picture', 'he-pic']) expect(html).not.toContain(mark);
    const foot = footer({ columns: [{ id: 'c', title: 'Studio', items: [{ id: 'i', label: 'Work', href: '/work' }] }], social: [{ network: 'x', href: 'https://x.com/a' }] });
    for (const mark of ['--he-ftr-link-c', '--he-ftr-order-m', 'he-soc-own', '<li style', '<a style']) expect(foot).not.toContain(mark);
    expect(foot).toContain('<h2 class="he-ftr__coltitle">');
  });
  it('resolves to the old behaviour', () => {
    const c = resolveChrome(undefined);
    expect(c.mobileMenu.closeIcon).toBe(false);
    expect(c.languages.menuPlace).toBe('foot');
  });
});

describe('the header: the space after the links, top and bottom padding, exact edges', () => {
  it('turns the space after the links into a margin on what follows them, where the links show', () => {
    expect(css({ header: { actionsGap: '60px' } })).toBe('@media (min-width:1025px){.he-hdr--classic .he-hdr__actions{margin-inline-start:calc(60px - var(--he-gap,24px) - 12px)}}');
    const both = css({ header: { collapseAt: 'mobile', actionsGap: '60px', actionsGapLaptop: '40px' } });
    expect(both).toContain('@media (min-width:769px){');
    expect(both).toContain('@media (min-width:769px) and (max-width:1440px){.he-hdr--classic .he-hdr__actions{margin-inline-start:calc(40px - var(--he-gap,24px) - 12px)}}');
  });
  it('has no desktop-only value where the links fold at 1440px, and nothing for another header', () => {
    expect(css({ header: { collapseAt: 'laptop', actionsGapLaptop: '40px' } })).toBe('');
    expect(css({ header: { variant: 'pill', actionsGap: '60px' } })).toBe('');
  });
  it('writes top and bottom padding per tier beside the sides', () => {
    expect(css({ header: { padding: { base: { top: '12px', bottom: '0' }, mobile: { left: '12px' } } } })).toBe(
      '.he-hdr .he-hdr__inner{padding-top:12px;padding-bottom:0}@media (max-width:768px){.he-hdr .he-hdr__inner{padding-left:12px}}',
    );
  });
  it('gives each shown part a column of its own, and drops the edge only with no line', () => {
    const on = css({ header: { exactEdges: true } });
    expect(on).toBe('.he-hdr--classic:not(.is-logo-center) .he-hdr__inner{grid-template-columns:auto minmax(0,1fr);grid-auto-flow:column;grid-auto-columns:auto}');
    expect(css({ header: { exactEdges: true, border: false } })).toContain('.he-hdr--classic .he-hdr__bar{border-bottom-width:0}');
    expect(css({ header: { exactEdges: true, variant: 'centered' } })).toBe('');
  });
  it('refuses values that would leave the rule', () => {
    expect(chromeSchema.safeParse({ header: { actionsGap: HOSTILE } }).success).toBe(false);
    expect(chromeSchema.safeParse({ header: { padding: { base: { top: HOSTILE } } } }).success).toBe(false);
    expect(chromeSchema.safeParse({ header: { exactEdges: 'yes' } }).success).toBe(false);
    expect(chromeCss({ header: { actionsGap: HOSTILE, padding: { base: { bottom: HOSTILE } } } } as Chrome)).toBe('');
  });
});

describe('the phone logo', () => {
  const brand = { logoType: 'image' as const, logoUrl: '/media/logo.png' };
  it('is drawn up to 768px once there is one', () => {
    const html = header({}, { brand: { ...brand, logoMobileUrl: '/media/logo-phone.png' } });
    expect(html).toContain('<picture class="he-pic"><source media="(max-width: 768px)" srcSet="/media/logo-phone.png"/><img src="/media/logo.png" alt="" class="he-hdr__img"/></picture>');
  });
  it('is left out when it is not a safe address, or the logo is the mark', () => {
    expect(header({}, { brand: { ...brand, logoMobileUrl: '/media/a.png 2x, /media/b.png' } })).not.toContain('<picture');
    expect(header({}, { brand: { logoType: 'mark', logoMobileUrl: '/media/logo-phone.png' } })).not.toContain('<picture');
  });
});

describe('the phone menu: the close X and the language row', () => {
  it('draws the X in two lines once one of its sizes is set', () => {
    const chrome = { mobileMenu: { closeIcon: { size: '20px', thickness: '2px', color: 'rgba(0,0,0,.5)' } } };
    expect(resolveChrome(chromeSchema.parse(chrome)).mobileMenu.closeIcon).toBe(true);
    expect(header(chromeSchema.parse(chrome))).toContain('<span class="he-menu__x" aria-hidden="true"><i></i><i></i></span>');
    expect(css(chrome)).toBe('.he-menu .he-menu__x{--he-x-s:20px;--he-x-t:2px;--he-x-c:rgba(0,0,0,.5)}');
    expect(chromeSchema.safeParse({ mobileMenu: { closeIcon: { color: 'red;}' } } }).success).toBe(false);
  });
  it('puts the language row straight after the links, and marks the menu', () => {
    const langs = { locales: ['en', 'ru'], locale: 'en', defaultLocale: 'en' };
    const foot = header(chromeSchema.parse({ languages: { look: 'inline', inMenu: true } }), langs);
    const after = header(chromeSchema.parse({ languages: { look: 'inline', inMenu: true, menuPlace: 'afterLinks' } }), langs);
    expect(foot).not.toContain('is-langs-after');
    expect(after).toContain('is-langs-after');
    const menu = after.slice(after.indexOf('id="he-menu"'));
    expect(menu.indexOf('he-menu__langs')).toBeGreaterThan(menu.indexOf('he-menu__body'));
    expect(styles('library-chrome.css')).toContain('.he-menu.is-langs-after .he-menu__body { flex: 0 0 auto; }');
    // Without the row in the menu, the class means nothing and is not written.
    expect(header(chromeSchema.parse({ languages: { menuPlace: 'afterLinks' } }), langs)).not.toContain('is-langs-after');
  });
});

describe('the language codes: colour and faces', () => {
  it('colours the codes that are not the current one, and leaves pointing at them alone', () => {
    expect(css({ languages: { color: 'rgba(0,0,0,.5)' } })).toBe(".he-langs .he-langs__item:not([aria-current='true'],:hover){color:rgba(0,0,0,.5)}");
  });
  it('sets a face for a language from the font list, by the lang the codes already carry', () => {
    const out = css({ languages: { faces: { el: 'notoSerif' } } });
    expect(out).toMatch(/^:is\(\.he-langs__item,\.he-lang__item\):lang\(el\)\{font-family:'Noto Serif', /);
    expect(css({ languages: { faces: { el: 'noSuchFace' } } })).toBe('');
    expect(chromeCss({ languages: { faces: { el: 'constructor' } } } as Chrome)).toBe('');
    expect(chromeSchema.safeParse({ languages: { faces: { el: "x;}body{" } } }).success).toBe(false);
    expect(chromeSchema.safeParse({ languages: { faces: { 'e)l': 'notoSerif' } } }).success).toBe(false);
  });
});

describe('the footer: thirds, gaps, the wordmark and the sign-up', () => {
  it('lays out three equal parts with the menus at the end of the last', () => {
    const out = css({ footer: { layoutDesktop: 'thirds', columnGap: '20px', menusGap: '40px' } });
    expect(out).toContain('@media (width>=64rem){.he-ftr .he-ftr__grid{column-gap:20px}}');
    expect(out).toContain('grid-template-columns:minmax(0,calc((100% - 2 * 20px) / 3 + 20px - 40px)) minmax(0,calc((100% - 2 * 20px) / 3 + 20px - 40px)) minmax(0,1fr) repeat(var(--he-footer-cols),max-content)');
    expect(out).toContain('column-gap:40px;');
    expect(out).toContain('>.he-ftr__middle{grid-column:2;margin-inline-end:calc(20px - 40px);justify-items:center}');
    expect(out).toContain('>.he-ftr__middle+:not(.he-ftr__langrow){grid-column:4}');
  });
  it('falls back to the drawn gap for the parts and to that for the menus', () => {
    expect(css({ footer: { layoutDesktop: 'thirds' } })).toContain('column-gap:var(--he-gap,44px);');
    expect(css({ footer: { layoutDesktop: 'auto' } })).toBe('');
  });
  it('writes the phones’ space between menus side by side', () => {
    expect(css({ footer: { menusGapMobile: '20px' } })).toBe('@media (max-width:768px){.he-ftr.is-links-row .he-ftr__grid{column-gap:20px}}');
  });
  it('crops and moves the wordmark on phones on its own', () => {
    expect(css({ footer: { wordmarkCropMobile: 40 } })).toBe('@media (max-width:768px){.he-ftr .he-ftr__wm.is-image .he-ftr__wmbox{aspect-ratio:calc(var(--he-wm-ratio) / 0.6)}.he-ftr .he-ftr__wmname{height:calc(1em * 0.6)}}');
    expect(css({ footer: { wordmarkOffset: '12px', wordmarkOffsetMobile: '-8px' } })).toBe('.he-ftr .he-ftr__wmbox{translate:12px 0}@media (max-width:768px){.he-ftr .he-ftr__wmbox{translate:-8px 0}}');
    expect(chromeSchema.safeParse({ footer: { wordmarkCropMobile: 91 } }).success).toBe(false);
  });
  it('sets the space under the sign-up’s heading and its field’s shadow', () => {
    expect(css({ footer: { newsletterTitleGap: '10px' } })).toBe('.he-ftr .he-ftr__nl .he-ftr__nltitle{margin-bottom:calc(10px - 6px)}');
    expect(css({ footer: { newsletterFieldShadow: 'none' } })).toBe('.he-ftr .he-ftr__nl .he-ftr__nlinput.he-nl__input{box-shadow:none}');
    expect(css({ footer: { newsletterFieldShadow: '0 4px 20px rgba(0,0,0,.5)' } })).toContain('box-shadow:0 4px 20px rgba(0,0,0,.5)}');
    expect(chromeSchema.safeParse({ footer: { newsletterFieldShadow: '0 0 0 red;}' } }).success).toBe(false);
    expect(chromeCss({ footer: { newsletterFieldShadow: 'inset 0 0 0 #123456;}x{', newsletterTitleGap: HOSTILE, menusGap: HOSTILE } } as Chrome)).toBe('');
  });
});

describe('footer links: a colour and a place of their own', () => {
  const items = [
    { id: 'a', label: 'Alpha', href: '/a' },
    { id: 'b', label: 'Beta', href: '/b', color: 'rgba(0,0,0,.5)', orderMobile: 1 },
    { id: 'c', label: 'Gamma', href: '/c' },
  ];
  it('writes a colour as a property its rule reads, and every link’s place once one has one', () => {
    const html = renderToStaticMarkup(<FooterColumn title="Studio" items={items} />);
    expect(html).toContain('<li style="--he-ftr-order-m:1"><a href="/a">Alpha</a></li>');
    expect(html).toContain('<li style="--he-ftr-order-m:1"><a style="--he-ftr-link-c:rgba(0,0,0,.5)" href="/b">Beta</a></li>');
    expect(html).toContain('<li style="--he-ftr-order-m:3"><a href="/c">Gamma</a></li>');
    expect(styles('library-chrome.css')).toContain(".he-ftr a[style*='--he-ftr-link-c']:not(:hover) { color: var(--he-ftr-link-c); }");
  });
  it('colours the legal links too', () => {
    expect(footer({ columns: [{ id: 'l', title: 'Legal', placement: 'legal', items: [{ id: 'p', label: 'Privacy', href: '/privacy', color: '#123456' }] }] })).toContain('style="--he-ftr-link-c:#123456"');
  });
  it('refuses a colour or a place that is not one', () => {
    const column = (item: Record<string, unknown>) => ({ footer: [{ id: 'c', title: '', items: [{ id: 'i', label: 'L', href: '/', ...item }] }] });
    expect(navigationSchema.safeParse(column({ color: 'red;}' })).success).toBe(false);
    expect(navigationSchema.safeParse(column({ orderMobile: 1.5 })).success).toBe(false);
    expect(navigationSchema.safeParse(column({ orderMobile: 2, color: '#123456' })).success).toBe(true);
  });
});

describe('a social link’s own mark', () => {
  it('is an SVG from the media library, drawn as a mask in the icons’ colour', () => {
    const html = footer({ social: [{ network: 'x', href: 'https://x.com/a', iconUrl: '/media/marks/x.svg' }], socialInHead: true });
    expect(html).toContain('<span class="he-soc-own" style="--he-soc-mask:url(&quot;/media/marks/x.svg&quot;)" aria-hidden="true"></span>');
    expect(html.slice(html.indexOf('he-ftr__social'))).not.toContain('<svg');
  });
  it('refuses anything else', () => {
    for (const iconUrl of ['/media/x.png', 'https://example.com/x.svg', '/media/../x.svg', '/media/x.svg");}', '/media/a b.svg']) {
      expect(navigationSchema.safeParse({ social: [{ network: 'x', href: 'https://x.com/a', iconUrl }] }).success).toBe(false);
    }
    // And a stored one that is not safe is drawn as the built-in mark.
    expect(footer({ social: [{ network: 'x', href: 'https://x.com/a', iconUrl: '/media/x.svg")' }], socialInHead: true })).not.toContain('he-soc-own');
  });
});

describe('the fixes', () => {
  it('draws no heading for a column without a title, and keeps its list open on phones', () => {
    const html = renderToStaticMarkup(<FooterColumn title="" items={[{ id: 'a', label: 'Alpha', href: '/a' }]} />);
    expect(html).toBe('<div class="he-ftr__col is-static"><ul class="he-ftr__links"><li><a href="/a">Alpha</a></li></ul></div>');
    expect(renderToStaticMarkup(<FooterColumn title="Studio" items={[]} />)).toContain('<h2 class="he-ftr__coltitle"><button type="button" aria-expanded="false"');
  });
  it('keeps the mirrored top bar of the open menu at its height', () => {
    expect(styles('library-upgrades.css')).toContain('.he-menu__top.is-mirrored { flex-shrink: 0; }');
  });
  it('gives the cookie notice’s button padding and line height to the later layer', () => {
    const details = styles('library-details.css');
    const later = details.slice(details.indexOf('/* The cookie notice on one line'));
    expect(later).toContain(".he-cookie[style*='--he-cookie-btn-pad'] .he-btn { height: auto; min-height: 0; padding: var(--he-cookie-btn-pad); }");
    expect(later).toContain(".he-cookie[style*='--he-cookie-btn-line'] .he-btn { line-height: var(--he-cookie-btn-line); }");
    expect(details.indexOf("--he-cookie-btn-pad'] .he-btn")).toBe(details.lastIndexOf("--he-cookie-btn-pad'] .he-btn"));
    expect(later.slice(0, later.indexOf('}\n}'))).toContain('@layer he-details {');
  });
});
