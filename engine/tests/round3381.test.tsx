import { describe, expect, it } from 'vitest';
import { chromeSchema } from '@/lib/chrome';
import { chromeCss } from '@/lib/chromeCss';
import { themeSchema } from '@/lib/theme';
import { themeToCss } from '@/lib/theme-css';

/* 3.38.1 — the font fill under the face's own weights (theme.fontFill), the
   footer links' letter spacing, fluid footer gaps, and a language code's own
   face over a language's one face. */

const footer = (value: unknown) => chromeCss(chromeSchema.parse({ footer: value }));

describe('3.38.1', () => {
  it('fills a face under its own weight range, with no italic for a face without one', () => {
    const out = themeToCss(themeSchema.parse({ fontFill: { googleSansFlex: 'googleSans' } }));
    expect(out).toMatch(/font-family:'Google Sans Flex';font-style:normal;font-weight:100 900;[^}]*google-sans-normal-var-cyrillic\.woff2/);
    expect(out).not.toMatch(/font-family:'Google Sans Flex';font-style:italic/);
  });
  it('spaces the footer links’ letters', () => {
    expect(footer({ linkTracking: '-0.3px' })).toContain('.he-ftr .he-ftr__links a{letter-spacing:-0.3px}');
    expect(footer({})).not.toContain('letter-spacing');
  });
  it('takes fluid footer gaps, and refuses what isn’t a size', () => {
    expect(footer({ menusGapMobile: 'min(20px, calc(10vw - 30px))' })).toContain('column-gap:min(20px, calc(10vw - 30px))');
    expect(chromeSchema.safeParse({ footer: { menusGapMobile: '1px;}' } }).success).toBe(false);
    expect(chromeSchema.safeParse({ footer: { gapMobile: '16' } }).success).toBe(false);
  });
  it('gives a language code its own face over a language’s one face', () => {
    const out = chromeCss(chromeSchema.parse({ languages: { faces: { hy: 'notoSansArmenian' } } }));
    expect(out).toMatch(/:root :is\(\.he-langs__item,\.he-lang__item\):lang\(hy\)\{font-family:[^}]+!important\}/);
  });
});
