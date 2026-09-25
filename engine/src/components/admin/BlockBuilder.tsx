'use client';

import { SAVED_BLOCK_TYPE, freshIds } from '@/lib/blockTree';
import { MyBlocksPicker, SaveAsDialog, SavedBlockCard, repeatedUniqueParts, savedBlockRef, useClipboard, useSavedBlocks } from './SavedBlocksTools';
import { useToast as useBuilderToast } from './useToast';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { nanoid } from 'nanoid';
import { useMemo, useState } from 'react';
import { AdminButton } from '@/components/admin/ui';
import { BlockFields, blankProps } from '@/components/admin/blockFields';
import { type AnyBlock, type BlockType, blockLabels, blockTypes, migrateBlocks, parseBlock } from '@/lib/blocks';
import { blockStyleSchema, type BlockStyle } from '@/lib/blockStyle';
import { BlockDesignPanel } from './BlockDesignPanel';
import { Wireframe } from './Wireframe';
import { ReadySections } from './TemplatePickers';
import { cn } from '@/lib/utils';
import { BLOCK_WIREFRAMES } from '@/lib/wireframes';
import { countHeadingOnes, withoutHeadingOne } from '@/lib/headings';
import { hiddenTiers } from '@/lib/blockStyle';
import { TIER_LABELS } from '@/lib/theme';

/** Grouping for the "add block" menu — flat lists of 18 are hard to scan. */
const GROUPS: { label: string; types: BlockType[] }[] = [
  { label: 'Openers', types: ['hero', 'carousel', 'stackedPanels', 'mediaBand', 'stats'] },
  {
    label: 'Content',
    types: ['prose', 'heading', 'splitMedia', 'overlayCard', 'collage', 'tabs', 'splitPoints', 'numberedList', 'checkLists', 'table', 'image', 'windowFrame', 'configurator'],
  },
  { label: 'Scroll effects', types: ['scrollStory', 'pinnedMedia'] },
  { label: 'Elements', types: ['buttons', 'notice', 'progress', 'countdown', 'socialLinks', 'flipBox', 'share', 'textPath'] },
  { label: 'Media', types: ['video', 'gallery', 'compare', 'horizontalAccordion', 'hotspots', 'map', 'lottie'] },
  { label: 'Data and info', types: ['chart', 'priceList', 'businessHours'] },
  { label: 'Collections', types: ['cardGrid', 'projects', 'team', 'reviews', 'logoWall', 'marquee', 'quote', 'servicesIndex', 'postList', 'infoPanel'] },
  { label: 'Conversion', types: ['cta', 'pricing', 'newsletter', 'appPromo', 'faq', 'contactForm', 'form', 'pager'] },
  { label: 'Navigation', types: ['subNav', 'breadcrumbs', 'toc', 'search', 'categoryIndex'] },
];


/** Tier names short enough for a badge (2.19). */
const TIER_SHORT = { base: 'large', laptop: 'desktop', tablet: 'tablet', mobile: 'phone' } as const;

/** One-line preview so a collapsed block is still identifiable. */
function summarise(block: AnyBlock): string {
  const p = block.props ?? {};

  // A row has no copy of its own; what identifies it is its shape.
  if (block.type === 'row' && Array.isArray(p.columns)) {
    const spans = (p.columns as { width?: { base?: number } }[]).map((c) => c.width?.base ?? '?');
    const total = (p.columns as { blocks?: unknown[] }[]).reduce((n, c) => n + (c.blocks?.length ?? 0), 0);
    return `${spans.join(' + ')} of 12 · ${total} block${total === 1 ? '' : 's'}`;
  }

  for (const key of ['title', 'statement', 'label', 'alt']) {
    const value = p[key];
    if (typeof value === 'string' && value.trim()) return value.trim().slice(0, 70);
  }
  if (Array.isArray(p.items)) return `${p.items.length} item${p.items.length === 1 ? '' : 's'}`;
  if (Array.isArray(p.cards)) return `${p.cards.length} card${p.cards.length === 1 ? '' : 's'}`;
  return '—';
}

