import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CHART_DEFAULTS, STATUS_DEFAULTS, themeSchema } from '@/lib/theme';
import { themeToCss } from '@/lib/theme-css';
import { MESSAGES } from '@/lib/messages';

/* ═══════════════════════════════════════════════════════════════════════════
   The values that stopped being decisions the engine makes alone
   ───────────────────────────────────────────────────────────────────────────
   Three things came off the hardcoded list at once, and all three share one
   rule: **a site that changes nothing must look and read exactly as it did.**
   The defaults are the values that were compiled in, to the pixel and to the
   hex digit, so this is a release nobody has to look at.
   ═══════════════════════════════════════════════════════════════════════════ */

const css = (theme: unknown) => themeToCss(themeSchema.parse(theme));
const styles = (name: string) =>
  readFileSync(fileURLToPath(new URL(`../src/styles/${name}`, import.meta.url)), 'utf8');

const globals = styles('globals.css');

describe('an untouched site', () => {
  it('emits none of the new properties', () => {
    const out = css({});
    for (const token of ['--he-status-', '--he-chart-', '--he-block-lead', '--he-block-text', '--he-block-small']) {
      expect(out, token).not.toContain(token);
    }
  });

  /* The defaults live in the stylesheet, beside every other `--he-*`, which
     is what makes "changes nothing" cost nothing. */
  it('finds every default declared in globals.css', () => {
    for (const [name, value] of Object.entries(STATUS_DEFAULTS)) {
      expect(globals, name).toContain(`--he-status-${name}: ${value}`);
    }
    expect(globals).toContain('--he-block-lead: 17px');
    expect(globals).toContain('--he-block-text: 16px');
    expect(globals).toContain('--he-block-small: 15px');
  });
});

describe('status colours', () => {
  it('are emitted when a site sets them', () => {
    const out = css({ status: { success: '#00ff00', danger: '#ff0000' } });
    expect(out).toContain('--he-status-success:#00ff00');
    expect(out).toContain('--he-status-danger:#ff0000');
    // And only the ones that were set.
    expect(out).not.toContain('--he-status-warning');
  });

  it('refuse anything that is not a colour, since they reach a style element', () => {
    expect(themeSchema.safeParse({ status: { success: 'green;}html{display:none' } }).success).toBe(false);
  });

  /* The point of keeping them out of the palette: a success green that
     follows the brand accent stops meaning success. */
  it('are not wired to the accent', () => {
    const out = css({ colors: { primary: '#123456' } });
    expect(out).not.toContain('--he-status-success');
  });

  it('are what the stylesheets now read', () => {
    const elements = styles('library-elements.css');
    const widgets = styles('library-widgets.css');
    expect(elements).toContain('var(--he-status-success)');
    expect(elements).toContain('var(--he-status-warning)');
    expect(elements).toContain('var(--he-status-danger)');
    expect(widgets).toContain('var(--he-status-rating)');
    // The literals they replaced are gone from those rules.
    expect(elements).not.toContain('#3fb37f');
    expect(widgets).not.toContain('fill: #f2b01e');
  });
});

describe('chart series', () => {
  it('are emitted one-based, matching the properties the stylesheet reads', () => {
    const out = css({ chart: ['#111111', '#222222'] });
    expect(out).toContain('--he-chart-1:#111111');
    expect(out).toContain('--he-chart-2:#222222');
    expect(out).not.toContain('--he-chart-3');
  });

  it('stop at six, because that is how many the stylesheet declares', () => {
    const seven = Array.from({ length: 7 }, () => '#111111');
    expect(themeSchema.safeParse({ chart: seven }).success).toBe(false);
    expect(CHART_DEFAULTS).toHaveLength(6);
  });

  it('name the same defaults the stylesheet declares', () => {
    const widgets = styles('library-widgets.css');
    // The first follows the accent; the rest are literals there.
    for (const value of CHART_DEFAULTS.slice(1)) {
      expect(widgets, value).toContain(value);
    }
  });
});

describe('block text sizes', () => {
  it('are emitted when set, and validated as lengths', () => {
    expect(css({ blockText: { lead: '19px' } })).toContain('--he-block-lead:19px');
    expect(themeSchema.safeParse({ blockText: { lead: 'huge' } }).success).toBe(false);
  });

  /* They are deliberately *not* the body role: pointing them at it would have
     moved every intro paragraph on every existing site from 17px to 16px. */
  it('are independent of the body role', () => {
    const out = css({ typography: { body: { base: { size: '20px' } } } });
    expect(out).not.toContain('--he-block-lead');
  });
});

describe('words inside blocks', () => {
  /* The only item on the hardcoded list a visitor could see was wrong: an
     Armenian page whose slider arrows still said "Next slide". */
  it('are in the catalogue an editor can translate', () => {
    for (const key of ['block.nextSlide', 'block.close', 'block.breadcrumb', 'block.searchTheBlog']) {
      expect(MESSAGES, key).toHaveProperty(key);
    }
  });

  it('left no literal aria-labels behind in the blocks', () => {
    const files = ['Carousel.tsx', 'showcase.tsx', 'PostPager.tsx', 'widgets.tsx', 'Configurator.tsx'];
    for (const name of files) {
      const source = readFileSync(
        fileURLToPath(new URL(`../src/components/blocks/library/${name}`, import.meta.url)),
        'utf8',
      );
      // A composed label (`Compare ${a} and ${b}`) is a separate problem; a
      // plain capitalised string is the one this fixed.
      expect(source.match(/aria-label="[A-Z]/g) ?? [], name).toEqual([]);
    }
  });
});
