import { eq } from 'drizzle-orm';
import { conflict, handle, notFound, ok } from '@/server/api/respond';
import { requireUser } from '@/server/api/guard';
import { ownsOrAdmin } from '@/server/auth/rbac';
import { audit } from '@/server/auth/audit';
import { clientIp } from '@/server/auth/rateLimit';
import { db } from '@/server/db';
import { projects } from '@/server/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

/** Bring a project back from the trash — as a draft, never straight to published. */
export async function POST(request: Request, context: Context) {
  return handle(async () => {
    const guard = await requireUser(request, 'projects:write');
    if (!guard.ok) return guard.response;

    const { id } = await context.params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) return notFound('That project does not exist.');
    const [row] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
    if (!row || !ownsOrAdmin(guard.user, row.authorId)) return notFound('That project does not exist.');
    if (row.deletedAt === null) return conflict('That project is not in the trash.');

    const [restored] = await db
      .update(projects)
      .set({ deletedAt: null, status: 'draft', updatedAt: new Date() })
      .where(eq(projects.id, id))
      .returning();

    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: 'project.restore',
      targetType: 'project',
      targetId: id,
      summary: `Restored project "${row.title}" from the trash as a draft`,
      ip: clientIp(request.headers),
    });
    return ok(restored);
  });
}
