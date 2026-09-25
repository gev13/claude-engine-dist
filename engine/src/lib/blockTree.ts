import type { AnyBlock } from './blocks';

/* ═══════════════════════════════════════════════════════════════════════════
   Walking and copying block trees (2.15)
   ───────────────────────────────────────────────────────────────────────────
   A tree is a list of blocks; a `row` holds columns, and each column holds a
   list of blocks — three rows deep at most. Everything that copies a tree
   (duplicate a page, paste a block, insert a saved template, detach a synced
   block) goes through `freshIds`, so a copy never shares an id with what it
   came from. Shared ids are not cosmetic: a block id scopes its CSS
   (`.he-b-<id>`) and a form id identifies which form a submission came from.

   Pure, and imports only types, so the builder in the browser and the API on
   the server run the same code.
   ═══════════════════════════════════════════════════════════════════════════ */

type Column = { id?: string; blocks?: AnyBlock[] } & Record<string, unknown>;

const columnsOf = (block: AnyBlock): Column[] | null =>
  block.type === 'row' && Array.isArray((block.props as { columns?: unknown })?.columns)
    ? ((block.props as { columns: Column[] }).columns)
    : null;

/** Visit every block in a tree, rows' columns included, depth first. */
export function walkBlocks(blocks: readonly AnyBlock[] | null | undefined, visit: (block: AnyBlock) => void): void {
  for (const block of blocks ?? []) {
    if (!block) continue;
    visit(block);
    for (const column of columnsOf(block) ?? []) walkBlocks(column.blocks, visit);
  }
}

/** Rebuild a tree bottom-up: `map` sees each block after its columns have been rebuilt. */
export function mapBlocks(blocks: readonly AnyBlock[], map: (block: AnyBlock) => AnyBlock | AnyBlock[] | null): AnyBlock[] {
  const out: AnyBlock[] = [];
  for (const block of blocks) {
    if (!block) continue;
    const columns = columnsOf(block);
    const rebuilt: AnyBlock = columns
      ? { ...block, props: { ...block.props, columns: columns.map((column) => ({ ...column, blocks: mapBlocks(column.blocks ?? [], map) })) } }
      : block;
    const mapped = map(rebuilt);
    if (Array.isArray(mapped)) out.push(...mapped);
    else if (mapped) out.push(mapped);
  }
  return out;
}

/**
 * A deep copy with a new id for every block and every row column.
 *
 * `renameForms` appends " (copy)" to each form's name, so submissions to a
 * duplicated page's form are filed separately from the original's in the
 * inbox (T7). Paste and saved-template inserts leave names alone.
 */
export function freshIds(
  blocks: readonly AnyBlock[],
  makeId: () => string,
  opts: { renameForms?: boolean } = {},
): AnyBlock[] {
  return blocks.map((block) => {
    const props = structuredClone(block.props ?? {}) as Record<string, unknown>;
    const columns = columnsOf(block);
    if (columns) {
      props.columns = columns.map((column) => ({
        ...structuredClone(column),
        id: makeId(),
        blocks: freshIds(column.blocks ?? [], makeId, opts),
      }));
    }
    if (opts.renameForms && block.type === 'form' && typeof props.formName === 'string') {
      props.formName = `${props.formName} (copy)`.slice(0, 120);
    }
    return {
      ...block,
      id: makeId(),
      props,
      ...(block.style ? { style: structuredClone(block.style) } : {}),
    } as AnyBlock;
  });
}

/* ── Saved blocks ────────────────────────────────────────────────────────── */

export const SAVED_BLOCK_TYPE = 'savedBlock';

/** How deep synced blocks may nest inside one another. */
export const MAX_SAVED_DEPTH = 3;

/** The saved blocks a tree refers to, each once. */
export function savedBlockRefs(blocks: readonly AnyBlock[] | null | undefined): string[] {
  const ids = new Set<string>();
  walkBlocks(blocks, (block) => {
    const id = (block.props as { savedBlockId?: unknown })?.savedBlockId;
    if (block.type === SAVED_BLOCK_TYPE && typeof id === 'string') ids.add(id);
  });
  return [...ids];
}

/**
 * Whether saving `tree` as saved block `id` would make it contain itself —
 * directly, or through another saved block — or nest deeper than allowed.
 * `lookup` returns another saved block's tree.
 */
export function savedBlockCycle(
  id: string | null,
  tree: readonly AnyBlock[],
  lookup: (id: string) => readonly AnyBlock[] | undefined,
): string | null {
  const visit = (blocks: readonly AnyBlock[], path: string[], depth: number): string | null => {
    for (const ref of savedBlockRefs(blocks)) {
      if (ref === id || path.includes(ref)) return 'A saved block cannot contain itself, directly or through another.';
      if (depth >= MAX_SAVED_DEPTH) return `Saved blocks can sit inside one another only ${MAX_SAVED_DEPTH} deep.`;
      const inner = lookup(ref);
      if (inner) {
        const problem = visit(inner, [...path, ref], depth + 1);
        if (problem) return problem;
      }
    }
    return null;
  };
  return visit(tree, id ? [id] : [], 1);
}

/** Every reference to one saved block replaced by a fresh copy of its tree — "Detach". */
export function detachSavedBlock(
  blocks: readonly AnyBlock[],
  savedBlockId: string,
  tree: readonly AnyBlock[],
  makeId: () => string,
): AnyBlock[] {
  return mapBlocks(blocks, (block) =>
    block.type === SAVED_BLOCK_TYPE && (block.props as { savedBlockId?: string })?.savedBlockId === savedBlockId
      ? freshIds(tree, makeId)
      : block,
  );
}

/** Whether a tree carries something a page may hold only once: a form, or an anchor id. */
export function hasUniqueParts(blocks: readonly AnyBlock[]): boolean {
  let found = false;
  walkBlocks(blocks, (block) => {
    if (block.type === 'form' || (block as { style?: { anchorId?: string } }).style?.anchorId) found = true;
  });
  return found;
}

/* ── The clipboard (T9) ──────────────────────────────────────────────────── */

export const CLIPBOARD_KEY = 'he-block-clipboard';

/** What a copied block is stored as — marked, so paste can tell it from anything else in storage. */
export type ClipboardPayload = { kind: 'he-blocks'; version: 1; copiedAt: string; blocks: AnyBlock[] };

export function toClipboard(blocks: AnyBlock[]): string {
  const payload: ClipboardPayload = { kind: 'he-blocks', version: 1, copiedAt: new Date().toISOString(), blocks };
  return JSON.stringify(payload);
}

/** The blocks on the clipboard, or null when it holds anything else. Validation of each block is the caller's. */
export function fromClipboard(text: string | null): AnyBlock[] | null {
  if (!text) return null;
  try {
    const value = JSON.parse(text) as Partial<ClipboardPayload>;
    if (value?.kind !== 'he-blocks' || value.version !== 1 || !Array.isArray(value.blocks)) return null;
    return value.blocks.filter((block): block is AnyBlock => Boolean(block) && typeof block === 'object' && typeof block.type === 'string');
  } catch {
    return null;
  }
}
