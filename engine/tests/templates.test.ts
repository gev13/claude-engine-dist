import { describe, expect, it } from 'vitest';
import { DEMO_ANIMATIONS } from '../src/content/demo/animations';
import { DEMO_IMAGES } from '../src/content/demo/images';
import { PAGE_TEMPLATES, SECTION_TEMPLATES, instantiate } from '../src/content/templates';
import { type AnyBlock, parseBlocks } from '../src/lib/blocks';

type Loose = { id: string; type: string; props: Record<string, unknown> };

const counter = () => {
  let n = 0;
  return () => `t-${++n}`;
};

function flatten(blocks: readonly AnyBlock[]): Loose[] {
  return (blocks as unknown as Loose[]).flatMap((block) =>
    block.type === 'row' ? [block, ...((block.props.columns as { blocks: AnyBlock[] }[]) ?? []).flatMap((c) => flatten(c.blocks))] : [block],
  );
}

/** Mirrors the builder's count: which blocks put out an h1. */
function headingOnes(blocks: readonly AnyBlock[]): number {
  return flatten(blocks).filter((b) => {
    if (!b.props.title && b.type !== 'carousel' && b.type !== 'stackedPanels') return false;
    if (b.type === 'hero') return (b.props.titleAs ?? 'h1') === 'h1';
    return b.props.titleAs === 'h1';
  }).length;
}

function losesNothing(blocks: AnyBlock[], label: string) {
  expect(parseBlocks(blocks).length, label).toBe(blocks.length);
  for (const row of flatten(blocks).filter((b) => b.type === 'row')) {
    for (const column of row.props.columns as { blocks: AnyBlock[] }[]) {
      expect(parseBlocks(column.blocks).length, `${label} row`).toBe(column.blocks.length);
    }
  }
}

const knownMedia = new Set([
  ...DEMO_IMAGES.map((i) => `/media/demo/${i.name}.${i.format}`),
  ...DEMO_ANIMATIONS.map((a) => `/media/demo/${a.name}.json`),
]);

describe('page templates', () => {
  it('are twelve, with unique ids and names', () => {
    expect(PAGE_TEMPLATES).toHaveLength(12);
    expect(new Set(PAGE_TEMPLATES.map((t) => t.id)).size).toBe(12);
    expect(new Set(PAGE_TEMPLATES.map((t) => t.name)).size).toBe(12);
    for (const t of PAGE_TEMPLATES) expect(t.id).toMatch(/^[a-z0-9-]+$/);
  });

  it('lose no block to validation, at the top level or inside rows', () => {
    for (const t of PAGE_TEMPLATES) losesNothing(instantiate(t.blocks, counter()), t.id);
  });

  it('each render exactly one h1', () => {
    for (const t of PAGE_TEMPLATES) expect(headingOnes(instantiate(t.blocks, counter())), t.id).toBe(1);
  });

  it('only use pictures the engine can draw', () => {
    for (const t of PAGE_TEMPLATES) {
      const used = JSON.stringify(t).match(/\/media\/[^"\s]+/g) ?? [];
      for (const url of used) expect(knownMedia, `${t.id}: ${url}`).toContain(url);
    }
  });

  it('start a page with a title and an excerpt that fit the page form', () => {
    for (const t of PAGE_TEMPLATES) {
      expect(t.page.title.length, t.id).toBeGreaterThan(0);
      expect(t.page.title.length, t.id).toBeLessThanOrEqual(300);
      expect(t.page.excerpt.length, t.id).toBeLessThanOrEqual(2000);
    }
  });
});

describe('ready sections', () => {
  it('have unique ids and a group', () => {
    expect(new Set(SECTION_TEMPLATES.map((s) => s.id)).size).toBe(SECTION_TEMPLATES.length);
    for (const s of SECTION_TEMPLATES) expect(s.group, s.id).not.toBe('');
  });

  it('lose no block to validation and bring at most one h1', () => {
    for (const s of SECTION_TEMPLATES) {
      const blocks = instantiate(s.blocks, counter());
      losesNothing(blocks, s.id);
      expect(headingOnes(blocks), s.id).toBeLessThanOrEqual(1);
      for (const url of JSON.stringify(s).match(/\/media\/[^"\s]+/g) ?? []) expect(knownMedia, `${s.id}: ${url}`).toContain(url);
    }
  });
});

describe('instantiate', () => {
  it('gives every block and row column a fresh id and leaves the template alone', () => {
    const clinic = PAGE_TEMPLATES.find((t) => t.id === 'clinic')!;
    const before = JSON.stringify(clinic.blocks);
    const first = instantiate(clinic.blocks, counter());
    let n = 1000;
    const second = instantiate(clinic.blocks, () => `u-${++n}`);

    const ids = (blocks: AnyBlock[]) => {
      const out: string[] = [];
      for (const block of flatten(blocks)) {
        out.push(block.id);
        if (block.type === 'row') for (const column of block.props.columns as { id: string }[]) out.push(column.id);
      }
      return out;
    };
    expect(new Set(ids(first)).size).toBe(ids(first).length);
    expect(ids(first).some((id) => ids(second).includes(id))).toBe(false);
    expect(JSON.stringify(clinic.blocks)).toBe(before);
  });
});
