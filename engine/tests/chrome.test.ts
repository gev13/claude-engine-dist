import { describe, expect, it } from 'vitest';
import { chromeSchema, resolveChrome } from '@/lib/chrome';
import { isSafeImageUrl, navigationSchema, parseNavigation } from '@/lib/navigation';
import { parseTheme, themeSchema } from '@/lib/theme';
import { themeToCss } from '@/lib/theme-css';

describe('site chrome', () => {
  it('fills in the shipped header, menus and footer when nothing is saved', () => {
    const c = resolveChrome(undefined);
    expect(c.header).toMatchObject({ variant: 'classic', sticky: true, overlay: false, collapseAt: 'tablet' });
    expect(c.megaMenu).toBe('compact');
    expect(c.mobileMenu.variant).toBe('drilldown');
    expect(c.footer.variant).toBe('sitemap');
    expect(c.announcement).toBeNull();
    expect(c.regionBar).toBeNull();
  });

  it('keeps an announcement only when it is switched on and has text', () => {
    expect(resolveChrome({ announcement: { enabled: true } }).announcement).toBeNull();
    expect(resolveChrome({ announcement: { text: 'Hello' } }).announcement).toBeNull();
    expect(resolveChrome({ announcement: { enabled: true, text: 'Hello' } }).announcement).toMatchObject({
      text: 'Hello',
      dismissible: true,
    });
  });

  it('refuses variants it cannot render and links that could execute', () => {
    expect(chromeSchema.safeParse({ header: { variant: 'banner' } }).success).toBe(false);
    expect(chromeSchema.safeParse({ announcement: { enabled: true, text: 'x', href: 'javascript:alert(1)' } }).success).toBe(false);
    expect(chromeSchema.safeParse({ regionBar: { options: [{ label: 'UK', href: 'data:text/html,x' }] } }).success).toBe(false);
    expect(chromeSchema.safeParse({ header: { variant: 'pill', collapseAt: 'mobile' }, megaMenu: 'fullscreen' }).success).toBe(true);
  });

  it('accepts the package 2 headers and full-screen menus', () => {
    for (const v of ['splitLogo', 'stacked', 'boxed', 'sidebar', 'rail']) expect(chromeSchema.safeParse({ header: { variant: v } }).success, v).toBe(true);
    for (const v of ['fullscreen', 'fullscreenCentered', 'fullscreenCreative']) expect(chromeSchema.safeParse({ mobileMenu: { variant: v } }).success, v).toBe(true);
    expect(chromeSchema.safeParse({ header: { railButton: 'bottom' } }).success).toBe(false);
  });

  it('keeps a sidebar or rail header solid, with dropdowns that open beside it', () => {
    const sidebar = resolveChrome({ header: { variant: 'sidebar', overlay: true }, megaMenu: 'sheet' });
    expect(sidebar.header.overlay).toBe(false);
    expect(sidebar.megaMenu).toBe('compact');
    expect(resolveChrome({ header: { variant: 'rail' } }).header.railButton).toBe('top');
    // Headers across the top keep what was chosen.
    expect(resolveChrome({ header: { variant: 'boxed', overlay: true }, megaMenu: 'sheet' })).toMatchObject({ header: { overlay: true }, megaMenu: 'sheet' });
  });

  it('is part of the theme, so a bad chrome value is rejected at the boundary', () => {
    expect(themeSchema.safeParse({ chrome: { footer: { variant: 'nope' } } }).success).toBe(false);
    expect(parseTheme({ chrome: { footer: { variant: 'inset' } } }).chrome?.footer?.variant).toBe('inset');
  });
});

describe('alternate palette', () => {
  it('is emitted only when the visitor switch is on', () => {
    const palette = { colorsAlt: { background: '#ffffff' } };
    expect(themeToCss(parseTheme(palette))).not.toContain('data-scheme');
    const css = themeToCss(parseTheme({ ...palette, chrome: { themeToggle: true } }));
    expect(css).toContain(':root[data-scheme="alt"]{--color-ink:#ffffff}');
  });

  it('never leaks the alternate palette into a scoped preview', () => {
    const css = themeToCss(parseTheme({ colorsAlt: { background: '#fff' }, chrome: { themeToggle: true } }), {
      selector: '.he-preview',
    });
    expect(css).not.toContain('data-scheme');
  });
});

describe('menu extensions', () => {
  it('accepts upload paths and https images, nothing else', () => {
    for (const v of ['/media/abc.webp', 'https://cdn.example.com/a.png']) expect(isSafeImageUrl(v), v).toBe(true);
    for (const v of ['javascript:alert(1)', 'http://example.com/a.png', '/media/a.png)x', '/../etc', 'data:image/png;base64,x']) {
      expect(isSafeImageUrl(v), v).toBe(false);
    }
  });

  it('keeps groups, descriptions and image cards on dropdown links', () => {
    const nav = parseNavigation({
      header: [
        {
          id: 'w',
          label: 'Watches',
          href: '/watches',
          children: [
            { id: 'a', label: 'All', href: '/watches', group: 'Explore' },
            { id: 'b', label: 'Big Bang', href: '/watches/big-bang', description: 'The flagship.', imageUrl: '/media/bb.webp' },
          ],
        },
      ],
    });
    expect(nav.header?.[0]?.children?.[1]).toMatchObject({ description: 'The flagship.', imageUrl: '/media/bb.webp' });
  });

  it('knows only the social networks it can draw', () => {
    expect(navigationSchema.safeParse({ social: [{ network: 'linkedin', href: 'https://linkedin.com/company/x' }] }).success).toBe(true);
    expect(navigationSchema.safeParse({ social: [{ network: 'myspace', href: 'https://myspace.com' }] }).success).toBe(false);
  });
});
