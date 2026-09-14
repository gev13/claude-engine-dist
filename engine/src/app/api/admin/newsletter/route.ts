import { desc, ilike, sql } from 'drizzle-orm';
import { toCsv } from '@/lib/csv';
import { readListParams } from '@/server/api/schemas';
import { handle, ok } from '@/server/api/respond';
import { requireUser } from '@/server/api/guard';
import { audit } from '@/server/auth/audit';
import { clientIp } from '@/server/auth/rateLimit';
import { db } from '@/server/db';
import { newsletterSubscribers } from '@/server/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return handle(async () => {
    const url = new URL(request.url);

    if (url.searchParams.get('format') === 'csv') {
      // An export hands every address to whoever downloads it, so it is
      // admin-only and audited, like any other bulk read of personal data.
      const guard = await requireUser(request, 'newsletter:write');
      if (!guard.ok) return guard.response;

      const rows = await db.select().from(newsletterSubscribers).orderBy(desc(newsletterSubscribers.createdAt));

      await audit({
        actorId: guard.user.id,
        actorEmail: guard.user.email,
        action: 'newsletter.export',
        targetType: 'subscriber',
        summary: `Exported ${rows.length} newsletter sign-up${rows.length === 1 ? '' : 's'}`,
        ip: clientIp(request.headers),
      });

      const csv = toCsv(
        ['email', 'signed_up', 'consent_given', 'source'],
        rows.map((r) => [r.email, r.createdAt, r.consentAt ?? '', r.source]),
      );
      const date = new Date().toISOString().slice(0, 10);
      return new Response(csv, {
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': `attachment; filename="newsletter-${date}.csv"`,
          'cache-control': 'no-store',
        },
      });
    }

    const guard = await requireUser(request, 'newsletter:read');
    if (!guard.ok) return guard.response;

    const { page, perPage, offset, q } = readListParams(url);
    const where = q ? ilike(newsletterSubscribers.email, `%${q}%`) : undefined;

    const [items, [count]] = await Promise.all([
      db
        .select({
          id: newsletterSubscribers.id,
          email: newsletterSubscribers.email,
          source: newsletterSubscribers.source,
          consentAt: newsletterSubscribers.consentAt,
          createdAt: newsletterSubscribers.createdAt,
        })
        .from(newsletterSubscribers)
        .where(where)
        .orderBy(desc(newsletterSubscribers.createdAt))
        .limit(perPage)
        .offset(offset),
      db.select({ n: sql<number>`count(*)::int` }).from(newsletterSubscribers).where(where),
    ]);

    return ok({ items, total: count?.n ?? 0, page, perPage });
  });
}
