import { eq } from 'drizzle-orm';
import { conflict, handle, notFound, ok } from '@/server/api/respond';
import { requireUser } from '@/server/api/guard';
import { ownsOrAdmin } from '@/server/auth/rbac';
import { audit } from '@/server/auth/audit';
import { clientIp } from '@/server/auth/rateLimit';
import { db } from '@/server/db';
import { pages } from '@/server/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

/**
 * Bring a page back from the trash.
 *
 * It returns as a **draft**, never straight to published: something was
 * deleted, and putting it back on the live site without anyone looking at it
 * is not a recovery, it is a second accident.
 */
export async function POST(request: Request, context: Context) {
  return handle(async () => {
    const guard = await requireUser(request, 'pages:write');
    if (!guard.ok) return guard.response;

    const { id } = await context.params;
    const [row] = await db.select().from(pages).where(eq(pages.id, id)).limit(1);
    if (!row) return notFound('That page does not exist.');
    if (!ownsOrAdmin(guard.user, row.authorId)) return notFound('That page does not exist.');
    if (row.deletedAt === null) return conflict('That page is not in the trash.');

    const [restored] = await db
      .update(pages)
      .set({ deletedAt: null, status: 'draft', updatedAt: new Date() })
      .where(eq(pages.id, id))
      .returning();

    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: 'page.restore',
      targetType: 'page',
      targetId: id,
      summary: `Restored page "${row.title}" (${row.path}) from the trash as a draft`,
      ip: clientIp(request.headers),
    });

    return ok(restored);
  });
}
