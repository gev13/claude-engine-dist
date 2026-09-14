import { describe, expect, it } from 'vitest';
import { collectInvalidBlocks, parseBlock, type AnyBlock, type ParsedRowProps } from '@/lib/blocks';
import { rowToCss } from '@/lib/blockStyle-css';

const row = (overrides: Record<string, unknown> = {}): AnyBlock => ({
  id: 'row1',
  type: 'row',
  props: {
    columns: [
      { id: 'colA', width: { base: 9, mobile: 12 }, blocks: [{ id: 'kid1', type: 'cta', props: { title: 'Left' } }] },
      { id: 'colB', width: { base: 3, mobile: 12 }, blocks: [{ id: 'kid2', type: 'image', props: { url: '/a.png' } }] },
    ],
    ...overrides,
  },
});

describe('row parsing', () => {
  it('parses the blocks inside each column', () => {
    const parsed = parseBlock(row());
    const props = parsed?.props as ParsedRowProps;
    expect(props.columns).toHaveLength(2);
    expect(props.columns[0]!.blocks[0]!.type).toBe('cta');
    expect(props.columns[1]!.blocks[0]!.type).toBe('image');
  });

  /* Nesting stops at one level. The schema cannot say "anything but a row"
     without becoming recursive, so the rule lives in the parser. */
  it('drops a row nested inside a column', () => {
    const nested = row({
      columns: [{ id: 'colA', width: { base: 12 }, blocks: [row()] }],
    });
    const props = parseBlock(nested)?.props as ParsedRowProps;
    expect(props.columns[0]!.blocks).toHaveLength(0);
  });

  it('drops a child that is invalid for its type but keeps the rest', () => {
    const mixed = row({
      columns: [
        {
          id: 'colA',
          width: { base: 12 },
          blocks: [
            { id: 'good1', type: 'cta', props: { title: 'Fine' } },
            { id: 'bad1', type: 'cta', props: {} },
            { id: 'good2', type: 'cta', props: { title: 'Also fine' } },
          ],
        },
      ],
    });
    const props = parseBlock(mixed)?.props as ParsedRowProps;
    expect(props.columns[0]!.blocks.map((b) => b.id)).toEqual(['good1', 'good2']);
  });

  it('rejects a column id that could not be used in a selector', () => {
    expect(parseBlock(row({ columns: [{ id: 'a}b', width: { base: 12 }, blocks: [] }] }))).toBeNull();
  });

  it('requires between one and six columns', () => {
    expect(parseBlock(row({ columns: [] }))).toBeNull();
    expect(
      parseBlock(row({ columns: Array.from({ length: 7 }, (_, i) => ({ id: `c${i}`, width: { base: 1 }, blocks: [] })) })),
    ).toBeNull();
  });
});

describe('reporting invalid blocks', () => {
  it('names a broken block inside a column, not just the row', () => {
    const problems = collectInvalidBlocks([
      row({ columns: [{ id: 'colA', width: { base: 12 }, blocks: [{ id: 'bad1', type: 'cta', props: {} }] }] }),
    ]);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('column 1');
    expect(problems[0]).toContain('cta');
  });

  it('says nothing about a page that is fine', () => {
    expect(collectInvalidBlocks([row()])).toEqual([]);
  });
});

