import { type AnyBlock } from '@/lib/blocks';
import { demoLibraryPages } from './pages';

/* ═══════════════════════════════════════════════════════════════════════════
   One real instance of each block type
   ───────────────────────────────────────────────────────────────────────────
   The Design panel measures a block's own spacing by rendering one and asking
   the browser. Rendering one means having one, and the block library's demo
   content already holds every type — `tests/demo-content.test.ts` fails the
   build when a type is missing from it, so this borrows a guarantee that is
   already enforced rather than adding a second list to keep in step.

   It is content, not configuration: nothing here is shown to a visitor, and a
   block whose sample is missing costs a hint, never a page.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Every block in a tree, including those nested in a row's columns. */
export function flattenBlocks(blocks: AnyBlock[]): AnyBlock[] {
  return blocks.flatMap((block) => {
    if (block.type !== 'row') return [block];
    const columns = (block.props as { columns?: { blocks?: AnyBlock[] }[] }).columns ?? [];
    return [block, ...flattenBlocks(columns.flatMap((column) => column.blocks ?? []))];
  });
}

/** The first demo instance of this block type, or nothing. */
export function sampleBlock(type: string): AnyBlock | null {
  for (const page of demoLibraryPages) {
    const found = flattenBlocks(page.blocks).find((block) => block.type === type);
    if (found) return found;
  }
  return null;
}
