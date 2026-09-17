import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { toHex } from '@/components/admin/useBandStyle';

/* ═══════════════════════════════════════════════════════════════════════════
   Turning a computed colour into one the panel can show
   ───────────────────────────────────────────────────────────────────────────
   The Design panel measures what a block already looks like so an editor is
   not typing over a value they cannot see. Computed style answers in `rgb()`
   and the colour input speaks hex, so something has to translate — and the
   translation has to know the difference between a colour and the absence of
   one. Showing `#000000` for a transparent band would read as a deliberate
   choice of black, which an editor then has to undo.
   ═══════════════════════════════════════════════════════════════════════════ */

describe('toHex', () => {
  it('converts what getComputedStyle actually returns', () => {
    expect(toHex('rgb(16, 16, 20)')).toBe('#101014');
    expect(toHex('rgb(255, 255, 255)')).toBe('#ffffff');
    expect(toHex('rgba(217, 79, 43, 1)')).toBe('#d94f2b');
  });

  it('pads single digits, so a dark colour is still six characters', () => {
    // #010203 rather than #123 — the colour input accepts nothing else.
    expect(toHex('rgb(1, 2, 3)')).toBe('#010203');
  });

  it('rounds, because a computed colour can carry fractions', () => {
    expect(toHex('rgb(16.6, 16.2, 20.5)')).toBe('#111015');
  });

  /* The important one: transparent is not a colour anybody chose. */
  it('says nothing for a fully transparent band', () => {
    expect(toHex('rgba(0, 0, 0, 0)')).toBeUndefined();
    expect(toHex('rgba(255, 255, 255, 0)')).toBeUndefined();
  });

  it('says nothing rather than guessing at anything else', () => {
    for (const value of ['transparent', 'none', '', 'color(srgb 1 0 0)', 'oklch(0.7 0.1 30)']) {
      expect(toHex(value), value).toBeUndefined();
    }
  });

  it('keeps a colour that is merely semi-transparent', () => {
    // Half-opaque is still a colour on the page; only fully clear is absence.
    expect(toHex('rgba(16, 16, 20, 0.5)')).toBe('#101014');
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   Which fields inherit something, and which inherit nothing
   ───────────────────────────────────────────────────────────────────────────
   "inherit" was on every colour and border field, including the ones where
   nothing is inherited at all. An overlay and a gradient stop are things the
   engine draws only once you ask for one — there is no value being handed
   down from anywhere, so the word names something that does not exist.
   ═══════════════════════════════════════════════════════════════════════════ */


const panel = readFileSync(
  fileURLToPath(new URL('../src/components/admin/BlockDesignPanel.tsx', import.meta.url)),
  'utf8',
);

const fieldFor = (label: string) => {
  const at = panel.indexOf(`label="${label}"`);
  expect(at, label).toBeGreaterThan(-1);
  // Back to the start of the element, forward to the end of its props.
  const open = panel.lastIndexOf('<', at);
  return panel.slice(open, panel.indexOf('/>', at) + 2);
};

describe('fields that inherit nothing say so', () => {
  it.each(['Overlay', 'Gradient from', 'Through (optional)', 'Gradient to'])('%s says none', (label) => {
    const field = fieldFor(label);
    expect(field).toContain('placeholder="none"');
    // And it must not claim to inherit a value it cannot have.
    expect(field).not.toContain('inherited=');
  });
});

describe('fields that do inherit show the measurement', () => {
  it('background colour takes the block’s own band colour', () => {
    expect(fieldFor('Colour')).toContain('band.box.background');
  });

  it('each border side takes its own measured width', () => {
    for (const [label, side] of [['Top', 'top'], ['Right', 'right'], ['Bottom', 'bottom'], ['Left', 'left']] as const) {
      expect(fieldFor(label), label).toContain(`band.box.${side}Width`);
      // `emptyLabel`, not `placeholder`: the note under the box would
      // otherwise read "none" beneath a measured value.
      expect(fieldFor(label), label).toContain('emptyLabel="none"');
    }
  });

  it('radius takes the measured corner', () => {
    expect(fieldFor('Radius')).toContain('band.box.radius');
  });
});
