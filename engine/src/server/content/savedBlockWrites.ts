import 'server-only';
import { nanoid } from 'nanoid';
import { NextResponse } from 'next/server';
import { eq, inArray, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { type AnyBlock, collectInvalidBlocks, parseBlocks } from '@/lib/blocks';
import { detachSavedBlock, savedBlockCycle } from '@/lib/blockTree';
import { blockInput } from '@/server/api/schemas';
import { badRequest } from '@/server/api/respond';
import { db } from '@/server/db';
import { pages, posts, projects, savedBlocks, settings, type Block } from '@/server/db/schema';
import { getPermalinks } from '@/server/routing/config';
import { postPathById } from './posts';
import { projectPathById } from './projects';
import { revalidateContent, revalidateEverything } from './revalidate';
import { recordUsage, usageOf, type UsageKind } from './savedBlocks';

/* ═══════════════════════════════════════════════════════════════════════════
   Writing saved blocks (T8, 2.15)
   ═══════════════════════════════════════════════════════════════════════════ */

export const SAVED_BLOCK_MODES = ['synced', 'template'] as const;

export const savedBlockInput = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(300).default(''),
  category: z.string().trim().max(60).default(''),
  mode: z.enum(SAVED_BLOCK_MODES).default('synced'),
  tree: z.array(blockInput).min(1).max(50),
});

/**
 * Check a tree before it is stored as saved block `id` (null for a new one):
 * every block valid, and no reference that would make the block contain
 * itself or nest deeper than three.
 */
export async function validateSavedTree(
  id: string | null,
  tree: AnyBlock[],
): Promise<{ ok: true; tree: Block[] } | { ok: false; response: NextResponse }> {
  const problems = collectInvalidBlocks(tree);
  if (problems.length > 0) return { ok: false, response: badRequest(`${problems[0]} and was not saved.`, { problems }) };
  const all = await db.select({ id: savedBlocks.id, tree: savedBlocks.tree }).from(savedBlocks).where(isNull(savedBlocks.deletedAt));
  const trees = new Map(all.map((row) => [row.id, (row.tree ?? []) as AnyBlock[]]));
  const cycle = savedBlockCycle(id, tree, (ref) => trees.get(ref));
  if (cycle) return { ok: false, response: badRequest(cycle) };
  return { ok: true, tree: parseBlocks(tree) as Block[] };
}

/**
 * Every page that shows a saved block, revalidated — through the usage
 * index, and through saved blocks that contain it. Content kept in settings
 * (popups, the project template) is on every page, so that is everything.
 */
export async function revalidateSavedBlockUsers(savedBlockId: string, seen = new Set<string>()): Promise<void> {
  if (seen.has(savedBlockId)) return;
  seen.add(savedBlockId);
  const permalinks = await getPermalinks();
  const paths: string[] = [];
  for (const use of await usageOf(savedBlockId)) {
    if (use.contentType === 'popups' || use.contentType === 'projectTemplate' || use.contentType === 'blogArchive') {
      revalidateEverything();
      return;
    }
    if (use.contentType === 'page') {
      const [row] = await db.select({ path: pages.path }).from(pages).where(eq(pages.id, use.contentId)).limit(1);
      if (row) paths.push(row.path);
    } else if (use.contentType === 'post') {
      const path = await postPathById(permalinks, use.contentId);
      if (path) paths.push(path);
    } else if (use.contentType === 'project') {
      const path = await projectPathById(permalinks, use.contentId);
      if (path) paths.push(path);
    } else if (use.contentType === 'savedBlock') {
      await revalidateSavedBlockUsers(use.contentId, seen);
    }
  }
  if (paths.length) revalidateContent(paths);
}

/**
 * Replace every reference to a saved block with its own copy of the tree —
 * "Detach everywhere" — so the saved block can be deleted without a single
 * page losing what it showed. Returns how many places were detached.
 */
export async function detachEverywhere(savedBlockId: string): Promise<number> {
  const [saved] = await db.select().from(savedBlocks).where(eq(savedBlocks.id, savedBlockId)).limit(1);
  if (!saved) return 0;
  const tree = (saved.tree ?? []) as AnyBlock[];
  const detach = (blocks: unknown) => detachSavedBlock((blocks ?? []) as AnyBlock[], savedBlockId, tree, () => nanoid(10)) as Block[];
  const uses = await usageOf(savedBlockId);
  const byKind = (kind: UsageKind) => uses.filter((use) => use.contentType === kind).map((use) => use.contentId);

  for (const [kind, table] of [['page', pages], ['post', posts], ['project', projects]] as const) {
    const ids = byKind(kind);
    if (ids.length === 0) continue;
    const rows = await db.select({ id: table.id, blocks: table.blocks }).from(table).where(inArray(table.id, ids));
    for (const row of rows) {
      const blocks = detach(row.blocks);
      await db.update(table).set({ blocks, updatedAt: new Date() }).where(eq(table.id, row.id));
      await recordUsage(kind, row.id, blocks as AnyBlock[]);
    }
  }

  for (const id of byKind('savedBlock')) {
    const [row] = await db.select({ tree: savedBlocks.tree }).from(savedBlocks).where(eq(savedBlocks.id, id)).limit(1);
    if (!row) continue;
    const next = detach(row.tree);
    await db.update(savedBlocks).set({ tree: next, updatedAt: new Date() }).where(eq(savedBlocks.id, id));
    await recordUsage('savedBlock', id, next as AnyBlock[]);
  }

  // Settings-held content is recorded by its key — `popups`, `popups:hy`, `projects:ru` — one row per language.
  for (const key of byKind('popups')) {
    const [row] = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
    if (!row || !Array.isArray(row.value)) continue;
    const next = (row.value as { blocks?: unknown }[]).map((popup) => ({ ...popup, blocks: detach(popup.blocks) }));
    await db.update(settings).set({ value: next, updatedAt: new Date() }).where(eq(settings.key, key));
    await recordUsage('popups', key, next.flatMap((popup) => popup.blocks as AnyBlock[]));
  }

  for (const key of byKind('projectTemplate')) {
    const [row] = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
    if (!row) continue;
    const value = (row.value ?? {}) as { cta?: unknown };
    const cta = detach(value.cta);
    await db.update(settings).set({ value: { ...value, cta }, updatedAt: new Date() }).where(eq(settings.key, key));
    await recordUsage('projectTemplate', key, cta as AnyBlock[]);
  }

  for (const key of byKind('blogArchive')) {
    const [row] = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
    if (!row) continue;
    const value = (row.value ?? {}) as { before?: unknown; after?: unknown };
    const before = detach(value.before);
    const after = detach(value.after);
    await db.update(settings).set({ value: { ...value, before, after }, updatedAt: new Date() }).where(eq(settings.key, key));
    await recordUsage('blogArchive', key, [...(before as AnyBlock[]), ...(after as AnyBlock[])]);
  }

  return uses.length;
}
