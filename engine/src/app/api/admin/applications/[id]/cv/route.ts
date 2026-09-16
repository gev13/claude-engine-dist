import { readFile } from 'node:fs/promises';
import { eq } from 'drizzle-orm';
import { handle, notFound } from '@/server/api/respond';
import { requireUser } from '@/server/api/guard';
import { audit } from '@/server/auth/audit';
import { clientIp } from '@/server/auth/rateLimit';
import { db } from '@/server/db';
import { applications } from '@/server/db/schema';
import { cvContentType, cvPath, isSafeCvName, type AllowedCvExtension } from '@/server/applications/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/* ═══════════════════════════════════════════════════════════════════════════
   Downloading a CV
   ───────────────────────────────────────────────────────────────────────────
   The only way to reach the applications directory, and the reason it is not
   the media library. Three things hold it up:

     • the permission is checked, like every admin route;
     • the filename comes from the database and is re-checked against the
       generated-name pattern before it touches the filesystem — a stored
       value is still a value, and `cvPath` returns null for anything that
       tries to leave the directory;
     • every download is audited, because reading somebody's CV is an event
       worth being able to account for.

   Served as an attachment with `nosniff` and a sandbox policy: a PDF is a
   scripting host, and this is somebody else's file.
   ═══════════════════════════════════════════════════════════════════════════ */

export async function GET(request: Request, ctx: Ctx) {
  return handle(async () => {
    const guard = await requireUser(request, 'applications:read');
    if (!guard.ok) return guard.response;

    const { id } = await ctx.params;
    const [row] = await db
      .select({
        id: applications.id,
        jobTitle: applications.jobTitle,
        cvFilename: applications.cvFilename,
        cvOriginalName: applications.cvOriginalName,
      })
      .from(applications)
      .where(eq(applications.id, id))
      .limit(1);

    if (!row?.cvFilename || !isSafeCvName(row.cvFilename)) return notFound('There is no CV on that application.');

    const full = cvPath(row.cvFilename);
    if (!full) return notFound('There is no CV on that application.');

    const bytes = await readFile(full).catch(() => null);
    if (!bytes) return notFound('That CV is no longer on disk.');

    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: 'application.cv.download',
      targetType: 'application',
      targetId: row.id,
      summary: `Downloaded a CV from an application for "${row.jobTitle}"`,
      ip: clientIp(request.headers),
    });

    const extension = row.cvFilename.split('.').pop() as AllowedCvExtension;
    /* The applicant's own filename is display-only and never reached the
       filesystem; here it is quoted into a header, so anything that could
       break out of the quotes goes. */
    const suggested = (row.cvOriginalName || `cv.${extension}`).replace(/[^\w .\-()]+/g, '');

    return new Response(new Uint8Array(bytes), {
      headers: {
        'Content-Type': cvContentType(extension),
        'Content-Length': String(bytes.byteLength),
        'Content-Disposition': `attachment; filename="${suggested}"`,
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
        // Never a shared cache: this is one person's file, behind a session.
        'Cache-Control': 'private, no-store',
      },
    });
  });
}
