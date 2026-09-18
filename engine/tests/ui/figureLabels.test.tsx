// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FIGURE_LABELS } from '@/lib/blocks';

/* ═══════════════════════════════════════════════════════════════════════════
   The diagram whose words could not be edited
   ───────────────────────────────────────────────────────────────────────────
   The figure block had a label list in the admin and three string literals in
   the component. `labels` defaulted to empty, so the page drew "SOURCE A" and
   the editor showed no box containing it — the data existed, the control
   existed, and nothing connected them. That is the failure this repository
   already warns about by name, repeated in a second place.

   Reported as "can't edit diagram values", which is exactly how it looks.
   ═══════════════════════════════════════════════════════════════════════════ */

vi.mock('@/components/admin/MediaPicker', () => ({ MediaPicker: () => null }));
vi.mock('@/components/admin/RichTextEditor', () => ({ RichTextEditor: () => null }));

const { BlockFields } = await import('@/components/admin/blockFields');

afterEach(cleanup);

const boxes = (root: HTMLElement) =>
  [...root.querySelectorAll<HTMLInputElement>('input[type="text"], input:not([type])')].map((i) => i.value);

describe('a figure with no labels of its own', () => {
  it('shows the words the diagram actually draws', () => {
    const { container } = render(
      <BlockFields type="figure" props={{ kind: 'converge', labels: [] }} set={() => {}} />,
    );
    for (const word of FIGURE_LABELS.converge) {
      expect(boxes(container), word).toContain(word);
    }
  });

  /* Showing them is not storing them: an untouched page must stay untouched. */
  it('writes nothing until one is typed over', () => {
    const onChange = vi.fn();
    render(<BlockFields type="figure" props={{ kind: 'converge', labels: [] }} set={onChange} />);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('stores the whole list once one is edited', () => {
    const onChange = vi.fn();
    const { container } = render(
      <BlockFields type="figure" props={{ kind: 'converge', labels: [] }} set={onChange} />,
    );
    const first = container.querySelector<HTMLInputElement>('input')!;
    fireEvent.change(first, { target: { value: 'Payments' } });

    const written = onChange.mock.calls.at(-1)![0].labels as string[];
    expect(written[0]).toBe('Payments');
    // The other two survive rather than being lost to the empty array.
    expect(written).toHaveLength(3);
    expect(written[2]).toBe(FIGURE_LABELS.converge[2]);
  });
});

describe('a figure whose labels were written', () => {
  it('shows those, not the defaults', () => {
    const { container } = render(
      <BlockFields type="figure" props={{ kind: 'converge', labels: ['One', 'Two', 'Three'] }} set={() => {}} />,
    );
    expect(boxes(container)).toContain('One');
    expect(boxes(container)).not.toContain('SOURCE A');
  });
});

describe('the two diagrams want different words', () => {
  it('gives a layer stack its own defaults rather than "SOURCE A"', () => {
    const onChange = vi.fn();
    const { container } = render(
      <BlockFields type="figure" props={{ kind: 'converge', labels: [] }} set={onChange} />,
    );
    fireEvent.change(container.querySelector('select')!, { target: { value: 'layers' } });

    const next = onChange.mock.calls.at(-1)![0];
    expect(next.kind).toBe('layers');
    expect(next.labels).toEqual([...FIGURE_LABELS.layers]);
  });

  it('keeps words somebody actually wrote when the diagram changes', () => {
    const onChange = vi.fn();
    const mine = ['Payments', 'Players', 'Risk'];
    const { container } = render(
      <BlockFields type="figure" props={{ kind: 'converge', labels: mine }} set={onChange} />,
    );
    fireEvent.change(container.querySelector('select')!, { target: { value: 'layers' } });
    expect(onChange.mock.calls.at(-1)![0].labels).toEqual(mine);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   The same diagram, drawn by two different blocks
   ───────────────────────────────────────────────────────────────────────────
   A hero draws this picture from its own `figureLabels`; the figure block
   draws it from `labels`. Fixing only the figure block left somebody typing
   into the control that was not driving their diagram, and watching the page
   not change — which is what was reported, and looked like a save that did
   not work.

   A converge diagram draws exactly three labels, so a fourth row was a box
   that did nothing.
   ═══════════════════════════════════════════════════════════════════════════ */

describe('a hero that draws the diagram itself', () => {
  it('shows the words on the page, not an empty list', () => {
    const { container } = render(
      <BlockFields type="hero" props={{ figure: 'converge', figureLabels: [] }} set={() => {}} />,
    );
    for (const word of FIGURE_LABELS.converge) {
      expect(boxes(container), word).toContain(word);
    }
  });

  it('keeps labels somebody wrote', () => {
    const { container } = render(
      <BlockFields type="hero" props={{ figure: 'converge', figureLabels: ['Hexens', 'BetBoyz', 'GameGuardz'] }} set={() => {}} />,
    );
    expect(boxes(container)).toContain('Hexens');
    expect(boxes(container)).not.toContain('SOURCE A');
  });

  it('offers nothing when the hero has no diagram at all', () => {
    const { container } = render(<BlockFields type="hero" props={{ figure: 'none' }} set={() => {}} />);
    expect(boxes(container)).not.toContain('SOURCE A');
  });
});

/* This said three, briefly. Capping at three was right when the diagram drew
   exactly two curves and a fourth label did nothing — and wrong the moment the
   geometry was worked out instead of typed, because a fourth source is now a
   fourth source. The cap is the schema's, not the drawing's. */
describe('the number of labels a diagram will draw', () => {
  const addLine = (root: HTMLElement) =>
    [...root.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Add line');

  it('offers a fourth on a converge diagram, which now draws it', () => {
    const { container } = render(
      <BlockFields type="figure" props={{ kind: 'converge', labels: ['A', 'B', 'C'] }} set={() => {}} />,
    );
    expect(addLine(container)).toBeTruthy();
  });

  it('stops at six, where the schema does', () => {
    const six = ['A', 'B', 'C', 'D', 'E', 'F'];
    const { container } = render(
      <BlockFields type="figure" props={{ kind: 'converge', labels: six }} set={() => {}} />,
    );
    expect(addLine(container)).toBeUndefined();
  });

  it('stops a layer stack at five, which is what it draws', () => {
    const five = ['A', 'B', 'C', 'D', 'E'];
    const { container } = render(
      <BlockFields type="figure" props={{ kind: 'layers', labels: five }} set={() => {}} />,
    );
    expect(addLine(container)).toBeUndefined();
  });

  it('offers the same on the hero’s own diagram', () => {
    const { container } = render(
      <BlockFields type="hero" props={{ figure: 'converge', figureLabels: ['A', 'B', 'C'] }} set={() => {}} />,
    );
    expect(addLine(container)).toBeTruthy();
  });
});
