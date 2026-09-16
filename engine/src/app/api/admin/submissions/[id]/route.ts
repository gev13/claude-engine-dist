import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { handle, noContent, notFound } from '@/server/api/respond';
import { requireUser } from '@/server/api/guard';
import { audit } from '@/server/auth/audit';
import { clientIp } from '@/server/auth/rateLimit';
import type { Answer } from '@/lib/forms';
import { deleteStoredFile } from '@/server/applications/storage';
import { db } from '@/server/db';
import { formSubmissions } from '@/server/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/**
 * Erases a form submission for good, as a newsletter sign-up is erased: there
 * is no trash for personal data someone asked to have removed.
 */
export async function DELETE(request: Request, ctx: Ctx) {
  return handle(async () => {
    const guard = await requireUser(request, 'submissions:write');
    if (!guard.ok) return guard.response;

    const { id } = await ctx.params;
    if (!z.string().uuid().safeParse(id).success) return notFound('That submission no longer exists.');

    const [row] = await db
      .delete(formSubmissions)
      .where(eq(formSubmissions.id, id))
      .returning({
        id: formSubmissions.id,
        formName: formSubmissions.formName,
        answers: formSubmissions.answers,
      });
    if (!row) return notFound('That submission no longer exists.');

    /* A database cannot unlink. The answers were returned by the delete for
       exactly this: afterwards nothing says which files were this
       submission's, and they would sit in the directory for ever. */
    for (const answer of (row.answers ?? []) as Answer[]) {
      if (answer.file?.name) await deleteStoredFile(answer.file.name);
    }

    // The answers stay out of the audit log, which is append-only.
    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: 'form.submission.delete',
      targetType: 'submission',
      targetId: row.id,
      summary: `Deleted a submission to “${row.formName}”`,
      ip: clientIp(request.headers),
    });

    return noContent();
  });
}
