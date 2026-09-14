import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { handle, noContent, notFound, ok, readJson } from '@/server/api/respond';
import { requireUser } from '@/server/api/guard';
import { audit } from '@/server/auth/audit';
import { clientIp } from '@/server/auth/rateLimit';
import { db } from '@/server/db';
import { enquiries } from '@/server/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

const updateSchema = z.object({ status: z.enum(['new', 'read', 'replied', 'spam']) });

export async function GET(request: Request, ctx: Ctx) {
  return handle(async () => {
    const guard = await requireUser(request, 'enquiries:read');
    if (!guard.ok) return guard.response;

    const { id } = await ctx.params;
    const [row] = await db.select().from(enquiries).where(eq(enquiries.id, id)).limit(1);
    if (!row) return notFound('That enquiry no longer exists.');

    // Reading an enquiry is a read of someone's contact details, so it is
    // audited — the spec requires every external sensitive read to be logged.
    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: 'enquiry.read',
      targetType: 'enquiry',
      targetId: row.id,
      summary: `Viewed enquiry from ${row.company || row.name}`,
      ip: clientIp(request.headers),
    });

    return ok(row);
  });
}

export async function PATCH(request: Request, ctx: Ctx) {
  return handle(async () => {
    const guard = await requireUser(request, 'enquiries:write');
    if (!guard.ok) return guard.response;

    const { id } = await ctx.params;
    const parsed = await readJson(request, updateSchema);
    if (!parsed.ok) return parsed.response;

    const [row] = await db
      .update(enquiries)
      .set({ status: parsed.data.status })
      .where(eq(enquiries.id, id))
      .returning();
    if (!row) return notFound('That enquiry no longer exists.');

    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: 'enquiry.status',
      targetType: 'enquiry',
      targetId: row.id,
      summary: `Marked enquiry from ${row.company || row.name} as ${parsed.data.status}`,
      ip: clientIp(request.headers),
    });

    return ok(row);
  });
}

export async function DELETE(request: Request, ctx: Ctx) {
  return handle(async () => {
    const guard = await requireUser(request, 'enquiries:write');
    if (!guard.ok) return guard.response;

    const { id } = await ctx.params;
    const [row] = await db.select().from(enquiries).where(eq(enquiries.id, id)).limit(1);
    if (!row) return notFound('That enquiry no longer exists.');

    await db.delete(enquiries).where(eq(enquiries.id, id));

    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: 'enquiry.delete',
      targetType: 'enquiry',
      targetId: row.id,
      summary: `Deleted enquiry from ${row.company || row.name}`,
      ip: clientIp(request.headers),
    });

    return noContent();
  });
}
