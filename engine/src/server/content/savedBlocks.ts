import 'server-only';
import { cache } from 'react';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import type { AnyBlock } from '@/lib/blocks';
import { MAX_SAVED_DEPTH, SAVED_BLOCK_TYPE, mapBlocks, savedBlockRefs } from '@/lib/blockTree';
import { localeConfig, type Locale } from '@/lib/locales';
import { db } from '@/server/db';
import { pages, posts, projects, savedBlockUsage, savedBlocks, settings } from '@/server/db/schema';

/* ═══════════════════════════════════════════════════════════════════════════
   Saved blocks — reading them, and knowing where they are used (T8, 2.15)
   ───────────────────────────────────────────────────────────────────────────
   A synced block renders from here on every page that references it, so a
   read never throws: a missing or deleted saved block renders nothing on the
   site (the builder is the place that warns about it), and an unreachable
   database is the same as a missing block.
   ═══════════════════════════════════════════════════════════════════════════ */

export type SavedBlockMode = 'synced' | 'template';

export type SavedTree = { id: string; name: string; mode: SavedBlockMode; tree: AnyBlock[] };

/**
 * One saved block's tree in a language: its translation in `locale` when it
 * has one, otherwise the block itself. Per request, so a page using the same
 * block three times reads it once.
 */
export const getSavedTree = cache(async (id: string, requested?: Locale): Promise<SavedTree | null> => {
  const locale = requested ?? localeConfig().defaultLocale;
  try {
    const [row] = await db
      .select()
      .from(savedBlocks)
      .where(and(eq(savedBlocks.id, id), isNull(savedBlocks.deletedAt)))
      .limit(1);
    if (!row) return null;
    let chosen = row;
    if (row.locale !== locale) {
      const [translated] = await db
        .select()
        .from(savedBlocks)
        .where(and(eq(savedBlocks.translationGroupId, row.translationGroupId), eq(savedBlocks.locale, locale), isNull(savedBlocks.deletedAt)))
        .limit(1);
      if (translated) chosen = translated;
    }
    return {
      id: row.id,
      name: chosen.name,
      mode: chosen.mode === 'template' ? 'template' : 'synced',
      tree: (chosen.tree ?? []) as AnyBlock[],
    };
  } catch {
    return null;
  }
});

/**
 * A tree with every saved-block reference replaced by what it shows —
 * for the things that read a page's content rather than render it: a form's
 * submission check, and the FAQ that becomes structured data. Stops at the
 * same depth the renderer does, and at a cycle.
 */
export async function expandSavedBlocks(blocks: readonly AnyBlock[], locale?: Locale, path: string[] = []): Promise<AnyBlock[]> {
  if (path.length >= MAX_SAVED_DEPTH || savedBlockRefs(blocks).length === 0) return [...blocks];
  const trees = new Map<string, AnyBlock[]>();
  for (const id of savedBlockRefs(blocks)) {
    if (path.includes(id)) continue;
    const saved = await getSavedTree(id, locale);
    if (saved) trees.set(id, await expandSavedBlocks(saved.tree, locale, [...path, id]));
  }
  return mapBlocks(blocks, (block) => {
    if (block.type !== SAVED_BLOCK_TYPE) return block;
    const id = (block.props as { savedBlockId?: string })?.savedBlockId;
    return (id && trees.get(id)) || null;
  });
}

/* ── The usage index ─────────────────────────────────────────────────────── */

export type UsageKind = 'page' | 'post' | 'project' | 'popups' | 'projectTemplate' | 'savedBlock';

/**
 * Record which saved blocks one piece of content uses, replacing what was
 * recorded before. Called after every save of anything that holds blocks.
 * Never throws: a stale index costs a usage count, not a save.
 */
export async function recordUsage(kind: UsageKind, contentId: string, blocks: readonly AnyBlock[] | null | undefined): Promise<void> {
  try {
    const refs = savedBlockRefs(blocks);
    const existing = refs.length
      ? (await db.select({ id: savedBlocks.id }).from(savedBlocks).where(inArray(savedBlocks.id, refs))).map((row) => row.id)
      : [];
    await db.transaction(async (tx) => {
      await tx.delete(savedBlockUsage).where(and(eq(savedBlockUsage.contentType, kind), eq(savedBlockUsage.contentId, contentId)));
      if (existing.length) {
        await tx
          .insert(savedBlockUsage)
          .values(existing.map((savedBlockId) => ({ savedBlockId, contentType: kind, contentId })))
          .onConflictDoNothing();
      }
    });
  } catch (error) {
    console.error('[saved blocks] usage index not updated', { kind, contentId, error });
  }
}

/** Forget a piece of content's usage — it was deleted. */
export async function forgetUsage(kind: UsageKind, contentIds: string[]): Promise<void> {
  if (contentIds.length === 0) return;
  try {
    await db.delete(savedBlockUsage).where(and(eq(savedBlockUsage.contentType, kind), inArray(savedBlockUsage.contentId, contentIds)));
  } catch {
    /* A stale index costs a usage count, not a delete. */
  }
}

export async function usageOf(savedBlockId: string): Promise<{ contentType: UsageKind; contentId: string }[]> {
  try {
    const rows = await db
      .select({ contentType: savedBlockUsage.contentType, contentId: savedBlockUsage.contentId })
      .from(savedBlockUsage)
      .where(eq(savedBlockUsage.savedBlockId, savedBlockId));
    return rows.map((row) => ({ contentType: row.contentType as UsageKind, contentId: row.contentId }));
  } catch {
    return [];
  }
}

/**
 * Build the usage index again from everything that holds blocks — after a
 * content import, which replaces the content the old index described.
 */
export async function rebuildUsageIndex(): Promise<void> {
  try {
    const [pageRows, postRows, projectRows, savedRows, settingRows] = await Promise.all([
      db.select({ id: pages.id, blocks: pages.blocks }).from(pages),
      db.select({ id: posts.id, blocks: posts.blocks }).from(posts),
      db.select({ id: projects.id, blocks: projects.blocks }).from(projects),
      db.select({ id: savedBlocks.id, tree: savedBlocks.tree }).from(savedBlocks),
      db.select({ key: settings.key, value: settings.value }).from(settings),
    ]);
    await db.delete(savedBlockUsage);
    for (const row of pageRows) await recordUsage('page', row.id, row.blocks as AnyBlock[]);
    for (const row of postRows) await recordUsage('post', row.id, row.blocks as AnyBlock[]);
    for (const row of projectRows) await recordUsage('project', row.id, row.blocks as AnyBlock[]);
    for (const row of savedRows) await recordUsage('savedBlock', row.id, row.tree as AnyBlock[]);
    for (const row of settingRows) {
      const base = row.key.split(':')[0];
      if (base === 'popups' && Array.isArray(row.value)) {
        await recordUsage('popups', row.key, (row.value as { blocks?: AnyBlock[] }[]).flatMap((popup) => popup.blocks ?? []));
      }
      if (base === 'projects' && row.value && typeof row.value === 'object') {
        await recordUsage('projectTemplate', row.key, ((row.value as { cta?: AnyBlock[] }).cta ?? []) as AnyBlock[]);
      }
    }
  } catch (error) {
    console.error('[saved blocks] usage index not rebuilt', { error });
  }
}
