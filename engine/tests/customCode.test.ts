import { describe, expect, it } from 'vitest';
import {
  ANALYTICS_PATTERN,
  CSS_MAX,
  codeSchema,
  cssWasChanged,
  defaultCode,
  hasAnalytics,
  safeCss,
} from '@/lib/customCode';
import { blockStyleSchema } from '@/lib/blockStyle';
import { blockStyleToCss } from '@/lib/blockStyle-css';
import { snapshotFields } from '@/server/content/revisions';

/* ═══════════════════════════════════════════════════════════════════════════
   Custom code — the two doors that are open, and the ones that are not
   ═══════════════════════════════════════════════════════════════════════════ */

describe('safeCss', () => {
  it('keeps ordinary CSS exactly as it was written', () => {
    const css = '.card {\n  border: 1px solid #333;\n}\n\n@media (max-width: 600px) {\n  .card { border: 0 }\n}\n';
    expect(safeCss(css)).toBe(css);
    expect(cssWasChanged(css)).toBe(false);
  });

  it('removes anything that could close the style element', () => {
    // The one removal that is about safety rather than tidiness: HTML stops
    // parsing a <style> at `</style`, whatever follows it.
    expect(safeCss('.a{}</style><script>alert(1)</script>')).not.toContain('</style');
    expect(safeCss('.a{}</ STYLE >x')).not.toMatch(/<\/\s*style/i);
    expect(cssWasChanged('.a{}</style>')).toBe(true);
  });

  it('removes @import, and keeps the rest of the stylesheet', () => {
    const out = safeCss("@import url('https://evil.example/x.css');\n.kept { color: red }\n");
    expect(out).not.toContain('@import');
    expect(out).toContain('.kept { color: red }');
  });

  it('removes expression() and javascript: urls', () => {
    expect(safeCss('.a{width:expression(alert(1))}')).not.toMatch(/expression\s*\(/i);
    expect(safeCss('.a{background:url(javascript:alert(1))}')).not.toMatch(/javascript\s*:/i);
  });

  it('caps the length rather than refusing the save', () => {
    expect(safeCss('a'.repeat(CSS_MAX + 500))).toHaveLength(CSS_MAX);
  });
});

describe('codeSchema', () => {
  it('defaults to nothing at all, so a site that wants none pays nothing', () => {
    const code = defaultCode();
    expect(code).toEqual({ css: '', analyticsId: '' });
    expect(hasAnalytics(code)).toBe(false);
  });

  it('sanitises the CSS on the way in', () => {
    const parsed = codeSchema.parse({ css: '.a{}</style>' });
    expect(parsed.css).not.toContain('</style');
  });

  it('accepts a GA4 id, uppercased and trimmed', () => {
    expect(codeSchema.parse({ analyticsId: '  g-abcd1234  ' }).analyticsId).toBe('G-ABCD1234');
  });

  it('refuses anything that is not a GA4 id', () => {
    for (const bad of ['UA-12345-1', 'G-', 'G-abc', 'javascript:alert(1)', 'G-ABC"><script>']) {
      expect(codeSchema.safeParse({ analyticsId: bad }).success).toBe(false);
    }
  });

  it('treats an empty id as "no analytics", not as an error', () => {
    const parsed = codeSchema.parse({ analyticsId: '' });
    expect(parsed.analyticsId).toBe('');
    expect(hasAnalytics(parsed)).toBe(false);
  });

  it('holds the pattern to ids that are safe to interpolate into a URL', () => {
    expect(ANALYTICS_PATTERN.test('G-ABCDE12345')).toBe(true);
    expect(ANALYTICS_PATTERN.test('G-ABCDE12345&x=1')).toBe(false);
    expect(ANALYTICS_PATTERN.test("G-ABC'+alert(1)+'")).toBe(false);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   The other half: naming a block so the CSS above has something to aim at
   ═══════════════════════════════════════════════════════════════════════════ */

describe('style.className', () => {
  it('accepts a class name, and several separated by spaces', () => {
    expect(blockStyleSchema.parse({ className: 'promo' }).className).toBe('promo');
    expect(blockStyleSchema.parse({ className: 'promo dark-band' }).className).toBe('promo dark-band');
  });

  it('refuses anything that could break out of the class attribute', () => {
    for (const bad of ['a"onclick="x', "a' b", '<script>', 'a.b', 'a{}', '1leading-digit']) {
      expect(blockStyleSchema.safeParse({ className: bad }).success).toBe(false);
    }
  });

  it('is not part of the CSS the block generates — it is only a hook', () => {
    // The class goes on the wrapper in the renderer; `blockStyleToCss` writes
    // rules for the *block id*, so a class name must never reach a selector.
    const css = blockStyleToCss('abc', blockStyleSchema.parse({ className: 'promo' }));
    expect(css).not.toContain('promo');
  });
});

describe('a page\u2019s own CSS is content', () => {
  it('is captured in a revision, so restoring an old version restores its styling too', () => {
    // A revision that brought back the blocks and left the CSS behind would
    // restore a layout its rules no longer match.
    expect(snapshotFields('page')).toContain('customCss');
    expect(snapshotFields('post')).toContain('customCss');
  });
});
