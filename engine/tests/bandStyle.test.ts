import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { agreed, toHex } from '@/components/admin/useBandStyle';

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

/* ═══════════════════════════════════════════════════════════════════════════
   Typography: one value, or none at all
   ───────────────────────────────────────────────────────────────────────────
   The Typography fields govern every heading in a block at once — and a band
   routinely holds headings at three different sizes. There is then no single
   size for the field to report, and naming the first one would print a figure
   an editor cannot reconcile with what is on the page.

   So disagreement reports nothing. Each property is asked separately, because
   colour usually agrees even where size does not, and a colour is the thing
   most often wanted.
   ═══════════════════════════════════════════════════════════════════════════ */

describe('agreed', () => {
  const read = (v: string | undefined) => v;

  it('reports the value when everything agrees', () => {
    expect(agreed(['#ffffff', '#ffffff', '#ffffff'], read)).toBe('#ffffff');
  });

  it('reports nothing when they disagree', () => {
    // Three headings at three sizes: no single size governs them.
    expect(agreed(['48px', '32px', '24px'], read)).toBeUndefined();
  });

  it('reports the value from a single element', () => {
    expect(agreed(['700'], read)).toBe('700');
  });

  it('reports nothing for an empty band', () => {
    expect(agreed([], read)).toBeUndefined();
  });

  /* A property that could not be read on some elements must not make the
     others look unanimous by disappearing — but neither should it block a
     genuine agreement among the ones that could be read. */
  it('ignores values it could not read', () => {
    expect(agreed(['#ffffff', undefined, '#ffffff'], read)).toBe('#ffffff');
    expect(agreed([undefined, undefined], read)).toBeUndefined();
  });
});

describe('the typography fields show what was measured', () => {
  it.each(['Size', 'Weight', 'Colour', 'Letter spacing'])('%s takes the measured value', (label) => {
    // Both roles share one block of JSX, so the reference is by role.
    expect(panel).toContain(`inherited={band.type[role]?.`);
    expect(panel.includes(`label="${label}"`), label).toBe(true);
  });

  it('asks per role, not once for the whole block', () => {
    expect(panel).toContain("band.type[role]?.color");
    expect(panel).toContain("band.type[role]?.size");
    expect(panel).toContain("band.type[role]?.weight");
    expect(panel).toContain("band.type[role]?.letterSpacing");
  });
});
