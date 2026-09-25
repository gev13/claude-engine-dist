// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AnyBlock } from '@/lib/blocks';
import { CLIPBOARD_KEY } from '@/lib/blockTree';

/* ═══════════════════════════════════════════════════════════════════════════
   The builder's ⋯ menu, the clipboard, and a synced block's card (2.15)
   ───────────────────────────────────────────────────────────────────────────
   Copy puts a marked payload in localStorage; paste brings back a copy with
   new ids, so the pasted block is independent. A synced reference shows a
   locked card, and Detach swaps it for its own copy of the saved tree.
   ═══════════════════════════════════════════════════════════════════════════ */

const SAVED_ID = '5a7ed0b1-0c7a-4000-8000-00000000d3a0';
const savedTree: AnyBlock[] = [{ id: 'saved-h', type: 'heading', props: { title: 'From the saved block' } } as AnyBlock];

vi.mock('swr', () => ({
  default: (key: string | null) => ({
    data: key === '/api/admin/saved-blocks'
      ? { canWrite: true, items: [{ id: SAVED_ID, name: 'Shared heading', description: '', category: '', mode: 'synced', tree: savedTree, usage: 3 }] }
      : undefined,
    isLoading: false,
    mutate: vi.fn(),
  }),
}));
vi.mock('@/lib/admin/client', () => ({ api: vi.fn(), fetcher: vi.fn(), ApiError: class ApiError extends Error {} }));
vi.mock('@/components/admin/MediaPicker', () => ({ MediaPicker: () => null }));
vi.mock('@/components/admin/TemplatePickers', () => ({ ReadySections: () => null }));

const { BlockBuilder } = await import('@/components/admin/BlockBuilder');

let latest: AnyBlock[] = [];
function Harness({ initial }: { initial: AnyBlock[] }) {
  const [value, setValue] = useState(initial);
  latest = value;
  return <BlockBuilder value={value} onChange={setValue} />;
}

beforeEach(() => {
  localStorage.clear();
  latest = [];
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});
afterEach(cleanup);

const heading = (id: string, title: string) => ({ id, type: 'heading', props: { title } }) as AnyBlock;

describe('copy and paste', () => {
  it('copies a block, and pastes an independent copy with a new id', async () => {
    render(<Harness initial={[heading('a1', 'First'), heading('b1', 'Second')]} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'More actions' })[0]!);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Copy block' }));
    expect(JSON.parse(localStorage.getItem(CLIPBOARD_KEY)!)).toMatchObject({ kind: 'he-blocks', blocks: [{ id: 'a1' }] });

    fireEvent.click(await screen.findByRole('button', { name: /^Paste heading$/ }));
    await waitFor(() => expect(latest).toHaveLength(3));
    expect(latest[2]!.type).toBe('heading');
    expect((latest[2]!.props as { title: string }).title).toBe('First');
    expect(latest[2]!.id).not.toBe('a1');
  });

  it('pastes above a block from its own menu', async () => {
    localStorage.setItem(CLIPBOARD_KEY, JSON.stringify({ kind: 'he-blocks', version: 1, copiedAt: '', blocks: [heading('x', 'Pasted')] }));
    render(<Harness initial={[heading('a1', 'First')]} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'More actions' })[0]!);
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Paste above' }));
    await waitFor(() => expect(latest.map((b) => (b.props as { title: string }).title)).toEqual(['Pasted', 'First']));
  });

  it('refuses to paste something that is no longer a valid block', async () => {
    localStorage.setItem(CLIPBOARD_KEY, JSON.stringify({ kind: 'he-blocks', version: 1, copiedAt: '', blocks: [{ id: 'x', type: 'nonsense', props: {} }] }));
    render(<Harness initial={[]} />);
    fireEvent.click(await screen.findByRole('button', { name: /^Paste/ }));
    expect(latest).toHaveLength(0);
  });
});

describe('a synced saved block', () => {
  it('shows a locked card, and Detach swaps it for its own copy of the saved tree', async () => {
    render(<Harness initial={[{ id: 'ref', type: 'savedBlock', props: { savedBlockId: SAVED_ID, name: 'Shared heading' } } as AnyBlock]} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Expand' })[0]!);
    expect(screen.getByText(/synced\. Its content is edited in one place/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Detach' }));
    await waitFor(() => expect(latest[0]!.type).toBe('heading'));
    expect((latest[0]!.props as { title: string }).title).toBe('From the saved block');
    expect(latest[0]!.id).not.toBe('saved-h');
  });

  it('offers "Save as a saved block" to a role that may make one', () => {
    render(<Harness initial={[heading('a1', 'First')]} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'More actions' })[0]!);
    expect(screen.getByRole('menuitem', { name: 'Save as a saved block…' })).toBeTruthy();
  });
});
