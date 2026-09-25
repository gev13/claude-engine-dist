import { and, eq, inArray, isNull } from 'drizzle-orm';
import { conflict, handle, noContent, notFound, ok, readJson } from '@/server/api/respond';
import { requireUser } from '@/server/api/guard';
import { audit } from '@/server/auth/audit';
import { clientIp } from '@/server/auth/rateLimit';
import { type AnyBlock } from '@/lib/blocks';
import { captureRevision, deleteRevisionsFor } from '@/server/content/revisions';
import { forgetUsage, recordUsage, usageOf } from '@/server/content/savedBlocks';
import { detachEverywhere, revalidateSavedBlockUsers, savedBlockInput, validateSavedTree } from '@/server/content/savedBlockWrites';
import { getPermalinks } from '@/server/routing/config';
import { postPathById } from '@/server/content/posts';
import { projectPathById } from '@/server/content/projects';
import { db } from '@/server/db';
import { pages, posts, projects, savedBlocks } from '@/server/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

async function load(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await db.select().from(savedBlocks).where(and(eq(savedBlocks.id, id), isNull(savedBlocks.deletedAt))).limit(1);
  return row ?? null;
}

/** Where a saved block is used, named and linked — "used on" in the admin. */
async function describeUsage(id: string) {
  const uses = await usageOf(id);
  const permalinks = await getPermalinks();
  const ids = (kind: string) => uses.filter((use) => use.contentType === kind).map((use) => use.contentId);
  const out: { kind: string; title: string; edit: string; view: string | null }[] = [];
  if (ids('page').length) {
    for (const row of await db.select({ id: pages.id, title: pages.title, path: pages.path }).from(pages).where(inArray(pages.id, ids('page')))) {
      out.push({ kind: 'Page', title: row.title, edit: `/admin/pages/${row.id}`, view: row.path });
    }
  }
  if (ids('post').length) {
    for (const row of await db.select({ id: posts.id, title: posts.title }).from(posts).where(inArray(posts.id, ids('post')))) {
      out.push({ kind: 'Post', title: row.title, edit: `/admin/posts/${row.id}`, view: await postPathById(permalinks, row.id) });
    }
  }
  if (ids('project').length) {
    for (const row of await db.select({ id: projects.id, title: projects.title }).from(projects).where(inArray(projects.id, ids('project')))) {
      out.push({ kind: 'Project', title: row.title, edit: `/admin/projects/${row.id}`, view: await projectPathById(permalinks, row.id) });
    }
  }
  if (ids('savedBlock').length) {
    for (const row of await db.select({ id: savedBlocks.id, name: savedBlocks.name }).from(savedBlocks).where(inArray(savedBlocks.id, ids('savedBlock')))) {
      out.push({ kind: 'Saved block', title: row.name, edit: `/admin/saved-blocks/${row.id}`, view: null });
    }
  }
  if (ids('popups').length) out.push({ kind: 'Popups', title: 'A popup', edit: '/admin/popups', view: null });
  if (ids('projectTemplate').length) out.push({ kind: 'Project template', title: 'After every project', edit: '/admin/projects/template', view: null });
  return out;
}

export async function GET(request: Request, ctx: Ctx) {
  return handle(async () => {
    const guard = await requireUser(request, 'savedBlocks:read');
    if (!guard.ok) return guard.response;
    const row = await load((await ctx.params).id);
    if (!row) return notFound('That saved block no longer exists.');
    return ok({ ...row, usedOn: await describeUsage(row.id) });
  });
}

export async function PATCH(request: Request, ctx: Ctx) {
  return handle(async () => {
    const guard = await requireUser(request, 'savedBlocks:write');
    if (!guard.ok) return guard.response;
    const row = await load((await ctx.params).id);
    if (!row) return notFound('That saved block no longer exists.');
    const parsed = await readJson(request, savedBlockInput.partial());
    if (!parsed.ok) return parsed.response;
    const input = parsed.data;

    let tree = row.tree;
    if (input.tree) {
      const validated = await validateSavedTree(row.id, input.tree as AnyBlock[]);
      if (!validated.ok) return validated.response;
      tree = validated.tree;
    }

    const [updated] = await db
      .update(savedBlocks)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.mode !== undefined ? { mode: input.mode } : {}),
        tree,
        updatedById: guard.user.id,
        updatedAt: new Date(),
      })
      .where(eq(savedBlocks.id, row.id))
      .returning();

    await recordUsage('savedBlock', row.id, tree as AnyBlock[]);
    await captureRevision({
      entityType: 'saved_block',
      entityId: row.id,
      row: updated as unknown as Record<string, unknown>,
      actorId: guard.user.id,
      actorEmail: guard.user.email,
    });
    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: 'savedBlock.update',
      targetType: 'savedBlock',
      targetId: row.id,
      summary: `Updated the saved block "${updated?.name ?? row.name}"`,
      ip: clientIp(request.headers),
    });

    // Every page that shows it, now.
    await revalidateSavedBlockUsers(row.id);
    return ok({ ...updated, usedOn: await describeUsage(row.id) });
  });
}

/**
 * DELETE — refused while a synced block is still used somewhere, because the
 * pages would lose what they show. `?detach=1` first gives every page its own
 * copy ("Detach everywhere"), then deletes.
 */
export async function DELETE(request: Request, ctx: Ctx) {
  return handle(async () => {
    const guard = await requireUser(request, 'savedBlocks:write');
    if (!guard.ok) return guard.response;
    const row = await load((await ctx.params).id);
    if (!row) return notFound('That saved block no longer exists.');

    const uses = await usageOf(row.id);
    const detach = new URL(request.url).searchParams.get('detach') === '1';
    if (uses.length > 0 && !detach) {
      return conflict(
        `“${row.name}” is used in ${uses.length} place${uses.length === 1 ? '' : 's'}. Detach it everywhere first — each gets its own copy — or keep it.`,
      );
    }
    const detached = uses.length > 0 ? await detachEverywhere(row.id) : 0;
    if (detached > 0) await revalidateSavedBlockUsers(row.id);

    await db.delete(savedBlocks).where(eq(savedBlocks.id, row.id));
    await deleteRevisionsFor('saved_block', [row.id]);
    await forgetUsage('savedBlock', [row.id]);
    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: 'savedBlock.delete',
      targetType: 'savedBlock',
      targetId: row.id,
      summary: detached > 0 ? `Detached "${row.name}" from ${detached} place(s), then deleted it` : `Deleted the saved block "${row.name}"`,
      ip: clientIp(request.headers),
    });
    return noContent();
  });
}
