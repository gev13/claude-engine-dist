import { asc, isNull, sql } from 'drizzle-orm';
import { localeConfig } from '@/lib/locales';
import { created, handle, ok, readJson } from '@/server/api/respond';
import { requireUser } from '@/server/api/guard';
import { can } from '@/server/auth/rbac';
import { audit } from '@/server/auth/audit';
import { clientIp } from '@/server/auth/rateLimit';
import { captureRevision } from '@/server/content/revisions';
import { recordUsage } from '@/server/content/savedBlocks';
import { savedBlockInput, validateSavedTree } from '@/server/content/savedBlockWrites';
import { type AnyBlock } from '@/lib/blocks';
import { db } from '@/server/db';
import { savedBlockUsage, savedBlocks } from '@/server/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET — every saved block with how many places use it: the builder's
 * "My blocks" tab and the My blocks screen. Trees included, so the picker can
 * insert a template without a second request.
 */
export async function GET(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'savedBlocks:read');
    if (!guard.ok) return guard.response;
    const items = await db
      .select({
        id: savedBlocks.id,
        name: savedBlocks.name,
        description: savedBlocks.description,
        category: savedBlocks.category,
        mode: savedBlocks.mode,
        tree: savedBlocks.tree,
        locale: savedBlocks.locale,
        updatedAt: savedBlocks.updatedAt,
        usage: sql<number>`(select count(*)::int from ${savedBlockUsage} where ${savedBlockUsage.savedBlockId} = ${savedBlocks.id})`,
      })
      .from(savedBlocks)
      .where(isNull(savedBlocks.deletedAt))
      .orderBy(asc(savedBlocks.category), asc(savedBlocks.name));
    // The builder offers "Save as saved block" only to a role that may make one.
    return ok({ items, canWrite: can(guard.user, 'savedBlocks:write') });
  });
}

/** POST — save a block (or a few) as a saved block. Managers and administrators. */
export async function POST(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'savedBlocks:write');
    if (!guard.ok) return guard.response;
    const parsed = await readJson(request, savedBlockInput);
    if (!parsed.ok) return parsed.response;
    const input = parsed.data;

    const validated = await validateSavedTree(null, input.tree as AnyBlock[]);
    if (!validated.ok) return validated.response;

    const [row] = await db
      .insert(savedBlocks)
      .values({
        name: input.name,
        description: input.description,
        category: input.category,
        mode: input.mode,
        tree: validated.tree,
        locale: localeConfig().defaultLocale,
        createdById: guard.user.id,
        updatedById: guard.user.id,
      })
      .returning();
    if (!row) throw new Error('insert returned nothing');

    await recordUsage('savedBlock', row.id, validated.tree as AnyBlock[]);
    await captureRevision({
      entityType: 'saved_block',
      entityId: row.id,
      row: row as unknown as Record<string, unknown>,
      reason: 'create',
      actorId: guard.user.id,
      actorEmail: guard.user.email,
    });
    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: 'savedBlock.create',
      targetType: 'savedBlock',
      targetId: row.id,
      summary: `Saved "${row.name}" as a ${row.mode} block`,
      ip: clientIp(request.headers),
    });
    return created({ ...row, usage: 0 });
  });
}
