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

describe('the fill above a pinned notch tab (3.19.4)', () => {
  const css = readFileSync(path.join(__dirname, '../src/styles/library-upgrades.css'), 'utf8');
  const header = readFileSync(path.join(__dirname, '../src/components/site/Header.tsx'), 'utf8');

  it('exists only for a notch header that stays on top', () => {
    expect(header).toContain("const pinnedCap = h.variant === 'notch' && (h.stickyMobile || h.stickyDesktop);");
    expect(header).toContain("className={cn('he-notch-cap', h.stickyMobile && 'is-sm', h.stickyDesktop && 'is-lg')}");
    // The 3.19.2 band (full width) and 3.19.3 fill on the header itself are gone.
    expect(header).not.toContain("'is-pinned'");
    expect(css).not.toContain('.is-pinned');
  });

  it('is page content kept above the tab by the scroll itself, only where scroll timelines exist', () => {
    const block = css.slice(css.indexOf('@supports (animation-timeline: scroll())'));
    expect(block).toMatch(/\.he-notch-cap \{[^}]*position: absolute;[^}]*left: var\(--he-cap-l, 0px\);[^}]*width: var\(--he-cap-w, 0px\);/);
    expect(block).toContain('animation-timeline: scroll(root block);');
    expect(css).toContain('.he-notch-cap { display: none; }');
    expect(css).toMatch(/@keyframes he-notch-cap \{\s*from \{ transform: translateY\(calc\(-200px - var\(--he-cap-o, 0px\)\)\); \}\s*to \{ transform: translateY\(calc\(var\(--he-scroll-max, 0px\) - 200px - var\(--he-cap-o, 0px\)\)\); \}/);
    // Reduced motion shortens every animation's duration; this one follows the scroll, so it keeps its own.
    expect(header).toContain("cap.style.setProperty('animation-duration', 'auto', 'important');");
  });
});
