import { toCsv } from '@/lib/csv';
import { describeFrom, describeTo, type MatchType } from '@/lib/redirectRules';
import { handle } from '@/server/api/respond';
import { requireUser } from '@/server/api/guard';
import { audit } from '@/server/auth/audit';
import { clientIp } from '@/server/auth/rateLimit';
import { listRedirects } from '@/server/content/redirects';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Every rule as `from,to,status,note,active,hits,last hit` — the first four
 * columns are exactly what the import reads, so an export edited in a
 * spreadsheet imports back as it stands.
 */
export async function GET(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'redirects:read');
    if (!guard.ok) return guard.response;

    const rows = await listRedirects();
    const csv = toCsv(
      ['from', 'to', 'status', 'note', 'active', 'hits', 'last hit'],
      rows.map((row) => [
        describeFrom({ ...row, matchType: row.matchType as MatchType }),
        describeTo({ ...row, matchType: row.matchType as MatchType }),
        row.status,
        row.note,
        row.isActive ? 'yes' : 'no',
        row.hits,
        row.lastHitAt,
      ]),
    );

    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: 'redirect.export',
      targetType: 'redirect',
      summary: `Exported ${rows.length} redirect${rows.length === 1 ? '' : 's'}`,
      ip: clientIp(request.headers),
    });

    return new Response(csv, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="redirects-${new Date().toISOString().slice(0, 10)}.csv"`,
        'cache-control': 'no-store',
      },
    });
  });
}
