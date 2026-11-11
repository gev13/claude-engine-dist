/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest';
import { slidingRow } from '@/components/blocks/library/ScrollPin';
import { chromeSchema } from '@/lib/chrome';
import { chromeCss } from '@/lib/chromeCss';

/* 3.34.1 — the footer's social icons bare on every width, and a pinned
   section that follows the sliding row shown on this screen. */

const footer = (value: unknown) => chromeCss(chromeSchema.parse({ footer: value }));

describe('the footer’s social icons', () => {
  it('keep their ring until set', () => {
    expect(footer({})).toBe('');
    expect(footer({ socialLook: 'circle' })).toBe('');
  });
  it('drop the ring on every width, leaving names and the box sizes alone', () => {
    const out = footer({ socialLook: 'plain', socialBox: '24px' });
    expect(out).toContain('.he-ftr .he-ftr__social:not(.is-text) a{border:0;border-radius:0}');
    expect(out).toContain('.he-ftr .he-ftr__social a{width:24px;height:24px}');
    expect(out).not.toMatch(/@media[^{]*\{[^}]*\.he-ftr__social:not\(\.is-text\)/);
  });
  it('refuses any other look', () => {
    expect(chromeSchema.safeParse({ footer: { socialLook: 'ring' } }).success).toBe(false);
  });
});

describe('the pinned section’s sliding row', () => {
  const row = (shown: boolean) => {
    const el = document.createElement('ul');
    el.className = 'he-swipe-track';
    el.style.display = 'flex';
    el.style.overflowX = 'auto';
    el.getClientRects = () => (shown ? ([{ width: 1, height: 1 }] as unknown as DOMRectList) : ([] as unknown as DOMRectList));
    return el;
  };
  it('is the first one shown on this screen, not one hidden here', () => {
    const host = document.createElement('div');
    const hidden = row(false);
    const shown = row(true);
    host.append(hidden, shown);
    expect(slidingRow(host)).toBe(shown);
  });
  it('is the first when both are shown', () => {
    const host = document.createElement('div');
    const first = row(true);
    host.append(first, row(true));
    expect(slidingRow(host)).toBe(first);
  });
  it('is none when the only one is hidden', () => {
    const host = document.createElement('div');
    host.append(row(false));
    expect(slidingRow(host)).toBeNull();
  });
});