function SortableBlock({
  block,
  index,
  total,
  expanded,
  onToggle,
  onChange,
  onDuplicate,
  onDelete,
  onReplace,
  onCopy,
  onPaste,
  onSaveAs,
}: {
  block: AnyBlock;
  index: number;
  total: number;
  expanded: boolean;
  onToggle: () => void;
  onChange: (next: AnyBlock) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  /** Replace this block with others — a synced block detached into its own copy. */
  onReplace: (next: AnyBlock[]) => void;
  /** The ⋯ menu's other actions (2.15). */
  onCopy: () => void;
  onPaste: ((where: 'above' | 'below') => void) | null;
  onSaveAs: (() => void) | null;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const [confirming, setConfirming] = useState(false);
  const [menu, setMenu] = useState(false);
  const isSaved = block.type === SAVED_BLOCK_TYPE;
  const [tab, setTab] = useState<'content' | 'design'>('content');

  const valid = parseBlock(block) !== null;
  const label = blockLabels[block.type as BlockType] ?? block.type;

  // Read back through the schema so the panel is never handed a shape the
  // renderer would reject.
  const parsedStyle = blockStyleSchema.safeParse(block.style ?? {});
  const style: BlockStyle | undefined =
    parsedStyle.success && Object.keys(parsedStyle.data).length > 0 ? parsedStyle.data : undefined;
  const styledCount = style ? Object.keys(style).length : 0;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('border-2 bg-surface', isDragging ? 'border-flare opacity-90' : 'border-hairline')}
    >
      <div className="flex items-center gap-3 px-3 py-2.5">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Reorder ${label}, position ${index + 1} of ${total}`}
          className="cursor-grab bg-transparent px-1 font-mono text-[14px] leading-none text-smoke hover:text-bone active:cursor-grabbing"
        >
          ⠿
        </button>

        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 cursor-pointer items-baseline gap-3 bg-transparent p-0 text-left"
        >
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-flare">{label}</span>
          <span className="truncate text-[13px] text-ash">
            {style?.label || (isSaved ? String((block.props as { name?: string }).name ?? 'Saved block') : summarise(block))}
          </span>
        </button>

        {style?.disabled && (
          <span
            className="shrink-0 font-mono text-[9px] uppercase tracking-[0.12em] text-smoke"
            title="Hidden from the live page, but kept here."
          >
            Hidden
          </span>
        )}

        {!style?.disabled && hiddenTiers(style).length > 0 && (
          // 2.19 (T32) — where this block is left out, at a glance.
          <span
            className="shrink-0 font-mono text-[9px] uppercase tracking-[0.12em] text-smoke"
            title={`Not shown on: ${hiddenTiers(style).map((tier) => TIER_LABELS[tier].toLowerCase()).join(', ')}`}
          >
            {hiddenTiers(style).length === 4 ? 'Hidden everywhere' : `Not on ${hiddenTiers(style).map((tier) => TIER_SHORT[tier]).join(' · ')}`}
          </span>
        )}

        {!valid && (
          <span
            className="shrink-0 font-mono text-[9px] uppercase tracking-[0.12em] text-amber-400"
            title="Some settings are incomplete — this block will not appear on the live page until they are fixed."
          >
            Incomplete
          </span>
        )}

        <div className="relative flex shrink-0 items-center gap-1">
          <AdminButton
            variant="ghost"
            type="button"
            onClick={() => setMenu((open) => !open)}
            className="px-2 py-1"
            aria-label="More actions"
            aria-expanded={menu}
          >
            ⋯
          </AdminButton>
          {menu && (
            <div
              role="menu"
              className="absolute right-0 top-full z-20 mt-1 flex min-w-[210px] flex-col border-2 border-hairline bg-ink py-1 shadow-lg"
              onMouseLeave={() => setMenu(false)}
            >
              {[
                { label: 'Duplicate', run: onDuplicate },
                { label: block.type === 'row' ? 'Copy row' : 'Copy block', run: onCopy },
                ...(onPaste
                  ? [
                      { label: 'Paste above', run: () => onPaste('above') },
                      { label: 'Paste below', run: () => onPaste('below') },
                    ]
                  : []),
                ...(onSaveAs && !isSaved ? [{ label: 'Save as a saved block…', run: onSaveAs }] : []),
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenu(false);
                    item.run();
                  }}
                  className="cursor-pointer bg-transparent px-3 py-2 text-left text-[13px] text-ash hover:bg-surface hover:text-bone"
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
          {confirming ? (
            <>
              <AdminButton variant="danger" type="button" onClick={onDelete} className="px-2 py-1">
                Confirm delete
              </AdminButton>
              <AdminButton variant="ghost" type="button" onClick={() => setConfirming(false)} className="px-2 py-1">
                Cancel
              </AdminButton>
            </>
          ) : (
            <AdminButton
              variant="ghost"
              type="button"
              onClick={() => setConfirming(true)}
              className="px-2 py-1 text-flare-soft"
              aria-label="Delete block"
            >
              ×
            </AdminButton>
          )}
          <AdminButton variant="ghost" type="button" onClick={onToggle} className="px-2 py-1" aria-label={expanded ? 'Collapse' : 'Expand'}>
            {expanded ? '−' : '+'}
          </AdminButton>
        </div>
      </div>

      {expanded && (
        <div className="flex flex-col gap-4 border-t-2 border-hairline p-4">
          {!valid && (
            <p className="m-0 border-l-2 border-amber-400 pl-3 text-[13px] text-amber-400">
              This block is missing something required and will be skipped when the page renders. Fill in the fields
              below to bring it back.
            </p>
          )}
          <div className="flex gap-1 border-b-2 border-hairline">
            <button
              type="button"
              onClick={() => setTab('content')}
              className={cn(
                '-mb-0.5 border-b-2 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.1em] transition-colors',
                tab === 'content' ? 'border-flare text-bone' : 'border-transparent text-smoke hover:text-bone',
              )}
            >
              Content
            </button>
            <button
              type="button"
              onClick={() => setTab('design')}
              className={cn(
                '-mb-0.5 border-b-2 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.1em] transition-colors',
                tab === 'design' ? 'border-flare text-bone' : 'border-transparent text-smoke hover:text-bone',
              )}
            >
              Design
              {styledCount > 0 && <span className="ml-1.5 text-flare">{styledCount}</span>}
            </button>
          </div>

          {tab === 'content' && isSaved ? (
            <SavedBlockCard block={block} onReplace={onReplace} />
          ) : tab === 'content' ? (
            <BlockFields
              type={block.type as BlockType}
              props={block.props ?? {}}
              set={(props) => onChange({ ...block, props })}
            />
          ) : (
            <BlockDesignPanel
              blockType={block.type}
              outerOnly={isSaved}
              style={style}
              onChange={(next) => {
                const { style: _drop, ...rest } = block;
                onChange(next ? { ...rest, style: next } : rest);
              }}
            />
          )}
        </div>
      )}
    </li>
  );
}

/**
 * The page builder. Blocks are reordered by drag or by keyboard (tab to the
 * handle, space to lift, arrows to move, space to drop), edited inline, and
 * validated on every change so an author sees a problem before saving rather
 * than discovering a missing section on the live site.
 */
/**
 * Count the `h1`s a block tree would render.
 *
 * Every page needs exactly one: it is what tells a reader and a search engine
 * what the page is about, and the smoke suite asserts it. `titleAs` lets an
 * editor pick h1 on any block that has a title, so the builder has to say
 * something before the page is saved rather than after it is live.
 *
 * Heroes default to h1; everything else defaults to h2 or lower.
 */
export function BlockBuilder({
  value: stored,
  onChange,
  exclude = [],
  excludeSavedId,
}: {
  value: AnyBlock[];
  onChange: (next: AnyBlock[]) => void;
  /** Block types this tree may not add — a post's builder leaves out heroes (2.13). */
  exclude?: readonly string[];
  /** The saved block being edited, which may not be inserted into itself (2.15). */
  excludeSavedId?: string;
}) {
  const offered = (type: BlockType) => !exclude.includes(type);
  // Blocks of a retired type open as the block they became, so they can be edited; saving stores the new type.
  const value = useMemo(() => migrateBlocks(stored), [stored]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [addTab, setAddTab] = useState<'blocks' | 'sections' | 'mine'>('blocks');
  const clipboard = useClipboard();
  const saved = useSavedBlocks();
  const [savingAs, setSavingAs] = useState<AnyBlock | null>(null);
  const { toast } = useBuilderToast();
  /* Sixty-three blocks is too many to scan by eye. */
  const [blockQuery, setBlockQuery] = useState('');

  /**
   * `null` while the box is empty — the grouped view is the better way to
   * browse, and should be what somebody sees until they actually type.
   *
   * Matching the type as well as the label is deliberate: somebody who knows
   * the engine will type "postList" faster than "Post list", and the labels
   * already carry the common synonyms ("Carousel / slider").
   */
  const matchingBlocks = useMemo(() => {
    const query = blockQuery.trim().toLowerCase();
    if (!query) return null;
    return blockTypes.filter((type) => !exclude.includes(type)).filter(
      (type) => blockLabels[type].toLowerCase().includes(query) || type.toLowerCase().includes(query),
    );
  }, [blockQuery, exclude]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const ids = useMemo(() => value.map((b) => b.id), [value]);
  const headingOnes = useMemo(() => countHeadingOnes(value), [value]);

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from === -1 || to === -1) return;
    onChange(arrayMove(value, from, to));
  }

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function add(type: BlockType) {
    const block: AnyBlock = { id: nanoid(10), type, props: blankProps(type) };
    onChange([...value, block]);
    setExpanded((prev) => new Set(prev).add(block.id));
    setAdding(false);
  }

  /** A ready section's blocks go at the end; its opening becomes an h2 when the page already has an h1. */
  function insert(blocks: AnyBlock[]) {
    onChange([...value, ...(countHeadingOnes(value) > 0 ? blocks.map(withoutHeadingOne) : blocks)]);
    setAdding(false);
  }

  const invalid = value.filter((b) => parseBlock(b) === null).length;
  const repeated = useMemo(() => repeatedUniqueParts(value, saved.byId), [value, saved.byId]);

  /** Paste what is on the clipboard next to block `index`, or at the end. */
  function paste(index: number | null, where: 'above' | 'below' = 'below') {
    const blocks = clipboard.take();
    if (!blocks) {
      toast('There is nothing on the clipboard to paste, or it is no longer a valid block.');
      return;
    }
    if (index === null) onChange([...value, ...blocks]);
    else {
      const at = where === 'above' ? index : index + 1;
      onChange([...value.slice(0, at), ...blocks, ...value.slice(at)]);
    }
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-smoke">
          {value.length} block{value.length === 1 ? '' : 's'}
          {invalid > 0 && <span className="ml-2 text-amber-400">{invalid} incomplete</span>}
          {headingOnes !== 1 && (
            <span className="ml-2 text-amber-400">
              {headingOnes === 0 ? 'no H1' : `${headingOnes} H1s`}
            </span>
          )}
        </span>
        <div className="flex items-center gap-2">
          <AdminButton variant="ghost" type="button" onClick={() => setExpanded(new Set())}>
            Collapse all
          </AdminButton>
          <AdminButton variant="ghost" type="button" onClick={() => setExpanded(new Set(ids))}>
            Expand all
          </AdminButton>
        </div>
      </div>

      {repeated.length > 0 && (
        <p className="m-0 mb-3 border-l-2 border-amber-400 pl-3 text-[13px] leading-relaxed text-amber-400">
          {repeated.join(', ')} {repeated.length === 1 ? 'is' : 'are'} used more than once here and{' '}
          {repeated.length === 1 ? 'holds' : 'hold'} a form or an anchor — a page can have each only once. Detach one copy, or
          use a different block.
        </p>
      )}

      {headingOnes !== 1 && (
        <p className="m-0 mb-3 border-l-2 border-amber-400 pl-3 text-[13px] leading-relaxed text-amber-400">
          {headingOnes === 0
            ? 'Nothing on this page renders an H1. Set one block\u2019s title to render as Heading 1 \u2014 usually the hero.'
            : `${headingOnes} blocks render an H1. A page should have exactly one: it is what tells a reader and a search engine what the page is about.`}
        </p>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
        modifiers={[restrictToVerticalAxis]}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {value.map((block, i) => (
              <SortableBlock
                key={block.id}
                block={block}
                index={i}
                total={value.length}
                expanded={expanded.has(block.id)}
                onToggle={() => toggle(block.id)}
                onChange={(next) => onChange(value.map((b) => (b.id === block.id ? next : b)))}
                onDuplicate={() => {
                  // A deep copy: a row's columns and everything in them get new ids too.
                  const [copy] = freshIds([block], () => nanoid(10));
                  onChange([...value.slice(0, i + 1), copy!, ...value.slice(i + 1)]);
                }}
                onDelete={() => onChange(value.filter((b) => b.id !== block.id))}
                onReplace={(next) => onChange([...value.slice(0, i), ...next, ...value.slice(i + 1)])}
                onCopy={() => {
                  if (clipboard.copy([block])) toast('Copied. Paste it into any page, post, project or saved block.');
                }}
                onPaste={clipboard.held?.length ? (where) => paste(i, where) : null}
                onSaveAs={saved.canWrite ? () => setSavingAs(block) : null}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      {value.length === 0 && (
        <p className="border-2 border-dashed border-hairline px-5 py-10 text-center text-[14px] text-smoke">
          This page has no blocks yet. Add one below to start building it.
        </p>
      )}

      <div className="mt-4">
        {adding ? (
          <div className="border-2 border-hairline bg-surface p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex gap-1" role="tablist" aria-label="What to add">
                {(['blocks', 'mine', 'sections'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    role="tab"
                    aria-selected={addTab === tab}
                    onClick={() => setAddTab(tab)}
                    className={`cursor-pointer border-2 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] ${addTab === tab ? 'border-flare text-bone' : 'border-hairline text-smoke hover:text-bone'}`}
                  >
                    {tab === 'blocks' ? 'A block' : tab === 'mine' ? 'My blocks' : 'Ready sections'}
                  </button>
                ))}
              </div>
              <AdminButton variant="ghost" type="button" onClick={() => setAdding(false)}>
                Cancel
              </AdminButton>
            </div>
            {addTab === 'sections' ? (
              <ReadySections onInsert={insert} />
            ) : addTab === 'mine' ? (
              <MyBlocksPicker
                excludeId={excludeSavedId}
                onInsert={(blocks) => {
                  onChange([...value, ...blocks]);
                  setAdding(false);
                }}
              />
            ) : (
              <>
            {/* Typing narrows the whole vocabulary to one flat list; empty
                restores the groups, which are the better way to browse. */}
            <div className="mb-4">
              <input
                type="search"
                value={blockQuery}
                onChange={(event) => setBlockQuery(event.target.value)}
                placeholder="Search blocks — carousel, form, gallery…"
                aria-label="Search blocks"
                className="w-full border-2 border-hairline bg-ink px-3 py-2 text-[14px] text-bone placeholder:text-smoke"
              />
            </div>

            {matchingBlocks !== null ? (
              matchingBlocks.length === 0 ? (
                <p className="m-0 py-6 text-center text-[14px] text-smoke">
                  Nothing matches &ldquo;{blockQuery}&rdquo;.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
                  {matchingBlocks.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => add(type)}
                      className="group cursor-pointer border-2 border-hairline bg-ink p-2 text-left transition-colors hover:border-flare focus-visible:border-flare"
                    >
                      <Wireframe shapes={BLOCK_WIREFRAMES[type]} />
                      <span className="mt-2 block text-[12px] leading-snug text-ash group-hover:text-bone">
                        {blockLabels[type]}
                      </span>
                    </button>
                  ))}
                </div>
              )
            ) : (
              <>
            <div className="flex flex-col gap-6">
              {GROUPS.map((group) => (
                <section key={group.label}>
                  <h3 className="m-0 mb-2 font-mono text-[9px] font-normal uppercase tracking-[0.16em] text-smoke/70">
                    {group.label}
                  </h3>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
                    {group.types.filter(offered).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => add(type)}
                        className="group cursor-pointer border-2 border-hairline bg-ink p-2 text-left transition-colors hover:border-flare focus-visible:border-flare"
                      >
                        <Wireframe shapes={BLOCK_WIREFRAMES[type]} />
                        <span className="mt-2 block text-[12px] leading-snug text-ash group-hover:text-bone">
                          {blockLabels[type]}
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
            {/* Anything defined in blocks.ts but not grouped above still needs a way in. */}
            {blockTypes.filter((t) => offered(t) && !GROUPS.some((g) => g.types.includes(t))).length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1 border-t-2 border-hairline pt-4">
                {blockTypes
                  .filter((t) => offered(t) && !GROUPS.some((g) => g.types.includes(t)))
                  .map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => add(type)}
                      className="cursor-pointer border-2 border-transparent bg-ink px-3 py-2 text-[13px] text-ash hover:border-flare hover:text-bone"
                    >
                      {blockLabels[type]}
                    </button>
                  ))}
              </div>
            )}
              </>
            )}
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <AdminButton type="button" onClick={() => setAdding(true)}>
              + Add block
            </AdminButton>
            {clipboard.held?.length ? (
              <AdminButton type="button" variant="secondary" onClick={() => paste(null)}>
                Paste {clipboard.held.length === 1 ? (blockLabels[clipboard.held[0]!.type as BlockType] ?? 'block').toLowerCase() : `${clipboard.held.length} blocks`}
              </AdminButton>
            ) : null}
          </div>
        )}
      </div>

      {savingAs && (
        <SaveAsDialog
          blocks={[savingAs]}
          onClose={() => setSavingAs(null)}
          onSaved={(result) => {
            // A synced block's source becomes a reference to it; a template leaves the page as it was.
            if (result.mode === 'synced') {
              onChange(value.map((b) => (b.id === savingAs.id ? savedBlockRef(result) : b)));
            }
            toast(`Saved “${result.name}”. Find it under Add block → My blocks.`);
            setSavingAs(null);
          }}
        />
      )}
    </div>
  );
}
