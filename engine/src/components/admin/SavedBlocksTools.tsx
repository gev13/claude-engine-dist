'use client';

import { nanoid } from 'nanoid';
import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { AdminButton, Alert, Field, Input, Select, Textarea } from '@/components/admin/ui';
import { Wireframe } from '@/components/admin/Wireframe';
import { api, fetcher } from '@/lib/admin/client';
import { type AnyBlock, type BlockType, blockLabels, migrateBlock, parseBlock } from '@/lib/blocks';
import { CLIPBOARD_KEY, SAVED_BLOCK_TYPE, freshIds, fromClipboard, hasUniqueParts, toClipboard } from '@/lib/blockTree';
import { BLOCK_WIREFRAMES } from '@/lib/wireframes';

/* ═══════════════════════════════════════════════════════════════════════════
   Saved blocks and the clipboard, in the builder (T8, T9 — 2.15)
   ═══════════════════════════════════════════════════════════════════════════ */

export type SavedBlockSummary = {
  id: string;
  name: string;
  description: string;
  category: string;
  mode: 'synced' | 'template';
  tree: AnyBlock[];
  usage: number;
};

type ListResponse = { items: SavedBlockSummary[]; canWrite: boolean };

/** Every saved block, shared by every builder on the screen through SWR's cache. */
export function useSavedBlocks() {
  const { data, mutate, isLoading } = useSWR<ListResponse>('/api/admin/saved-blocks', fetcher);
  const byId = useMemo(() => new Map((data?.items ?? []).map((item) => [item.id, item])), [data]);
  return { items: data?.items ?? [], canWrite: data?.canWrite ?? false, byId, mutate, isLoading };
}

/** A reference to a synced saved block, as it sits in a page's tree. */
export function savedBlockRef(saved: Pick<SavedBlockSummary, 'id' | 'name'>): AnyBlock {
  return { id: nanoid(10), type: SAVED_BLOCK_TYPE, props: { savedBlockId: saved.id, name: saved.name } } as AnyBlock;
}

/** What inserting a saved block puts into a tree: a reference, or an independent copy. */
export function insertSaved(saved: SavedBlockSummary): AnyBlock[] {
  return saved.mode === 'synced' ? [savedBlockRef(saved)] : freshIds(saved.tree, () => nanoid(10));
}

/**
 * Two instances of one synced block that holds a form or an anchor would put
 * the same form id or the same `#anchor` on a page twice — the second form
 * could not be told apart and the second anchor never reached. Named here so
 * the builder can say so.
 */
export function repeatedUniqueParts(tree: readonly AnyBlock[], byId: Map<string, SavedBlockSummary>): string[] {
  const counts = new Map<string, number>();
  const visit = (blocks: readonly AnyBlock[]) => {
    for (const block of blocks) {
      if (block.type === SAVED_BLOCK_TYPE) {
        const id = (block.props as { savedBlockId?: string }).savedBlockId;
        if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
      }
      for (const column of ((block.props as { columns?: { blocks?: AnyBlock[] }[] })?.columns ?? [])) visit(column.blocks ?? []);
    }
  };
  visit(tree);
  return [...counts]
    .filter(([id, n]) => n > 1 && hasUniqueParts(byId.get(id)?.tree ?? []))
    .map(([id]) => byId.get(id)?.name ?? 'A saved block');
}

/* ── The clipboard ───────────────────────────────────────────────────────── */

/**
 * Copy and paste between pages, posts, projects and saved blocks — through
 * `localStorage`, so it survives moving from one editor to another. A paste
 * is checked block by block against the schemas (after migrating retired
 * types), and gets fresh ids, so the pasted copy is independent.
 */
