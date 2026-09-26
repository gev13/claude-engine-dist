import { describe, expect, it } from 'vitest';
import { type SavedBlockSummary, repeatedUniqueParts } from '@/components/admin/SavedBlocksTools';
import type { AnyBlock } from '@/lib/blocks';
import { SAVED_BLOCK_TYPE } from '@/lib/blockTree';

/* 3.4.3 — the builder counts synced blocks through rows only. A card grid's
   `columns: 3` is a number, and reading it as a list of columns stopped the
   builder for any page that set one ("number 3 is not iterable"). */

const block = (id: string, type: string, props: Record<string, unknown>) => ({ id, type, props }) as unknown as AnyBlock;
const synced = (id: string) => block(id, SAVED_BLOCK_TYPE, { savedBlockId: 'sb1' });
const byId = new Map<string, SavedBlockSummary>([
  ['sb1', { id: 'sb1', name: 'Enquiry form', description: '', category: '', mode: 'synced', tree: [block('f', 'form', { formName: 'x', fields: [] })] } as unknown as SavedBlockSummary],
]);

describe('counting synced blocks on a page', () => {
  it('passes over blocks whose columns are a number', () => {
    const tree = [block('g', 'cardGrid', { columns: 3, cards: [] }), block('p', 'postList', { columns: 3, limit: 3 })];
    expect(() => repeatedUniqueParts(tree, byId)).not.toThrow();
    expect(repeatedUniqueParts(tree, byId)).toEqual([]);
  });

  it('still finds a synced block used twice, inside a row too', () => {
    const tree = [
      block('g', 'cardGrid', { columns: 2, cards: [] }),
      synced('a'),
      block('r', 'row', { columns: [{ id: 'c', blocks: [synced('b')] }] }),
    ];
    expect(repeatedUniqueParts(tree, byId)).toEqual(['Enquiry form']);
  });
});
