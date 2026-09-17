import { describe, expect, it } from 'vitest';
import { flattenBlocks, sampleBlock } from '@/content/demo/samples';
import { blockSchemas, parseBlocks } from '@/lib/blocks';
import { demoLibraryPages } from '@/content/demo/pages';

/* ═══════════════════════════════════════════════════════════════════════════
   The Design panel's spacing probe
   ───────────────────────────────────────────────────────────────────────────
   The panel tells an editor what padding a block already has by rendering one
   and measuring it, rather than by consulting a table — there are 63 block
   types and 48 separate `padding-block` rules, and a table of those numbers
   would go out of date silently, which is worse than saying nothing.

   What can break quietly is the sample: a block type the demo content does
   not use has nothing to render, so the hint disappears for that type alone
   and nobody notices. That is what this pins.
   ═══════════════════════════════════════════════════════════════════════════ */

const types = Object.keys(blockSchemas);

describe('a sample for every block', () => {
  it('finds one for each type in the schema', () => {
    for (const type of types) expect(sampleBlock(type), type).not.toBeNull();
  });

  /* A sample that fails its own schema is dropped by the renderer, so the
     probe would serve an empty page and measure nothing. */
  it('is a block that actually parses', () => {
    for (const type of types) {
      const sample = sampleBlock(type)!;
      expect(parseBlocks([sample]), type).toHaveLength(1);
    }
  });

  it('is of the type that was asked for', () => {
    for (const type of types) expect(sampleBlock(type)!.type, type).toBe(type);
  });

  it('has nothing for a type that does not exist', () => {
    expect(sampleBlock('notABlock')).toBeNull();
  });
});

describe('finding blocks inside rows', () => {
  it('reaches blocks nested in a row’s columns', () => {
    const row = demoLibraryPages.flatMap((p) => p.blocks).find((b) => b.type === 'row');
    expect(row, 'the library should contain a row').toBeTruthy();
    // The row itself plus whatever its columns hold.
    expect(flattenBlocks([row!]).length).toBeGreaterThan(1);
  });

  it('counts the row as a block too — a row has a band of its own', () => {
    const row = demoLibraryPages.flatMap((p) => p.blocks).find((b) => b.type === 'row')!;
    expect(flattenBlocks([row])[0]!.type).toBe('row');
  });
});
