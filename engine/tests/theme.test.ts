import { describe, expect, it } from 'vitest';
import { emptyTheme, isColor, isLength, isLineHeight, parseTheme, themeSchema } from '@/lib/theme';
import { themeToCss } from '@/lib/theme-css';

describe('theme value grammars', () => {
  it('accepts the colour notations the editor produces', () => {
    for (const value of ['#fff', '#f3f2f2', '#f3f2f2cc', 'rgb(32 30 29)', 'rgba(243,242,242,0.14)', 'hsl(4 85% 50%)']) {
      expect(isColor(value), value).toBe(true);
    }
  });

  it('rejects anything that is not a colour', () => {
    for (const value of ['url(x)', 'var(--x)', 'red;}', 'expression(1)', '#gggggg', '']) {
      expect(isColor(value), value).toBe(false);
    }
  });

  it('accepts lengths including the fluid clamps the mockups use', () => {
    for (const value of ['0', '16px', '1.62rem', '-0.03em', '7vw', 'clamp(36px, 7vw, 66px)', 'min(4vw,40px)']) {
      expect(isLength(value), value).toBe(true);
    }
  });

  it('rejects lengths that carry anything executable', () => {
    for (const value of ['16px;color:red', 'calc(1px + 1px)', 'attr(x)', '16 px', '']) {
      expect(isLength(value), value).toBe(false);
    }
  });

  it('accepts unitless and absolute line heights', () => {
    expect(isLineHeight('1.62')).toBe(true);
    expect(isLineHeight('24px')).toBe(true);
    expect(isLineHeight('normal')).toBe(false);
  });
});

describe('theme parsing', () => {
  it('yields an empty theme for junk rather than throwing', () => {
    expect(parseTheme(null)).toEqual(emptyTheme);
    expect(parseTheme('not a theme')).toEqual(emptyTheme);
    expect(parseTheme({ colors: { primary: 'javascript:alert(1)' } })).toEqual(emptyTheme);
  });

  it('keeps a valid theme', () => {
    const theme = parseTheme({ colors: { primary: '#ec3013' } });
    expect(theme.colors?.primary).toBe('#ec3013');
  });

  it('refuses a colour that is not a colour', () => {
    expect(themeSchema.safeParse({ colors: { primary: 'red' } }).success).toBe(false);
    expect(themeSchema.safeParse({ colors: { primary: '#ec3013' } }).success).toBe(true);
  });
});

describe('theme to CSS', () => {
  it('emits nothing for an untouched theme', () => {
    expect(themeToCss(emptyTheme)).toBe('');
  });

  it('maps a theme colour onto the token every utility class already reads', () => {
    const css = themeToCss(parseTheme({ colors: { primary: '#00ff00' } }));
    expect(css).toContain('--color-flare:#00ff00');
  });

  it('re-declares the variable inside a media query for an adaptive size', () => {
    const css = themeToCss(
      parseTheme({ typography: { h1: { base: { size: '66px' }, mobile: { size: '32px' } } } }),
    );
    expect(css).toContain('--he-h1-size:66px');
    expect(css).toContain('@media (max-width:768px){:root{--he-h1-size:32px}}');
  });

  it('resolves a font key to its self-hosted stack, never to a raw name', () => {
    const css = themeToCss(parseTheme({ typography: { h1: { base: { family: 'mono' } } } }));
    expect(css).toContain("--he-h1-family:'JetBrains Mono'");
  });

  /* The generator writes directly into a <style> element, so it must refuse a
     value that survived the schema by mistake as well as one that did not. */
  it('drops a value carrying a declaration terminator or a tag', () => {
    const hostile = {
      colors: { primary: '#fff;}</style><script>alert(1)</script>' },
      layout: { containerWidth: '1200px}@import "evil"' },
    } as never;
    expect(themeToCss(parseTheme(hostile))).toBe('');
  });

  it('never emits a brace, semicolon or angle bracket from a value', () => {
    const css = themeToCss(
      parseTheme({
        colors: { primary: '#ec3013', background: '#201e1d' },
        typography: { body: { base: { size: '16px', lineHeight: '1.62' } } },
        buttons: { radius: '4px', primary: { background: '#ec3013' } },
      }),
    );
    expect(css).not.toContain('</');
    expect(css.match(/\{/g)?.length).toBe(css.match(/\}/g)?.length);
  });
});

describe('navigation', () => {
  it('accepts the link targets a menu legitimately needs', async () => {
    const { isSafeHref } = await import('@/lib/navigation');
    for (const v of ['/', '/about', '/services/web-app', 'https://example.com/x?a=1', 'mailto:a@b.com', 'tel:+44 20 1234', '#top']) {
      expect(isSafeHref(v), v).toBe(true);
    }
  });

  /* Menu hrefs land in an `href` attribute, so the grammar is an allowlist. */
  it('refuses a scheme that could execute', async () => {
    const { isSafeHref } = await import('@/lib/navigation');
    for (const v of ['javascript:alert(1)', 'data:text/html,<script>', 'vbscript:x', ' javascript:alert(1)', 'about:blank']) {
      expect(isSafeHref(v), v).toBe(false);
    }
  });

  it('marks an external or new-tab link with a safe rel', async () => {
    const { linkAttrs } = await import('@/lib/navigation');
    expect(linkAttrs({ href: 'https://example.com' }).rel).toBe('noopener noreferrer');
    expect(linkAttrs({ href: '/about', target: 'blank' })).toMatchObject({
      target: '_blank',
      rel: 'noopener noreferrer',
    });
    expect(linkAttrs({ href: '/about' })).toEqual({});
  });

  it('degrades a malformed navigation row to nothing rather than throwing', async () => {
    const { parseNavigation } = await import('@/lib/navigation');
    expect(parseNavigation({ header: [{ id: 'a', label: 'x', href: 'javascript:alert(1)' }] })).toEqual({});
    expect(parseNavigation(null)).toEqual({});
    expect(parseNavigation({ header: [{ id: 'a', label: 'About', href: '/about' }] }).header).toHaveLength(1);
  });
});

describe('site settings', () => {
  it('formats dates in the configured format and zone', async () => {
    const { formatDate } = await import('@/lib/siteSettings');
    const d = new Date('2026-09-09T12:00:00Z');
    expect(formatDate(d, { dateFormat: 'd MMMM yyyy', timeZone: 'UTC' })).toBe('9 September 2026');
    expect(formatDate(d, { dateFormat: 'yyyy-MM-dd', timeZone: 'UTC' })).toBe('2026-09-09');
    expect(formatDate(d, { dateFormat: 'MM/dd/yyyy', timeZone: 'UTC' })).toBe('09/09/2026');
    // No settings at all still produces something sensible.
    expect(formatDate(d, {})).toBe('9 September 2026');
  });

  it('rejects a contact email that is not an email', async () => {
    const { siteSettingsSchema } = await import('@/lib/siteSettings');
    expect(siteSettingsSchema.safeParse({ contactEmail: 'not-an-email' }).success).toBe(false);
    expect(siteSettingsSchema.safeParse({ contactEmail: 'a@b.com' }).success).toBe(true);
  });

  it('degrades a malformed settings row to nothing rather than throwing', async () => {
    const { parseSiteSettings } = await import('@/lib/siteSettings');
    expect(parseSiteSettings({ name: 123 })).toEqual({});
    expect(parseSiteSettings(null)).toEqual({});
    expect(parseSiteSettings({ name: 'Acme' }).name).toBe('Acme');
  });
});
