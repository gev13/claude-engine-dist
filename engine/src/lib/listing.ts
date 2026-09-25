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
  /** `postList` pages posts; `projects` (2.14) pages a projects collection. */
  type?: 'postList' | 'projects';
  kind: 'article' | 'research' | 'all';
  categorySlug?: string;
  /** Items per page. */
  limit: number;
  /** A projects collection's own filters. */
  projects?: { categories: string[]; tags: string[]; featuredOnly: boolean };
};

const strings = (value: unknown) => (Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []);

/** The first post list that pages on the server, anywhere in the tree (rows included). */
export function findServerList(blocks: AnyBlock[] | null | undefined): ServerList | undefined {
  for (const block of blocks ?? []) {
    if (!block || (block as { style?: { disabled?: boolean } }).style?.disabled) continue;
    if (block.type === 'postList') {
      const props = (block.props ?? {}) as Record<string, unknown>;
      if (props.pagination === 'server') {
        return {
          blockId: block.id,
          type: 'postList',
          kind: props.kind === 'article' || props.kind === 'research' ? props.kind : 'all',
          categorySlug: typeof props.categorySlug === 'string' && props.categorySlug ? props.categorySlug : undefined,
          limit: typeof props.limit === 'number' && props.limit > 0 ? Math.min(props.limit, 48) : 9,
        };
      }
    }
    if (block.type === 'projects') {
      const props = (block.props ?? {}) as Record<string, unknown>;
      if (props.source === 'collection' && props.pagination === 'pages') {
        return {
          blockId: block.id,
          type: 'projects',
          kind: 'all',
          limit: typeof props.limit === 'number' && props.limit > 0 ? Math.min(props.limit, 100) : 12,
          projects: { categories: strings(props.categories), tags: strings(props.tags), featuredOnly: props.featuredOnly === true },
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
    const props = (block?.props ?? {}) as Record<string, unknown>;
    if (block?.type === 'postList' && props.pagination === 'server') count++;
    if (block?.type === 'projects' && props.source === 'collection' && props.pagination === 'pages') count++;
    if (block?.type === 'row') {
      for (const column of ((block.props ?? {}) as { columns?: { blocks?: AnyBlock[] }[] }).columns ?? []) {
        count += countServerLists(column.blocks);
      }
    }
  }
  return count;
}
