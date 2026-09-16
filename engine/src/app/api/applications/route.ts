import { z } from 'zod';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { audit } from '@/server/auth/audit';
import { clientIp, rateLimit } from '@/server/auth/rateLimit';
import { badRequest, handle, ok } from '@/server/api/respond';
import { refuseIfBlocked, refuseRateLimited } from '@/server/security/guard';
import { db } from '@/server/db';
import { applications, jobs } from '@/server/db/schema';
import { ApplicationFileError, CV_SUPPORTED, saveCv } from '@/server/applications/storage';
import { notifyApplication } from '@/server/mail/notify';
import { sweep } from '@/server/retention';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* ═══════════════════════════════════════════════════════════════════════════
   Applying for a role
   ───────────────────────────────────────────────────────────────────────────
   The only public endpoint in the engine that accepts a file, so it is also
   the only one where a request can cost real disk. Four gates, in this order,
   and the order matters: an address on the blocklist should never reach the
   rate limiter's table, and neither should ever reach the parser that has to
   buffer a multipart body.

     1. the blocklist, before anything is read;
     2. the rate limiter — five applications an hour from one address, which
        is generous for a person and useless to a script;
     3. the honeypot, which costs nothing and catches most of the rest;
     4. the job itself, looked up published-and-open, so a closed role cannot
        be applied to by replaying an old form.

   Only then is the file read. It is checked by its bytes, not its name, and
   stored outside the media library — see `server/applications/storage.ts`.
   ═══════════════════════════════════════════════════════════════════════════ */

const fields = z.object({
  jobId: z.string().uuid(),
  name: z.string().trim().min(1, 'Your name is needed.').max(200),
  email: z.string().trim().email('That email address does not look right.').max(255),
  phone: z.string().trim().max(60).optional().default(''),
  coverLetter: z.string().trim().max(8000).optional().default(''),
  /** Honeypot. Real people never see this field, so anything in it is a bot. */
  website: z.string().max(200).optional(),
});

export async function POST(request: Request) {
  return handle(async () => {
    const ip = clientIp(request.headers);

    const refused = await refuseIfBlocked(ip);
    if (refused) return refused;

    const limit = await rateLimit({ key: `apply:${ip}`, limit: 5, windowSec: 3600, blockSec: 3600 });
    if (!limit.allowed) {
      return refuseRateLimited(
        ip,
        'job applications',
        limit.retryAfter,
        'Too many applications sent from this connection. Try again later.',
      );
    }

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return badRequest('That form could not be read. Reload the page and try again.');
    }

    const parsed = fields.safeParse({
      jobId: form.get('jobId') ?? '',
      name: form.get('name') ?? '',
      email: form.get('email') ?? '',
      phone: form.get('phone') ?? '',
      coverLetter: form.get('coverLetter') ?? '',
      website: form.get('website') ?? '',
    });

    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? 'Some fields need attention.');
    }
    const input = parsed.data;

    // Silently accept and discard: telling a bot it was detected only helps it.
    if (input.website && input.website.trim() !== '') return ok({ ok: true });

    /* Published, not deleted, past its publish date, and open. A closed role's
       page does not render the form — this is what stops the form being
       replayed after it closes. */
    const [job] = await db
      .select({ id: jobs.id, title: jobs.title })
      .from(jobs)
      .where(
        and(
          eq(jobs.id, input.jobId),
          eq(jobs.status, 'published'),
          eq(jobs.isOpen, true),
          isNull(jobs.deletedAt),
          sql`${jobs.publishedAt} is not null and ${jobs.publishedAt} <= now()`,
        ),
      )
      .limit(1);

    if (!job) return badRequest('That role is no longer taking applications.');

    const file = form.get('cv');
    if (!(file instanceof File) || file.size === 0) {
      return badRequest(`A CV is needed. ${CV_SUPPORTED}`);
    }

    let stored;
    try {
      stored = await saveCv(file);
    } catch (caught) {
      /* `ApplicationFileError` messages are written to be shown to an
         applicant — "larger than 8 MB", not a path or a stack. Anything else
         is ours and must not be described to the public. */
      if (caught instanceof ApplicationFileError) return badRequest(caught.message);
      throw caught;
    }

    const [row] = await db
      .insert(applications)
      .values({
        jobId: job.id,
        // Kept beside the id, so a deleted advert still names itself in the inbox.
        jobTitle: job.title,
        name: input.name,
        email: input.email,
        phone: input.phone,
        coverLetter: input.coverLetter,
        cvFilename: stored.filename,
        cvOriginalName: stored.originalName,
        cvBytes: stored.bytes,
        ip,
        userAgent: (request.headers.get('user-agent') ?? '').slice(0, 400),
      })
      .returning({ id: applications.id });

    /* That somebody applied, never who: a name, an email and a covering letter
       are personal data, and the audit log is append-only and admin-readable.
       The same rule the enquiries and form submissions follow. */
    await audit({
      action: 'application.received',
      targetType: 'application',
      targetId: row?.id,
      summary: `New application for “${job.title}”`,
      metadata: { jobId: job.id, cvBytes: stored.bytes },
      ip,
    });

    notifyApplication({ jobTitle: job.title, name: input.name, email: input.email, hasCv: true });

    /* The retention sweep, throttled to once every six hours and never
       thrown: this engine has no scheduler, so the honest trigger is the
       traffic the site already has — and an applicant must never see a
       failure because a tidy-up went wrong behind them. */
    void sweep('applications');

    return ok({ ok: true });
  });
}
