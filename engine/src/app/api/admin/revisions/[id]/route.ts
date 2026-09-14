import { eq } from 'drizzle-orm';
import { handle, notFound, ok } from '@/server/api/respond';
import { requireUser } from '@/server/api/guard';
import { ownsOrAdmin } from '@/server/auth/rbac';
import { getRevision } from '@/server/content/revisions';
import { db } from '@/server/db';
import { pages, posts } from '@/server/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

/** One revision, including its snapshot, so the editor can preview it. */
export async function GET(request: Request, ctx: Context) {
  return handle(async () => {
    const guard = await requireUser(request, 'revisions:read');
    if (!guard.ok) return guard.response;

    const { id } = await ctx.params;
    const revision = await getRevision(id);
    if (!revision) return notFound('That revision no longer exists.');

    // The ownership rule that governs the content governs its history too:
    // an editor must not read revisions of a page they could not open.
    const authorId =
      revision.entityType === 'page'
        ? (await db.select({ a: pages.authorId }).from(pages).where(eq(pages.id, revision.entityId)).limit(1))[0]?.a
        : (await db.select({ a: posts.authorId }).from(posts).where(eq(posts.id, revision.entityId)).limit(1))[0]?.a;

    if (!ownsOrAdmin(guard.user, authorId)) return notFound('That revision no longer exists.');

    return ok({ revision });
  });
}
