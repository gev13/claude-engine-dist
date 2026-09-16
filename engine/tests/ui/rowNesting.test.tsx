// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BlockFields } from '@/components/admin/blockFields';
import { MAX_ROW_DEPTH, type AnyBlock } from '@/lib/blocks';

/* ═══════════════════════════════════════════════════════════════════════════
   Adding a block to a column
   ───────────────────────────────────────────────────────────────────────────
   The renderer drops a row past `MAX_ROW_DEPTH`, so the one thing this picker
   must never do is offer one there: a block that disappears on save is worse
   than a block that was never on the menu. `tests/rows.test.ts` holds the
   parser to the same number from the other side.

   The search box is the other half. Sixty-three blocks in a three-column grid
   inside a column inside a row is a lot of scrolling for somebody who already
   knows they want a heading.
   ═══════════════════════════════════════════════════════════════════════════ */

// The media picker reaches for SWR and the admin client, and no test here
// opens it.
vi.mock('@/components/admin/MediaPicker', () => ({ MediaPicker: () => null }));

afterEach(cleanup);

/** A row whose single column holds `inner`, nested `levels` deep. */
function rowProps(levels: number): Record<string, unknown> {
  let blocks: AnyBlock[] = [];
  for (let level = levels; level >= 2; level -= 1) {
    blocks = [{ id: `r${level}`, type: 'row', props: { columns: [{ id: `c${level}`, width: { base: 12 }, blocks }] } }];
  }
  return { columns: [{ id: 'c1', width: { base: 12 }, blocks }] };
}

/** Open the deepest column's "add a block" picker and return it. */
function openDeepestPicker(levels: number): HTMLElement {
  render(<BlockFields type="row" props={rowProps(levels)} set={() => {}} />);

  // The first column of each row is already expanded, so the only thing to
  // click on the way down is the nested row itself.
  for (let level = 1; level < levels; level += 1) {
    fireEvent.click(screen.getAllByText('Row and columns')[level - 1]!);
  }

  /* First, not last: a column renders its blocks — the nested row and
     everything under it — before its own "add" button, so in document order
     the deepest column's button comes first. */
  fireEvent.click(screen.getAllByRole('button', { name: /Add block to this column/ })[0]!);

  return screen.getAllByLabelText('Search blocks')[0]!.parentElement!;
}

/** The grid of block choices — the panel also holds Cancel and the search box. */
const choices = (panel: HTMLElement) => panel.lastElementChild as HTMLElement;

describe('the block picker inside a column', () => {
  it('offers a row while there is room to nest one', () => {
    const panel = openDeepestPicker(1);
    expect(within(choices(panel)).getByRole('button', { name: 'Row and columns' })).toBeTruthy();
  });

  it('still offers one at the level below', () => {
    const panel = openDeepestPicker(MAX_ROW_DEPTH - 1);
    expect(within(choices(panel)).getByRole('button', { name: 'Row and columns' })).toBeTruthy();
  });

  it('stops offering a row where the renderer would drop it', () => {
    const panel = openDeepestPicker(MAX_ROW_DEPTH);
    expect(within(choices(panel)).queryByRole('button', { name: 'Row and columns' })).toBeNull();
    // And says why, rather than leaving somebody hunting for a missing block.
    expect(within(panel).getByText(/already at the limit/)).toBeTruthy();
    // Every other block is still on offer; only the row is withheld.
    expect(within(choices(panel)).getAllByRole('button').length).toBeGreaterThan(20);
  });

  it('narrows the list as you type, and matches the label', () => {
    const panel = openDeepestPicker(1);

    fireEvent.change(within(panel).getByLabelText('Search blocks'), { target: { value: 'accordion' } });
    const shown = within(choices(panel)).getAllByRole('button');
    expect(shown.length).toBeGreaterThan(0);
    expect(shown.length).toBeLessThan(10);
    for (const button of shown) expect(button.textContent!.toLowerCase()).toContain('accordion');
  });

  it('says so rather than showing an empty grid', () => {
    const panel = openDeepestPicker(1);
    fireEvent.change(within(panel).getByLabelText('Search blocks'), { target: { value: 'zzzz' } });
    expect(within(choices(panel)).getByText(/No block matches/)).toBeTruthy();
    expect(within(choices(panel)).queryAllByRole('button')).toHaveLength(0);
  });
});