export function useClipboard() {
  const [held, setHeld] = useState<AnyBlock[] | null>(null);

  useEffect(() => {
    const read = () => {
      try {
        setHeld(fromClipboard(window.localStorage.getItem(CLIPBOARD_KEY)));
      } catch {
        setHeld(null);
      }
    };
    read();
    window.addEventListener('storage', read);
    window.addEventListener('focus', read);
    return () => {
      window.removeEventListener('storage', read);
      window.removeEventListener('focus', read);
    };
  }, []);

  function copy(blocks: AnyBlock[]) {
    try {
      window.localStorage.setItem(CLIPBOARD_KEY, toClipboard(blocks));
      setHeld(blocks);
      return true;
    } catch {
      return false;
    }
  }

  /** The held blocks, checked and with fresh ids — or null if nothing valid is held. */
  function take(): AnyBlock[] | null {
    if (!held?.length) return null;
    const valid = held.map((block) => migrateBlock(block)).filter((block) => parseBlock(block) !== null);
    return valid.length ? freshIds(valid, () => nanoid(10)) : null;
  }

  return { held, copy, take };
}

/* ── Save as a saved block ───────────────────────────────────────────────── */

export function SaveAsDialog({
  blocks,
  onClose,
  onSaved,
}: {
  blocks: AnyBlock[];
  onClose: () => void;
  /** Called with the new saved block; a synced one replaces what it was made from. */
  onSaved: (saved: SavedBlockSummary) => void;
}) {
  const { items, mutate } = useSavedBlocks();
  const categories = useMemo(() => [...new Set(items.map((item) => item.category).filter(Boolean))], [items]);
  const first = blocks[0];
  const [name, setName] = useState(() => (first ? (blockLabels[first.type as BlockType] ?? first.type) : ''));
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [mode, setMode] = useState<'synced' | 'template'>('synced');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');

  async function save() {
    setBusy(true);
    setProblem('');
    try {
      const saved = await api<SavedBlockSummary>('/api/admin/saved-blocks', {
        method: 'POST',
        json: { name, description, category, mode, tree: blocks },
      });
      await mutate();
      onSaved(saved);
    } catch (error) {
      setProblem(error instanceof Error ? error.message : 'It could not be saved.');
      setBusy(false);
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Save as a saved block" className="fixed inset-0 z-50 flex items-center justify-center bg-ink/85 p-4">
      <div className="w-full max-w-[520px] border-2 border-hairline bg-surface p-5">
        <h2 className="m-0 mb-4 font-mono text-[11px] uppercase tracking-[0.12em] text-smoke">Save as a saved block</h2>
        <div className="flex flex-col gap-4">
          {problem && <Alert tone="error">{problem}</Alert>}
          <Field label="Name" htmlFor="sb-name">
            <Input id="sb-name" value={name} maxLength={120} autoFocus onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="What it is for" htmlFor="sb-desc" hint="optional — shown in the picker">
            <Textarea id="sb-desc" rows={2} value={description} maxLength={300} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <Field label="Folder" htmlFor="sb-category" hint="optional — groups it in the picker">
            <Input id="sb-category" value={category} maxLength={60} list="sb-categories" onChange={(e) => setCategory(e.target.value)} />
            <datalist id="sb-categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
          <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
            <legend className="mb-1 font-mono text-[10px] uppercase tracking-[0.12em] text-smoke">How it is used</legend>
            <label className="flex items-start gap-2 text-[14px] text-ash">
              <input type="radio" name="sb-mode" className="mt-1 accent-flare" checked={mode === 'synced'} onChange={() => setMode('synced')} />
              <span>
                <strong className="text-bone">Synced</strong> — every page shows the same block; change it once and it changes
                everywhere. This one becomes a reference to it.
              </span>
            </label>
            <label className="flex items-start gap-2 text-[14px] text-ash">
              <input type="radio" name="sb-mode" className="mt-1 accent-flare" checked={mode === 'template'} onChange={() => setMode('template')} />
              <span>
                <strong className="text-bone">Template</strong> — inserting it pastes an independent copy to edit freely.
              </span>
            </label>
          </fieldset>
          <div className="flex justify-end gap-2">
            <AdminButton type="button" variant="ghost" onClick={onClose}>
              Cancel
            </AdminButton>
            <AdminButton type="button" disabled={busy || !name.trim()} onClick={() => void save()}>
              {busy ? 'Saving…' : 'Save'}
            </AdminButton>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── "My blocks" in the picker ───────────────────────────────────────────── */

export function MyBlocksPicker({ onInsert, excludeId }: { onInsert: (blocks: AnyBlock[]) => void; excludeId?: string }) {
  const { items, isLoading } = useSavedBlocks();
  const [query, setQuery] = useState('');
  const [folder, setFolder] = useState('');
  const folders = useMemo(() => [...new Set(items.map((item) => item.category).filter(Boolean))].sort(), [items]);
  const shown = items.filter(
    (item) =>
      item.id !== excludeId &&
      (!folder || item.category === folder) &&
      (!query.trim() || `${item.name} ${item.description} ${item.category}`.toLowerCase().includes(query.trim().toLowerCase())),
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your saved blocks"
          aria-label="Search saved blocks"
          className="min-w-[200px] flex-1 border-2 border-hairline bg-ink px-3 py-2 text-[14px] text-bone placeholder:text-smoke"
        />
        {folders.length > 0 && (
          <Select value={folder} onChange={(e) => setFolder(e.target.value)} aria-label="Folder" className="w-[180px]">
            <option value="">Every folder</option>
            {folders.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </Select>
        )}
      </div>
      {isLoading ? null : shown.length === 0 ? (
        <p className="m-0 py-6 text-center text-[14px] text-smoke">
          {items.length === 0
            ? 'No saved blocks yet. Open a block’s ⋯ menu and choose “Save as a saved block”.'
            : 'Nothing matches that.'}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((item) => {
            const first = item.tree[0];
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onInsert(insertSaved(item))}
                className="group cursor-pointer border-2 border-hairline bg-ink p-2 text-left transition-colors hover:border-flare focus-visible:border-flare"
              >
                {first && <Wireframe shapes={BLOCK_WIREFRAMES[first.type as BlockType] ?? BLOCK_WIREFRAMES.savedBlock} />}
                <span className="mt-2 block text-[12px] leading-snug text-bone">{item.name}</span>
                <span className="block font-mono text-[9px] uppercase tracking-[0.12em] text-smoke">
                  {item.mode === 'synced' ? 'Synced' : 'Template'}
                  {item.category ? ` · ${item.category}` : ''}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── A synced block, as it sits in a tree ────────────────────────────────── */

/**
 * The locked card a synced reference shows instead of fields: its content is
 * the saved block's, edited there. Detach turns this one instance into its
 * own copy; the others stay synced.
 */
export function SavedBlockCard({ block, onReplace }: { block: AnyBlock; onReplace: (next: AnyBlock[]) => void }) {
  const { byId, isLoading } = useSavedBlocks();
  const id = (block.props as { savedBlockId?: string }).savedBlockId ?? '';
  const saved = byId.get(id);

  if (!isLoading && !saved) {
    return (
      <p className="m-0 border-l-2 border-amber-400 pl-3 text-[13px] text-amber-400">
        This saved block has been deleted, so nothing shows here on the site. Remove this block, or put something in its
        place.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 text-[13px] leading-relaxed text-ash">
        <strong className="text-bone">{saved?.name ?? (block.props as { name?: string }).name ?? 'Saved block'}</strong> — synced.
        Its content is edited in one place and shows the same on every page that uses it
        {saved ? ` (${saved.usage} place${saved.usage === 1 ? '' : 's'})` : ''}. The Design tab sets only this one&rsquo;s outer
        spacing and where it shows.
      </p>
      <div className="flex flex-wrap gap-2">
        <a
          href={`/admin/saved-blocks/${id}`}
          target="_blank"
          rel="noopener"
          className="inline-flex items-center border-2 border-hairline px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ash hover:border-flare hover:text-bone"
        >
          Edit the original ↗
        </a>
        <AdminButton
          type="button"
          variant="secondary"
          disabled={!saved}
          onClick={() => {
            if (!saved) return;
            if (window.confirm(`Detach this one? It becomes an ordinary copy on this page; other pages stay synced to “${saved.name}”.`)) {
              onReplace(freshIds(saved.tree, () => nanoid(10)));
            }
          }}
        >
          Detach
        </AdminButton>
      </div>
    </div>
  );
}
