import { z } from 'zod';
import { and, desc, eq, ilike, or, sql, type SQL } from 'drizzle-orm';
import { readListParams } from '@/server/api/schemas';
import { handle, ok, readJson } from '@/server/api/respond';
import { requireUser } from '@/server/api/guard';
import { audit } from '@/server/auth/audit';
import { clientIp } from '@/server/auth/rateLimit';
import { db } from '@/server/db';
import { applications, jobs } from '@/server/db/schema';
import { getRetention, saveRetention, sweep } from '@/server/retention';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* ═══════════════════════════════════════════════════════════════════════════
   The applications inbox
   ───────────────────────────────────────────────────────────────────────────
   Every row here is a named person's contact details and CV, so this route
   follows the contact enquiries rather than the job advert it answers: the
   *read* is audited, because reading personal data is an event worth
   recording, and the covering letter is left out of the list — it is fetched
   only when somebody opens one application, so a page of twenty does not put
   twenty people's letters through the network to render six words of each.
   ═══════════════════════════════════════════════════════════════════════════ */

export async function GET(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'applications:read');
    if (!guard.ok) return guard.response;

    const url = new URL(request.url);
    const { page, perPage, offset, q } = readListParams(url);
    const jobId = url.searchParams.get('job') ?? '';
    const status = url.searchParams.get('status') ?? '';

    const filters: SQL[] = [];
    if (q) {
      filters.push(
        or(
          ilike(applications.name, `%${q}%`),
          ilike(applications.email, `%${q}%`),
          ilike(applications.jobTitle, `%${q}%`),
        )!,
      );
    }
    if (/^[0-9a-f-]{36}$/i.test(jobId)) filters.push(eq(applications.jobId, jobId));
    if (status === 'new' || status === 'read' || status === 'shortlisted' || status === 'rejected') {
      filters.push(eq(applications.status, status));
    }

    /* The other half of the sweep's trigger: somebody looking at the inbox.
       Awaited here, unlike on the public form, so the list that comes back
       does not include rows this request is about to delete. */
    await sweep('applications');

    const where = filters.length ? and(...filters) : undefined;

    const [items, [count]] = await Promise.all([
      db
        .select({
          id: applications.id,
          jobId: applications.jobId,
          jobTitle: applications.jobTitle,
          jobSlug: jobs.slug,
          name: applications.name,
          email: applications.email,
          phone: applications.phone,
          cvFilename: applications.cvFilename,
          cvOriginalName: applications.cvOriginalName,
          cvBytes: applications.cvBytes,
          status: applications.status,
          createdAt: applications.createdAt,
        })
        .from(applications)
        .leftJoin(jobs, eq(jobs.id, applications.jobId))
        .where(where)
        .orderBy(desc(applications.createdAt))
        .limit(perPage)
        .offset(offset),
      db.select({ n: sql<number>`count(*)::int` }).from(applications).where(where),
    ]);

    /* Audited like the contact enquiries: the log records that somebody read
       the inbox and how much of it, never who applied or what they said. */
    if (items.length > 0) {
      await audit({
        actorId: guard.user.id,
        actorEmail: guard.user.email,
        action: 'application.read',
        targetType: 'application',
        summary: `Viewed ${items.length} application${items.length === 1 ? '' : 's'}`,
        metadata: { page, jobId: jobId || null, status: status || null },
        ip: clientIp(request.headers),
      });
    }

    return ok({ items, total: count?.n ?? 0, page, perPage, retention: await getRetention('applications') });
  });
}

/**
 * PUT — how long applications are kept.
 *
 * `applications:write`, not `:read`: this governs the erasure of personal
 * data, which is the administrator's decision, and shortening it deletes CVs
 * on the next sweep. Saving runs that sweep immediately rather than waiting
 * six hours, so an administrator who has just shortened the period can see it
 * take effect.
 */
export async function PUT(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'applications:write');
    if (!guard.ok) return guard.response;

    const parsed = await readJson(request, z.object({ days: z.number().int().min(0).max(3650) }));
    if (!parsed.ok) return parsed.response;

    const current = await getRetention('applications');
    const next = await saveRetention('applications', { ...current, days: parsed.data.days }, guard.user.id);
    const swept = await sweep('applications', { force: true });

    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: 'applications.retention',
      targetType: 'settings',
      targetId: 'applications',
      summary:
        next.days === 0
          ? 'Switched off automatic deletion of applications'
          : `Applications are now kept for ${next.days} days`,
      metadata: { from: current.days, to: next.days, removed: swept.removed },
      ip: clientIp(request.headers),
    });

    return ok({ retention: await getRetention('applications'), removed: swept.removed });
  });
}
