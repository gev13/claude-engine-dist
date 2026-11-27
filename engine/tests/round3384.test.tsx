import { describe, expect, it } from 'vitest';
import { themeToCss } from '@/lib/theme-css';
import { themeSchema } from '@/lib/theme';

/* 3.38.4 — a diagonal button arrow that turns to point right under the
   pointer and on keyboard focus. Off until set. */

const theme = (value: unknown) => themeToCss(themeSchema.parse(value));

describe('an arrow that turns', () => {
  it('writes nothing unset, or with the other hovers', () => {
    for (const value of [{ arrow: 'diagonal' }, { arrow: 'diagonal', arrowHover: 'slide' }]) {
      const out = theme({ buttons: value });
      expect(out).not.toContain('rotate(0deg)');
      expect(out).not.toContain('rotate(45deg)');
    }
  });
  it('turns the diagonal arrows back to their drawing, and the careers card’s a quarter', () => {
    const out = theme({ buttons: { arrow: 'diagonal', arrowHover: 'turn', arrowSize: '10px', arrowLine: 1.5 } });
    expect(out).toContain('.he-btn:is(:hover,:focus-visible)>svg:last-child>path,.he-cbtn:not(.is-text):not(.is-icon-only):is(:hover,:focus-visible)>svg:last-child:not(:first-child)>path{transform:rotate(0deg) scale(1.3)}');
    expect(theme({ buttons: { arrow: 'diagonal', arrowHover: 'turn', arrowTurnScale: 1.6 } })).toContain('{transform:rotate(0deg) scale(1.6)}');
    expect(themeSchema.safeParse({ buttons: { arrowTurnScale: 9 } }).success).toBe(false);
    expect(out).toContain('.he-jobc:is(:hover,:focus-within) .he-jobc__btn>svg:last-child>path{transform:rotate(45deg)}');
    expect(out).toContain('transition:transform calc(200ms * var(--he-motion,1)) ease');
    expect(out).toMatch(/@media \(prefers-reduced-motion:reduce\)\{[^{]*\{transition:none\}\}/);
    // 3.38.2's size and line are still written.
    expect(out).toContain('vector-effect:non-scaling-stroke');
  });
  it('leaves an arrow pointing right as it is drawn', () => {
    expect(theme({ buttons: { arrowHover: 'turn' } })).not.toContain('rotate(0deg)');
  });
});