describe('row CSS', () => {
  it('makes one track per column, sized in twelfths', () => {
    const css = rowToCss({
      id: 'row1',
      align: 'stretch',
      gap: '32px',
      columns: [
        { id: 'colA', width: { base: 9, mobile: 12 } },
        { id: 'colB', width: { base: 3, mobile: 12 } },
      ],
    });
    // minmax(0,Nfr), not Nfr: a plain fr track refuses to shrink below its
    // content, so one long string would widen the whole page.
    expect(css).toContain('grid-template-columns:minmax(0,9fr) minmax(0,3fr)');
    expect(css).toContain('gap:32px');
  });

  /* The original implementation used a fixed twelve-track grid. Twelve tracks
     carry eleven gaps, so a row with a 48px gap had a minimum width of 528px
     and overflowed every phone regardless of what the spans said. */
  it('never carries more gaps than it has column boundaries', () => {
    const css = rowToCss({
      id: 'row1',
      gap: '48px',
      columns: [
        { id: 'a', width: { base: 9, mobile: 12 } },
        { id: 'b', width: { base: 3, mobile: 12 } },
      ],
    });
    expect(css).not.toContain('repeat(12');
    const tracks = /grid-template-columns:([^;}]+)/.exec(css)![1]!;
    expect(tracks.split('minmax').length - 1).toBe(2);
  });

  it('collapses to a single track once every column is full width', () => {
    const css = rowToCss({
      id: 'row1',
      gap: '48px',
      columns: [
        { id: 'a', width: { base: 9, mobile: 12 } },
        { id: 'b', width: { base: 3, mobile: 12 } },
      ],
    });
    expect(css).toContain('@media (max-width:768px){.he-r-row1{grid-template-columns:minmax(0,1fr)}}');
  });

  it('does not repeat a breakpoint whose tracks are unchanged', () => {
    const css = rowToCss({ id: 'row1', columns: [{ id: 'a', width: { base: 6 } }, { id: 'b', width: { base: 6 } }] });
    expect(css).not.toContain('@media');
  });

  it('reverses the stack on mobile when asked', () => {
    const css = rowToCss({ id: 'row1', reverseOnMobile: true, columns: [{ id: 'c1', width: { base: 12 } }] });
    expect(css).toContain('display:flex;flex-direction:column-reverse');
  });

  /* `align-items` means vertical on the grid and horizontal on a flex column.
     Carrying the editor's choice across the switch collapsed every stacked
     column to the width of its own content. */
  it('resets alignment when the grid becomes a flex column', () => {
    const css = rowToCss({
      id: 'row1',
      align: 'center',
      reverseOnMobile: true,
      columns: [{ id: 'c1', width: { base: 6 } }],
    });
    expect(css).toContain('align-items:center');
    expect(css).toContain('flex-direction:column-reverse;align-items:stretch');
  });

  it('applies a column its own design options', () => {
    const css = rowToCss({
      id: 'row1',
      columns: [{ id: 'c1', width: { base: 12 }, style: { spacing: { base: { paddingTop: '20px' } } } }],
    });
    expect(css).toContain('.he-c-c1{padding-top:20px}');
  });

  it('refuses an unsafe row id', () => {
    expect(rowToCss({ id: 'a}b', columns: [] })).toBe('');
  });
});

describe('parallax', () => {
  it('falls back where a fixed background does not belong', () => {
    const parsed = parseBlock({
      id: 'row1',
      type: 'row',
      props: { columns: [{ id: 'c1', width: { base: 12 }, blocks: [] }] },
      style: { background: { imageUrl: '/bg.jpg', attachment: 'fixed' } },
    });
    expect(parsed?.style?.background?.attachment).toBe('fixed');
  });
});

describe('spacer', () => {
  it('validates its heights like every other CSS value', () => {
    expect(parseBlock({ id: 's1', type: 'spacer', props: { height: '80px' } })).not.toBeNull();
    expect(parseBlock({ id: 's1', type: 'spacer', props: { height: '80px;background:red' } })).toBeNull();
    expect(parseBlock({ id: 's1', type: 'spacer', props: { height: 'calc(100% - 2px)' } })).toBeNull();
  });

  it('defaults to a plain 48px gap', () => {
    const parsed = parseBlock({ id: 's1', type: 'spacer', props: {} });
    expect(parsed?.props).toMatchObject({ height: '48px', line: 'none' });
  });

  it('is allowed inside a column, unlike a row', () => {
    const parsed = parseBlock({
      id: 'r1',
      type: 'row',
      props: {
        columns: [{ id: 'c1', width: { base: 12 }, blocks: [{ id: 's1', type: 'spacer', props: {} }] }],
      },
    });
    const props = parsed?.props as ParsedRowProps;
    expect(props.columns[0]!.blocks[0]!.type).toBe('spacer');
  });
});

describe('hidden columns', () => {
  /* `display:none` takes a column out of the grid's flow but leaves its track
     in the template, so the remaining columns kept their old share and the
     rest of the row rendered blank. */
  it('drops a hidden column’s track at that breakpoint', () => {
    const css = rowToCss({
      id: 'r1',
      gap: '64px',
      columns: [
        { id: 'text', width: { base: 8 } },
        { id: 'fig', width: { base: 4 }, style: { hideOn: ['tablet', 'mobile'] } },
      ],
    });
    expect(css).toContain('.he-r-r1{display:grid;grid-template-columns:minmax(0,8fr) minmax(0,4fr)');
    // One track is left. A lone `fr` track absorbs all free space whatever its
    // number, so 8fr here fills the row exactly as 1fr would.
    expect(css).toContain('@media (max-width:1024px){.he-r-r1{grid-template-columns:minmax(0,8fr)}}');
  });

  it('keeps every track while all columns are visible', () => {
    const css = rowToCss({
      id: 'r1',
      columns: [
        { id: 'a', width: { base: 8 } },
        { id: 'b', width: { base: 4 } },
      ],
    });
    expect(css).not.toContain('@media');
  });
});
