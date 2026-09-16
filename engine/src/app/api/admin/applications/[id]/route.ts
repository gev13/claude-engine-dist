import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { handle, noContent, notFound, ok, readJson } from '@/server/api/respond';
import { requireUser } from '@/server/api/guard';
import { audit } from '@/server/auth/audit';
import { clientIp } from '@/server/auth/rateLimit';
import { db } from '@/server/db';
import { applications } from '@/server/db/schema';
import { deleteCv } from '@/server/applications/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  status: z.enum(['new', 'read', 'shortlisted', 'rejected']),
});

/** GET — one application, with the covering letter the list leaves out. */
export async function GET(request: Request, ctx: Ctx) {
  return handle(async () => {
    const guard = await requireUser(request, 'applications:read');
    if (!guard.ok) return guard.response;

    const { id } = await ctx.params;
    const [row] = await db.select().from(applications).where(eq(applications.id, id)).limit(1);
    if (!row) return notFound('That application no longer exists.');

    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: 'application.read',
      targetType: 'application',
      targetId: row.id,
      summary: `Opened an application for "${row.jobTitle}"`,
      ip: clientIp(request.headers),
    });

    return ok(row);
  });
}

/**
 * PUT — move an application through the pipeline.
 *
 * Deliberately `applications:read`, not `:write`. Marking somebody as
 * shortlisted is the everyday work of whoever handles applications; `:write`
 * is reserved for erasing personal data, which is not the same job.
 */
export async function PUT(request: Request, ctx: Ctx) {
  return handle(async () => {
    const guard = await requireUser(request, 'applications:read');
    if (!guard.ok) return guard.response;

    const { id } = await ctx.params;
    const parsed = await readJson(request, updateSchema);
    if (!parsed.ok) return parsed.response;

    const [row] = await db.select().from(applications).where(eq(applications.id, id)).limit(1);
    if (!row) return notFound('That application no longer exists.');

    const [updated] = await db
      .update(applications)
      .set({ status: parsed.data.status })
      .where(eq(applications.id, id))
      .returning();

    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: 'application.status',
      targetType: 'application',
      targetId: row.id,
      // The applicant's name and letter stay out of the log, as everywhere else.
      summary: `Moved an application for "${row.jobTitle}" to ${parsed.data.status}`,
      metadata: { from: row.status, to: parsed.data.status },
      ip: clientIp(request.headers),
    });

    return ok(updated);
  });
}

/**
 * DELETE — erase an application, and the CV with it.
 *
 * There is no trash. An application is personal data given for one purpose,
 * so "delete" means gone: the row, and the file the database cannot unlink.
 * Admin-only, like every other erasure of personal data.
 */
export async function DELETE(request: Request, ctx: Ctx) {
  return handle(async () => {
    const guard = await requireUser(request, 'applications:write');
    if (!guard.ok) return guard.response;

    const { id } = await ctx.params;
    const [row] = await db.select().from(applications).where(eq(applications.id, id)).limit(1);
    if (!row) return notFound('That application no longer exists.');

    // File first: once the row is gone nothing says which file was its CV.
    if (row.cvFilename) await deleteCv(row.cvFilename);
    await db.delete(applications).where(eq(applications.id, id));

    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: 'application.delete',
      targetType: 'application',
      targetId: row.id,
      summary: `Erased an application for "${row.jobTitle}"`,
      ip: clientIp(request.headers),
    });

    return noContent();
  });
}
