import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { blockStyleSchema } from '@/lib/blockStyle';
import { blockStyleToCss } from '@/lib/blockStyle-css';
import { themeSchema } from '@/lib/theme';
import { themeToCss } from '@/lib/theme-css';

/* ═══════════════════════════════════════════════════════════════════════════
   Space between things, and how fast they move
   ───────────────────────────────────────────────────────────────────────────
   Both work the same way and for the same reason: an inherited custom
   property, read by the stylesheets with their own drawn-in value as the
   fallback. One value on a block's wrapper then reaches every grid or
   transition inside it without naming any of them, and a block nobody has
   touched emits nothing and renders exactly as before.

   The two judgements worth pinning:

     • **Not every gap.** An icon beside a word is not "space between items",
       and a single property that moved both would be unusable. Only the rules
       that lay out repeated things read `--he-gap`.
     • **A multiplier, not a duration.** A block has a 150ms hover and a 600ms
       entrance; one duration for both would flatten a difference somebody
       chose.
   ═══════════════════════════════════════════════════════════════════════════ */

const styles = (name: string) =>
  readFileSync(fileURLToPath(new URL(`../src/styles/${name}`, import.meta.url)), 'utf8');

const css = (style: unknown) => blockStyleToCss('abc', blockStyleSchema.parse(style));

describe('a block nobody touched', () => {
  it('emits neither property', () => {
    const out = css({ width: 'wide' });
    expect(out).not.toContain('--he-gap');
    expect(out).not.toContain('--he-motion');
  });

  it('is what every fallback in the stylesheets preserves', () => {
    const content = styles('library-content.css');
    // The value that was there before the rewrite is now the fallback.
    expect(content).toMatch(/gap: var\(--he-gap, \d/);
    expect(styles('library-blocks.css')).toMatch(/calc\(\d+m?s \* var\(--he-motion, 1\)\)/);
  });
});

describe('a gap set on a block', () => {
  it('is emitted as the inherited property', () => {
    expect(css({ gap: '48px' })).toContain('--he-gap:48px');
  });

  it('completes a bare number as pixels, like every length field', () => {
    expect(css({ gap: '48' })).toContain('--he-gap:48px');
  });

  it('refuses anything that is not a length', () => {
    expect(blockStyleSchema.safeParse({ gap: '48px;color:red' }).success).toBe(false);
  });

  /* The whole point of scoping it: inline spacing must not move. */
  it('is not read by inline spacing', () => {
    const content = styles('library-content.css');
    const link = content.split('\n').find((l) => l.includes('.he-textlink {'))!;
    expect(link).toContain('gap: 6px');
    expect(link).not.toContain('--he-gap');
  });

  it('is read by the rules that lay out repeated things', () => {
    const widgets = styles('library-widgets.css');
    expect(widgets).toMatch(/gap: var\(--he-gap,/);
  });

  /* A row's gap must not silently restyle a block sitting in its column. */
  it('stops at a nested block', () => {
    expect(styles('library-blocks.css')).toContain('.he-nested { --he-gap: initial; }');
  });
});

describe('animation speed', () => {
  it('is emitted as a bare multiplier', () => {
    expect(css({ motion: 0.5 })).toContain('--he-motion:0.5');
  });

  it('accepts nought, which switches the block’s animation off', () => {
    expect(css({ motion: 0 })).toContain('--he-motion:0');
  });

  it('refuses a negative or absurd multiplier', () => {
    expect(blockStyleSchema.safeParse({ motion: -1 }).success).toBe(false);
    expect(blockStyleSchema.safeParse({ motion: 99 }).success).toBe(false);
  });

  it('keeps the relation between a block’s own timings', () => {
    // Both scale from the same multiplier rather than being replaced, so a
    // 150ms hover stays four times quicker than a 600ms entrance.
    const blocks = styles('library-blocks.css');
    const durations = [...blocks.matchAll(/calc\((\d+(?:\.\d+)?)(m?s) \* var\(--he-motion, 1\)\)/g)];
    expect(durations.length).toBeGreaterThan(10);
    expect(new Set(durations.map((m) => m[1])).size).toBeGreaterThan(1);
  });

  /* Reduced motion switches animation off outright; scaling a zero would be
     meaningless, and touching those rules would be a bug. */
  it('left the reduced-motion rules alone', () => {
    for (const name of ['library-blocks.css', 'library-layouts.css', 'library-showcase.css']) {
      const file = styles(name);
      const at = file.indexOf('prefers-reduced-motion');
      const rule = file.slice(at, file.indexOf('}', at));
      expect(rule, name).not.toContain('--he-motion');
    }
  });
});

describe('the site-wide versions', () => {
  it('are emitted from the theme when set', () => {
    const out = themeToCss(themeSchema.parse({ gap: '32px', motion: 0.5 }));
    expect(out).toContain('--he-gap:32px');
    expect(out).toContain('--he-motion:0.5');
  });

  it('are absent from an untouched theme', () => {
    const out = themeToCss(themeSchema.parse({}));
    expect(out).not.toContain('--he-gap');
    expect(out).not.toContain('--he-motion');
  });

  /* A block's own value sits on a more specific element, so it wins without
     anything having to say so. */
  it('are overridden by a block’s own, by cascade rather than by rule', () => {
    expect(css({ gap: '8px' })).toContain('.he-b-abc{');
    expect(themeToCss(themeSchema.parse({ gap: '32px' }))).toContain(':root');
  });
});
