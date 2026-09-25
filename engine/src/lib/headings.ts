import type { AnyBlock } from './blocks';

/* Every page needs exactly one h1: it is what tells a reader and a search
   engine what the page is about, and the smoke suite asserts it. These two
   are shared by the builder (which warns before a save) and the post view
   (2.13), which demotes a post's own title when its blocks open with one. */

/** The same block, set to render its title as an h2 wherever it would have been the page's h1. */
export function withoutHeadingOne(block: AnyBlock): AnyBlock {
  const props = (block.props ?? {}) as Record<string, unknown>;
  if (block.type === 'row') {
    const columns = (props.columns ?? []) as { blocks?: AnyBlock[] }[];
    return { ...block, props: { ...props, columns: columns.map((column) => ({ ...column, blocks: (column.blocks ?? []).map(withoutHeadingOne) })) } };
  }
  const as = typeof props.titleAs === 'string' ? props.titleAs : block.type === 'hero' ? 'h1' : '';
  return as === 'h1' ? { ...block, props: { ...props, titleAs: 'h2' } } : block;
}

export function countHeadingOnes(blocks: AnyBlock[]): number {
  let total = 0;

  for (const block of blocks) {
    const props = (block.props ?? {}) as Record<string, unknown>;

    if (block.type === 'row') {
      const columns = (props.columns ?? []) as { blocks?: AnyBlock[] }[];
      for (const column of columns) total += countHeadingOnes(column.blocks ?? []);
      continue;
    }

    // A full-screen slider and stacked panels put `titleAs` on their first
    // slide or panel rather than on a section heading.
    if (block.type === 'stackedPanels' || (block.type === 'carousel' && props.mode === 'hero')) {
      const first = ((props.panels ?? props.slides ?? []) as { title?: string }[])[0];
      if (first?.title && props.titleAs === 'h1') total += 1;
      continue;
    }

    if (!props.title) continue;
    const as = typeof props.titleAs === 'string' ? props.titleAs : block.type === 'hero' ? 'h1' : '';
    if (as === 'h1') total += 1;
  }

  return total;
}

