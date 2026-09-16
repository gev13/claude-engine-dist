import { z } from 'zod';
import { and, desc, eq, ilike, or, sql, type SQL } from 'drizzle-orm';
import { readListParams } from '@/server/api/schemas';
import { handle, ok, readJson } from '@/server/api/respond';
import { requireUser } from '@/server/api/guard';
import { db } from '@/server/db';
import { enquiries } from '@/server/db/schema';
import { audit } from '@/server/auth/audit';
import { clientIp } from '@/server/auth/rateLimit';
import { getRetention, saveRetention, sweep } from '@/server/retention';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'enquiries:read');
    if (!guard.ok) return guard.response;

    const { page, perPage, offset, q, status } = readListParams(new URL(request.url));

    const filters: SQL[] = [];
    if (q) {
      filters.push(
        or(ilike(enquiries.name, `%${q}%`), ilike(enquiries.email, `%${q}%`), ilike(enquiries.company, `%${q}%`))!,
      );
    }
    if (status === 'new' || status === 'read' || status === 'replied' || status === 'spam') {
      filters.push(eq(enquiries.status, status));
    }
    /* One half of the sweep's trigger: somebody looking at the inbox. Awaited,
       so the page never lists rows it is about to delete. */
    await sweep('enquiries');

    const where = filters.length ? and(...filters) : undefined;

    const [items, [count], [unread]] = await Promise.all([
      db.select().from(enquiries).where(where).orderBy(desc(enquiries.createdAt)).limit(perPage).offset(offset),
      db.select({ n: sql<number>`count(*)::int` }).from(enquiries).where(where),
      db.select({ n: sql<number>`count(*)::int` }).from(enquiries).where(eq(enquiries.status, 'new')),
    ]);

    return ok({
      items,
      total: count?.n ?? 0,
      page,
      perPage,
      unread: unread?.n ?? 0,
      retention: await getRetention('enquiries'),
    });
  });
}

/**
 * PUT — how long contact enquiries are kept.
 *
 * `enquiries:write` is the same permission that marks one read or replied —
 * broader than the export/erase split the newsletter and submissions use,
 * because there is no separate erase permission for this table. Worth knowing
 * when tightening: this is the one retention period a reviewer can change.
 */
export async function PUT(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'enquiries:write');
    if (!guard.ok) return guard.response;

    const parsed = await readJson(request, z.object({ days: z.number().int().min(0).max(3650) }));
    if (!parsed.ok) return parsed.response;

    const current = await getRetention('enquiries');
    const next = await saveRetention('enquiries', { ...current, days: parsed.data.days }, guard.user.id);
    const swept = await sweep('enquiries', { force: true });

    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: 'enquiries.retention',
      targetType: 'settings',
      targetId: 'enquiries',
      summary:
        next.days === 0
          ? 'Switched off automatic deletion of contact enquiries'
          : `Contact enquiries are now kept for ${next.days} days`,
      metadata: { from: current.days, to: next.days, removed: swept.removed },
      ip: clientIp(request.headers),
    });

    return ok({ retention: await getRetention('enquiries'), removed: swept.removed });
  });
}
