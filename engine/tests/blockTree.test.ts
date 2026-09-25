import { describe, expect, it } from 'vitest';
import type { AnyBlock } from '../src/lib/blocks';
import { blockSchemas, parseBlock } from '../src/lib/blocks';
import {
  SAVED_BLOCK_TYPE,
  detachSavedBlock,
  freshIds,
  fromClipboard,
  hasUniqueParts,
  savedBlockCycle,
  savedBlockRefs,
  toClipboard,
  walkBlocks,
} from '../src/lib/blockTree';

/* 2.15 — copying block trees (duplicate, paste, templates, detach) and the
   rules synced saved blocks live by. */

let n = 0;
const makeId = () => `id${++n}`;

const row = (id: string, children: AnyBlock[]): AnyBlock =>
  ({ id, type: 'row', props: { columns: [{ id: `${id}-c`, width: { base: 12 }, blocks: children }] } }) as AnyBlock;
const heading = (id: string): AnyBlock => ({ id, type: 'heading', props: { title: id } }) as AnyBlock;
const form = (id: string): AnyBlock => ({ id, type: 'form', props: { formName: 'Contact', fields: [] } }) as AnyBlock;
const ref = (id: string, savedBlockId: string): AnyBlock => ({ id, type: SAVED_BLOCK_TYPE, props: { savedBlockId } }) as AnyBlock;

const ids = (blocks: AnyBlock[]) => {
  const out: string[] = [];
  walkBlocks(blocks, (block) => out.push(block.id));
  return out;
};

describe('a copy shares no id with its original', () => {
  it('gives every block and every row column a new id, all the way down', () => {
    const original = [row('r1', [heading('h1'), row('r2', [heading('h2')])])];
    const copy = freshIds(original, makeId);
    const before = new Set([...ids(original), 'r1-c', 'r2-c']);
    for (const id of ids(copy)) expect(before.has(id), id).toBe(false);
    const columnIds = [
      (copy[0]!.props as { columns: { id: string }[] }).columns[0]!.id,
      ((((copy[0]!.props as { columns: { blocks: AnyBlock[] }[] }).columns[0]!.blocks[1]!).props) as { columns: { id: string }[] }).columns[0]!.id,
    ];
    for (const id of columnIds) expect(before.has(id), id).toBe(false);
  });

  it('leaves the original untouched', () => {
    const original = [heading('h1')];
    const copy = freshIds(original, makeId);
    (copy[0]!.props as { title: string }).title = 'changed';
    expect((original[0]!.props as { title: string }).title).toBe('h1');
  });

  it('renames forms only when duplicating a page, so its submissions are filed apart', () => {
    expect((freshIds([form('f')], makeId, { renameForms: true })[0]!.props as { formName: string }).formName).toBe('Contact (copy)');
    expect((freshIds([form('f')], makeId)[0]!.props as { formName: string }).formName).toBe('Contact');
  });
});

describe('synced saved blocks', () => {
  it('parse as a block that holds only the reference', () => {
    expect(parseBlock({ id: 'x', type: 'savedBlock', props: { savedBlockId: '5a7ed0b1-0c7a-4000-8000-00000000d3a0' } })).not.toBeNull();
    expect(blockSchemas.savedBlock.safeParse({ savedBlockId: 'not-a-uuid' }).success).toBe(false);
  });

  it('are found in rows too', () => {
    expect(savedBlockRefs([heading('a'), row('r', [ref('b', 'S1')]), ref('c', 'S1'), ref('d', 'S2')])).toEqual(['S1', 'S2']);
  });

  it('may not contain themselves, directly or through another', () => {
    const trees: Record<string, AnyBlock[]> = { A: [ref('x', 'B')], B: [ref('y', 'A')] };
    expect(savedBlockCycle('A', [ref('z', 'A')], (id) => trees[id])).toMatch(/itself/);
    expect(savedBlockCycle('A', [ref('z', 'B')], (id) => trees[id])).toMatch(/itself/);
    expect(savedBlockCycle(null, [heading('h')], (id) => trees[id])).toBeNull();
  });

  // Counting the saved block being written: A holding D holding E is three; A → B → C → D is four.
  it('nest at most three deep, which is also where the renderer stops', () => {
    const trees: Record<string, AnyBlock[]> = { B: [ref('1', 'C')], C: [ref('2', 'D')], D: [ref('3', 'E')], E: [heading('e')] };
    expect(savedBlockCycle('A', [ref('0', 'B')], (id) => trees[id])).toMatch(/3 deep/);
    expect(savedBlockCycle('A', [ref('0', 'D')], (id) => trees[id])).toBeNull();
  });

  it('detach into an independent copy, and only that one', () => {
    const tree = [heading('saved-h')];
    const page = [ref('r1', 'S1'), ref('r2', 'S2'), row('row', [ref('r3', 'S1')])];
    const out = detachSavedBlock(page, 'S1', tree, makeId);
    expect(savedBlockRefs(out)).toEqual(['S2']);
    expect(ids(out).filter((id) => id === 'saved-h')).toEqual([]);
    expect(out.filter((block) => block.type === 'heading')).toHaveLength(1);
  });

  it('know when a tree holds something a page may hold once', () => {
    expect(hasUniqueParts([form('f')])).toBe(true);
    expect(hasUniqueParts([{ ...heading('h'), style: { anchorId: 'pricing' } } as AnyBlock])).toBe(true);
    expect(hasUniqueParts([heading('h')])).toBe(false);
  });
});

describe('the clipboard', () => {
  it('round-trips blocks, marked as ours', () => {
    const text = toClipboard([heading('h')]);
    expect(fromClipboard(text)).toEqual([heading('h')]);
  });

  it('ignores anything that is not a block clipboard', () => {
    for (const text of [null, '', 'hello', '{"blocks":[]}', '{"kind":"he-blocks","version":2,"blocks":[]}', '[1,2]']) {
      expect(fromClipboard(text), String(text)).toBeNull();
    }
  });
});
