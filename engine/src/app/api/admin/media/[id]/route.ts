import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/server/db';
import { media } from '@/server/db/schema';
import { audit } from '@/server/auth/audit';
import { clientIp } from '@/server/auth/rateLimit';
import { requireUser } from '@/server/api/guard';
import { badRequest, handle, noContent, notFound, ok, readJson } from '@/server/api/respond';
import { deleteStored } from '@/server/media/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

/** Only the descriptive fields are editable — bytes, path and checksum are not. */
const patchSchema = z
  .object({
    altText: z.string().max(300).optional(),
    caption: z.string().max(2000).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update.' });

const idSchema = z.string().uuid();

export async function PATCH(request: Request, { params }: Params) {
  return handle(async () => {
    const guard = await requireUser(request, 'media:write');
    if (!guard.ok) return guard.response;

    const { id } = await params;
    if (!idSchema.safeParse(id).success) return notFound('That file does not exist.');

    const parsed = await readJson(request, patchSchema);
    if (!parsed.ok) return parsed.response;

    const [row] = await db.select().from(media).where(eq(media.id, id)).limit(1);
    if (!row) return notFound('That file does not exist.');

    const [updated] = await db
      .update(media)
      .set({
        ...(parsed.data.altText !== undefined ? { altText: parsed.data.altText.trim() } : {}),
        ...(parsed.data.caption !== undefined ? { caption: parsed.data.caption.trim() } : {}),
      })
      .where(eq(media.id, id))
      .returning();

    if (!updated) return notFound('That file does not exist.');

    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: 'media.update',
      targetType: 'media',
      targetId: updated.id,
      summary: `Updated details for "${updated.originalName}"`,
      metadata: { fields: Object.keys(parsed.data) },
      ip: clientIp(request.headers),
    });

    return ok(updated);
  });
}

export async function DELETE(request: Request, { params }: Params) {
  return handle(async () => {
    const guard = await requireUser(request, 'media:delete');
    if (!guard.ok) return guard.response;

    const { id } = await params;
    if (!idSchema.safeParse(id).success) return notFound('That file does not exist.');

    const [row] = await db.select().from(media).where(eq(media.id, id)).limit(1);
    if (!row) return notFound('That file does not exist.');

    // Remove the bytes first: a failure here must not leave a row pointing at a
    // file nobody can delete through the admin any more.
    try {
      await deleteStored(row.filename);
    } catch (error) {
      console.error('[media] failed to delete stored file', { filename: row.filename, error });
      return badRequest('The file could not be removed from disk. Nothing was deleted.');
    }

    await db.delete(media).where(eq(media.id, id));

    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: 'media.delete',
      targetType: 'media',
      targetId: row.id,
      summary: `Deleted "${row.originalName}"`,
      metadata: { filename: row.filename },
      ip: clientIp(request.headers),
    });

    return noContent();
  });
}
