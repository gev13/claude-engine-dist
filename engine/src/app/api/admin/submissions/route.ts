import { desc, eq, sql } from 'drizzle-orm';
import { toCsv } from '@/lib/csv';
import { answerText } from '@/lib/forms';
import { readListParams } from '@/server/api/schemas';
import { badRequest, handle, ok } from '@/server/api/respond';
import { requireUser } from '@/server/api/guard';
import { audit } from '@/server/auth/audit';
import { clientIp } from '@/server/auth/rateLimit';
import { db } from '@/server/db';
import { formSubmissions } from '@/server/db/schema';

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
      const csv = toCsv(
        ['sent', 'page', ...labels],
        rows.map((r) => [r.createdAt, r.source, ...labels.map((label) => answerText(r.answers.find((a) => a.label === label)?.value ?? ''))]),
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

    return ok({ items, total: count?.n ?? 0, page, perPage, forms });
  });
}
