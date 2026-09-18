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
