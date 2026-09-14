import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { handle, noContent, notFound } from '@/server/api/respond';
import { requireUser } from '@/server/api/guard';
import { audit } from '@/server/auth/audit';
import { clientIp } from '@/server/auth/rateLimit';
import { db } from '@/server/db';
import { newsletterSubscribers } from '@/server/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/**
 * Erases a sign-up for good — the answer to "remove my address". There is no
 * trash for these: keeping a copy of an address someone asked to have removed
 * would defeat the point.
 */
export async function DELETE(request: Request, ctx: Ctx) {
  return handle(async () => {
    const guard = await requireUser(request, 'newsletter:write');
    if (!guard.ok) return guard.response;

    const { id } = await ctx.params;
    if (!z.string().uuid().safeParse(id).success) return notFound('That sign-up no longer exists.');

    const [row] = await db
      .delete(newsletterSubscribers)
      .where(eq(newsletterSubscribers.id, id))
      .returning({ id: newsletterSubscribers.id });
    if (!row) return notFound('That sign-up no longer exists.');

    // The address itself stays out of the audit log, which is append-only.
    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: 'newsletter.delete',
      targetType: 'subscriber',
      targetId: row.id,
      summary: 'Removed a newsletter sign-up',
      ip: clientIp(request.headers),
    });

    return noContent();
  });
}
