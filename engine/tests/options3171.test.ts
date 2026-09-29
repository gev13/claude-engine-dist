import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { chromeSchema, resolveChrome } from '@/lib/chrome';
import { themeSchema } from '@/lib/theme';
import { themeToCss } from '@/lib/theme-css';

/* 3.17.1 — the "Read more" links' weight, and a notch header whose tab stays
   at the top of a phone's screen. (Variable fonts: tests/variableFonts.) */

describe('the “Read more” weight', () => {
  it('writes nothing until set, then the weight', () => {
    expect(themeToCss(themeSchema.parse({}))).not.toContain('.he-more{font-weight');
    expect(themeToCss(themeSchema.parse({ buttons: { moreWeight: '700' } }))).toContain('.he-more{font-weight:700}');
    expect(themeSchema.safeParse({ buttons: { moreWeight: 'bold' } }).success).toBe(false);
  });
});

describe('a notch header on phones', () => {
  it('stays put unless chosen, and only a notch header can', () => {
    expect(resolveChrome(chromeSchema.parse({ header: { variant: 'notch' } })).header.stickyMobile).toBe(false);
    expect(resolveChrome(chromeSchema.parse({ header: { variant: 'notch', stickyMobile: true } })).header.stickyMobile).toBe(true);
    expect(resolveChrome(chromeSchema.parse({ header: { variant: 'classic', stickyMobile: true } })).header.stickyMobile).toBe(false);
    const css = readFileSync(path.join(__dirname, '../src/styles/library-upgrades.css'), 'utf8');
    expect(css).toMatch(/@media \(width <= 768px\) \{\s*\.he-hdr--notch\.is-sticky-sm \{ position: fixed; \}/);
  });
});

describe('a notch header on wider screens (3.17.2)', () => {
  it('stays put unless chosen, and only a notch header can', () => {
    expect(resolveChrome(chromeSchema.parse({ header: { variant: 'notch' } })).header.stickyDesktop).toBe(false);
    expect(resolveChrome(chromeSchema.parse({ header: { variant: 'notch', stickyDesktop: true } })).header.stickyDesktop).toBe(true);
    expect(resolveChrome(chromeSchema.parse({ header: { variant: 'classic', stickyDesktop: true } })).header.stickyDesktop).toBe(false);
    const css = readFileSync(path.join(__dirname, '../src/styles/library-upgrades.css'), 'utf8');
    expect(css).toMatch(/@media \(width > 768px\) \{\s*\.he-hdr--notch\.is-sticky-lg \{ position: fixed; \}/);
  });
});

describe('a pinned notch tab filled above, in its own shape (3.19.2, 3.19.3)', () => {
  const css = readFileSync(path.join(__dirname, '../src/styles/library-upgrades.css'), 'utf8');
  const header = readFileSync(path.join(__dirname, '../src/components/site/Header.tsx'), 'utf8');

  it('is marked only for a notch header that stays on top, once the page has moved', () => {
    expect(header).toContain("h.variant === 'notch' && (h.stickyMobile || h.stickyDesktop) && scrolled && 'is-pinned'");
  });

  it('fills only the space above the tab, at the tab’s width, and keeps its curves', () => {
    for (const tier of ['sm', 'lg']) {
      const rule = new RegExp(`\\.he-hdr--notch\\.is-sticky-${tier}\\.is-pinned::before \\{([^}]*)\\}`).exec(css)?.[1] ?? '';
      expect(rule).toContain('bottom: 100%;');
      expect(rule).toContain('left: 0;');
      expect(rule).toContain('right: 0;');
      expect(rule).toContain('background: var(--he-notch-bg, var(--color-ink));');
      expect(rule).not.toContain('box-shadow');
    }
    expect(css).not.toContain('.is-pinned .he-hdr__bar::after');
  });
});
