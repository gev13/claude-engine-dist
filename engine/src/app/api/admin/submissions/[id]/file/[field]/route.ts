import { readFile } from 'node:fs/promises';
import { eq } from 'drizzle-orm';
import { handle, notFound } from '@/server/api/respond';
import { requireUser } from '@/server/api/guard';
import { audit } from '@/server/auth/audit';
import { clientIp } from '@/server/auth/rateLimit';
import type { Answer } from '@/lib/forms';
import { db } from '@/server/db';
import { formSubmissions } from '@/server/db/schema';
import {
  isSafeStoredName,
  storedContentType,
  storedPath,
  type AllowedExtension,
} from '@/server/applications/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string; field: string }> };

/* ═══════════════════════════════════════════════════════════════════════════
   Downloading a form attachment
   ───────────────────────────────────────────────────────────────────────────
   The same shape as the CV route, and for the same reasons: the permission is
   checked, the stored name is re-checked against the generated-name pattern
   before it touches the filesystem, and the download is audited.

   The one difference worth naming: the filename is never taken from the URL.
   The URL names a *question*, and the answer to that question says which file
   it is — so a caller cannot ask for a file by guessing its name, only for
   the file that a submission they can already read happens to hold.
   ═══════════════════════════════════════════════════════════════════════════ */

export async function GET(request: Request, ctx: Ctx) {
  return handle(async () => {
    const guard = await requireUser(request, 'submissions:read');
    if (!guard.ok) return guard.response;

    const { id, field } = await ctx.params;
    const [row] = await db
      .select({
        id: formSubmissions.id,
        formName: formSubmissions.formName,
        answers: formSubmissions.answers,
      })
      .from(formSubmissions)
      .where(eq(formSubmissions.id, id))
      .limit(1);

    if (!row) return notFound('That submission no longer exists.');

    const answer = ((row.answers ?? []) as Answer[]).find((a) => a.id === field);
    const stored = answer?.file?.name;
    if (!stored || !isSafeStoredName(stored)) return notFound('There is no file on that answer.');

    const full = storedPath(stored);
    if (!full) return notFound('There is no file on that answer.');

    const bytes = await readFile(full).catch(() => null);
    if (!bytes) return notFound('That file is no longer on disk.');

    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: 'form.submission.file',
      targetType: 'submission',
      targetId: row.id,
      summary: `Downloaded an attachment from a submission to “${row.formName}”`,
      ip: clientIp(request.headers),
    });

    const extension = stored.split('.').pop() as AllowedExtension;
    /* The visitor's own filename never reached the filesystem; here it is
       quoted into a header, so anything that could break out of the quotes
       goes. */
    const suggested = (answer?.file?.originalName || `attachment.${extension}`).replace(/[^\w .\-()]+/g, '');

    return new Response(new Uint8Array(bytes), {
      headers: {
        'Content-Type': storedContentType(extension),
        'Content-Length': String(bytes.byteLength),
        /* An attachment, never inline — a PDF is a scripting host and this is
           somebody else's file. The sandbox policy says so a second time. */
        'Content-Disposition': `attachment; filename="${suggested}"`,
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
        'Cache-Control': 'private, no-store',
      },
    });
  });
}
