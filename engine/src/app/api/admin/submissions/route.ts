import { z } from 'zod';
import { desc, eq, sql } from 'drizzle-orm';
import { toCsv } from '@/lib/csv';
import { answerLine } from '@/lib/forms';
import { readListParams } from '@/server/api/schemas';
import { badRequest, handle, ok, readJson } from '@/server/api/respond';
import { requireUser } from '@/server/api/guard';
import { audit } from '@/server/auth/audit';
import { clientIp } from '@/server/auth/rateLimit';
import { db } from '@/server/db';
import { formSubmissions } from '@/server/db/schema';
import { getRetention, saveRetention, sweep } from '@/server/retention';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Form submissions (P3-E): a page of them, optionally for one form, or one
 * form's submissions as a CSV. Answers are personal data, so the export is
 * admin-only and audited, as the newsletter's is.
 */
export async function GET(request: Request) {
  return handle(async () => {
    const url = new URL(request.url);
    const formName = url.searchParams.get('form')?.slice(0, 120) || undefined;
    const where = formName ? eq(formSubmissions.formName, formName) : undefined;

    if (url.searchParams.get('format') === 'csv') {
      const guard = await requireUser(request, 'submissions:write');
      if (!guard.ok) return guard.response;
      if (!formName) return badRequest('Choose one form to export.');

      const rows = await db.select().from(formSubmissions).where(where).orderBy(desc(formSubmissions.createdAt));

      await audit({
        actorId: guard.user.id,
        actorEmail: guard.user.email,
        action: 'form.export',
        targetType: 'submission',
        summary: `Exported ${rows.length} submission${rows.length === 1 ? '' : 's'} to “${formName}”`,
        ip: clientIp(request.headers),
      });

      // Every question any submission was asked, in the order they first appear.
      const labels = [...new Set(rows.flatMap((r) => r.answers.map((a) => a.label)))];
      // And every hidden field any of them carried (2.16), after the answers.
      const hiddenNames = [...new Set(rows.flatMap((r) => Object.keys(r.meta ?? {})))];
      const csv = toCsv(
        ['sent', 'page', ...labels, ...hiddenNames],
        /* `answerLine` so the export names the file a visitor sent rather
           than showing an empty cell where an attachment was. The file itself
           is not in the CSV: an export is a spreadsheet, not an archive. */
        rows.map((r) => [
          r.createdAt,
          r.source,
          ...labels.map((label) => {
            const answer = r.answers.find((a) => a.label === label);
            return answer ? answerLine(answer) : '';
          }),
          ...hiddenNames.map((name) => r.meta?.[name] ?? ''),
        ]),
      );
      const date = new Date().toISOString().slice(0, 10);
      const slug = formName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'form';
      return new Response(csv, {
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': `attachment; filename="${slug}-${date}.csv"`,
          'cache-control': 'no-store',
        },
      });
    }

    const guard = await requireUser(request, 'submissions:read');
    if (!guard.ok) return guard.response;

    /* One half of the sweep's trigger: somebody looking at the inbox. Awaited,
       so the page that comes back never lists rows this request is about to
       delete. */
    await sweep('submissions');

    const { page, perPage, offset } = readListParams(url);
    const [items, [count], forms] = await Promise.all([
      db.select().from(formSubmissions).where(where).orderBy(desc(formSubmissions.createdAt)).limit(perPage).offset(offset),
      db.select({ n: sql<number>`count(*)::int` }).from(formSubmissions).where(where),
      db
        .select({ name: formSubmissions.formName, n: sql<number>`count(*)::int` })
        .from(formSubmissions)
        .groupBy(formSubmissions.formName)
        .orderBy(formSubmissions.formName),
    ]);

    return ok({
      items,
      total: count?.n ?? 0,
      page,
      perPage,
      forms,
      retention: await getRetention('submissions'),
    });
  });
}

/**
 * PUT — how long form submissions are kept.
 *
 * `submissions:write`, the same permission that exports and erases them: this
 * governs the deletion of personal data, and a submission can now carry a
 * file, so shortening the period unlinks those too. Saving runs the sweep at
 * once rather than waiting six hours, so the effect is visible immediately.
 */
export async function PUT(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'submissions:write');
    if (!guard.ok) return guard.response;

    const parsed = await readJson(request, z.object({ days: z.number().int().min(0).max(3650) }));
    if (!parsed.ok) return parsed.response;

    const current = await getRetention('submissions');
    const next = await saveRetention('submissions', { ...current, days: parsed.data.days }, guard.user.id);
    const swept = await sweep('submissions', { force: true });

    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: 'submissions.retention',
      targetType: 'settings',
      targetId: 'submissions',
      summary:
        next.days === 0
          ? 'Switched off automatic deletion of form submissions'
          : `Form submissions are now kept for ${next.days} days`,
      metadata: { from: current.days, to: next.days, removed: swept.removed },
      ip: clientIp(request.headers),
    });

    return ok({ retention: await getRetention('submissions'), removed: swept.removed });
  });
}
