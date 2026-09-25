import type { AnyBlock } from './blocks';

/* ═══════════════════════════════════════════════════════════════════════════
   Lists that page on the server
   ───────────────────────────────────────────────────────────────────────────
   A post list set to `pagination: 'server'` pages through real addresses —
   `/news/page/2` — rendered on the server, so every page is in the HTML and
   in the index. One per page: two lists sharing `/page/2` would each be
   asked for their own second page by one address. The first one wins, and
   the builder says so about the rest.
   ═══════════════════════════════════════════════════════════════════════════ */

export type ServerList = {
  blockId: string;
  kind: 'article' | 'research' | 'all';
  categorySlug?: string;
  /** Posts per page. */
  limit: number;
};

/** The first post list that pages on the server, anywhere in the tree (rows included). */
export function findServerList(blocks: AnyBlock[] | null | undefined): ServerList | undefined {
  for (const block of blocks ?? []) {
    if (!block || (block as { style?: { disabled?: boolean } }).style?.disabled) continue;
    if (block.type === 'postList') {
      const props = (block.props ?? {}) as Record<string, unknown>;
      if (props.pagination === 'server') {
        return {
          blockId: block.id,
          kind: props.kind === 'article' || props.kind === 'research' ? props.kind : 'all',
          categorySlug: typeof props.categorySlug === 'string' && props.categorySlug ? props.categorySlug : undefined,
          limit: typeof props.limit === 'number' && props.limit > 0 ? Math.min(props.limit, 48) : 9,
        };
      }
    }
    if (block.type === 'row') {
      for (const column of ((block.props ?? {}) as { columns?: { blocks?: AnyBlock[] }[] }).columns ?? []) {
        const found = findServerList(column.blocks);
        if (found) return found;
      }
    }
  }
  return undefined;
}

/** How many post lists in a tree page on the server — more than one is worth a warning. */
export function countServerLists(blocks: AnyBlock[] | null | undefined): number {
  let count = 0;
  for (const block of blocks ?? []) {
    if (block?.type === 'postList' && (block.props as Record<string, unknown>)?.pagination === 'server') count++;
    if (block?.type === 'row') {
      for (const column of ((block.props ?? {}) as { columns?: { blocks?: AnyBlock[] }[] }).columns ?? []) {
        count += countServerLists(column.blocks);
      }
    }
  }
  return count;
}
