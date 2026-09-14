import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { badRequest, handle, noContent, notFound, ok, readJson } from '@/server/api/respond';
import { requireUser } from '@/server/api/guard';
import { audit } from '@/server/auth/audit';
import { clientIp } from '@/server/auth/rateLimit';
import { isSafeTarget, normalisePath } from '@/server/content/redirects';
import { revalidateContent } from '@/server/content/revalidate';
import { db } from '@/server/db';
import { redirects } from '@/server/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

const schema = z.object({
  toPath: z.string().min(1).max(500).refine(isSafeTarget, 'Use a site path or a full http(s) URL.').optional(),
  status: z.union([z.literal(301), z.literal(302)]).optional(),
  isActive: z.boolean().optional(),
  note: z.string().max(300).optional(),
});

export async function PATCH(request: Request, context: Context) {
  return handle(async () => {
    const guard = await requireUser(request, 'redirects:write');
    if (!guard.ok) return guard.response;

    const { id } = await context.params;
    const [row] = await db.select().from(redirects).where(eq(redirects.id, id)).limit(1);
    if (!row) return notFound('That redirect does not exist.');

    const parsed = await readJson(request, schema);
    if (!parsed.ok) return parsed.response;

    if (parsed.data.toPath && normalisePath(parsed.data.toPath) === row.fromPath) {
      return badRequest('A redirect cannot point at the path it comes from.');
    }

    const [updated] = await db
      .update(redirects)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(redirects.id, id))
      .returning();

    // Enabling, disabling or repointing changes what that path does.
    revalidateContent([row.fromPath]);

    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: 'redirect.update',
      targetType: 'redirect',
      targetId: id,
      summary: `Updated the redirect from ${row.fromPath}`,
      ip: clientIp(request.headers),
    });

    return ok(updated);
  });
}

export async function DELETE(request: Request, context: Context) {
  return handle(async () => {
    const guard = await requireUser(request, 'redirects:write');
    if (!guard.ok) return guard.response;

    const { id } = await context.params;
    const [row] = await db.select().from(redirects).where(eq(redirects.id, id)).limit(1);
    if (!row) return notFound('That redirect does not exist.');

    await db.delete(redirects).where(eq(redirects.id, id));
    revalidateContent([row.fromPath]);

    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: 'redirect.delete',
      targetType: 'redirect',
      targetId: id,
      summary: `Deleted the redirect from ${row.fromPath} to ${row.toPath}`,
      ip: clientIp(request.headers),
    });

    return noContent();
  });
}
