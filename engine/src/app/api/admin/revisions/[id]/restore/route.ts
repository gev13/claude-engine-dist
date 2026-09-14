import { eq } from 'drizzle-orm';
import { conflict, handle, notFound, ok } from '@/server/api/respond';
import { requireUser } from '@/server/api/guard';
import { ownsOrAdmin } from '@/server/auth/rbac';
import { audit } from '@/server/auth/audit';
import { clientIp } from '@/server/auth/rateLimit';
import { revalidateContent, revalidateEverything } from '@/server/content/revalidate';
import { getRevision, restoreRevision } from '@/server/content/revisions';
import { db } from '@/server/db';
import { pages, posts } from '@/server/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

/**
 * Write a revision's snapshot back over the live content.
 *
 * The restore is itself a write, so it captures a new revision: the history
 * gains an entry rather than rewinding, and an accidental restore can itself
 * be undone.
 */
export async function POST(request: Request, ctx: Context) {
  return handle(async () => {
    const guard = await requireUser(request, 'revisions:restore');
    if (!guard.ok) return guard.response;

    const { id } = await ctx.params;
    const revision = await getRevision(id);
    if (!revision) return notFound('That revision no longer exists.');

    const target =
      revision.entityType === 'page'
        ? (await db
            .select({ authorId: pages.authorId, template: pages.template })
            .from(pages)
            .where(eq(pages.id, revision.entityId))
            .limit(1))[0]
        : (await db
            .select({ authorId: posts.authorId, template: posts.kind })
            .from(posts)
            .where(eq(posts.id, revision.entityId))
            .limit(1))[0];

    if (!target) return conflict('The content this revision belongs to has been deleted.');
    if (!ownsOrAdmin(guard.user, target.authorId)) return notFound('That revision no longer exists.');

    const result = await restoreRevision(id, { id: guard.user.id, email: guard.user.email });
    if (!result.ok) {
      return result.reason === 'not_found'
        ? notFound('That revision no longer exists.')
        : conflict('The content this revision belongs to has been deleted.');
    }

    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: 'content.restore',
      targetType: result.entityType,
      targetId: result.entityId,
      summary: `Restored ${result.entityType} to revision ${result.revisionNumber}`,
      metadata: { revisionId: id, revisionNumber: result.revisionNumber },
      ip: clientIp(request.headers),
    });

    if (result.path) revalidateContent([result.path]);
    // A restored service page changes the catalogue, which every listing reads.
    if (revision.entityType === 'page' && target.template === 'service') revalidateEverything();

    return ok({ restored: result });
  });
}
