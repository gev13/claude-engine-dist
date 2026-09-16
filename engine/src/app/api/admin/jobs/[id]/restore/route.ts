import { eq } from 'drizzle-orm';
import { conflict, handle, notFound, ok } from '@/server/api/respond';
import { requireUser } from '@/server/api/guard';
import { ownsOrAdmin } from '@/server/auth/rbac';
import { audit } from '@/server/auth/audit';
import { clientIp } from '@/server/auth/rateLimit';
import { db } from '@/server/db';
import { jobs } from '@/server/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

/**
 * Bring a role back from the trash.
 *
 * As a **draft**, and still closed. Trashing set `isOpen` to false, and an
 * advert that reappears on the careers page taking applications because
 * somebody undid a delete is worse than one that has to be reopened by hand.
 */
export async function POST(request: Request, context: Context) {
  return handle(async () => {
    const guard = await requireUser(request, 'jobs:write');
    if (!guard.ok) return guard.response;

    const { id } = await context.params;
    const [row] = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
    if (!row) return notFound('That role does not exist.');
    if (!ownsOrAdmin(guard.user, row.authorId)) return notFound('That role does not exist.');
    if (row.deletedAt === null) return conflict('That role is not in the trash.');

    const [restored] = await db
      .update(jobs)
      .set({ deletedAt: null, status: 'draft', updatedAt: new Date() })
      .where(eq(jobs.id, id))
      .returning();

    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: 'job.restore',
      targetType: 'job',
      targetId: id,
      summary: `Restored role "${row.title}" from the trash as a closed draft`,
      ip: clientIp(request.headers),
    });

    return ok(restored);
  });
}
