import { and, desc, eq, ilike, or, sql, type SQL } from 'drizzle-orm';
import { readListParams } from '@/server/api/schemas';
import { handle, ok } from '@/server/api/respond';
import { requireUser } from '@/server/api/guard';
import { db } from '@/server/db';
import { auditLog } from '@/server/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Read-only by design. There is no POST, PATCH or DELETE here, and the
 * database refuses updates and deletes on this table regardless
 * (drizzle/sql/0001_audit_immutable.sql).
 */
export async function GET(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'audit:read');
    if (!guard.ok) return guard.response;

    const url = new URL(request.url);
    const { page, perPage, offset, q } = readListParams(url);
    const action = url.searchParams.get('action') ?? '';
    const actorId = url.searchParams.get('actorId') ?? '';

    const filters: SQL[] = [];
    if (q) filters.push(or(ilike(auditLog.summary, `%${q}%`), ilike(auditLog.targetId, `%${q}%`))!);
    if (action) filters.push(ilike(auditLog.action, `${action}%`));
    if (actorId) filters.push(eq(auditLog.actorId, actorId));
    const where = filters.length ? and(...filters) : undefined;

    const [items, [count], actions] = await Promise.all([
      db.select().from(auditLog).where(where).orderBy(desc(auditLog.createdAt)).limit(perPage).offset(offset),
      db.select({ n: sql<number>`count(*)::int` }).from(auditLog).where(where),
      // The distinct action list powers the filter dropdown.
      db
        .select({ action: auditLog.action, n: sql<number>`count(*)::int` })
        .from(auditLog)
        .groupBy(auditLog.action)
        .orderBy(auditLog.action),
    ]);

    return ok({ items, total: count?.n ?? 0, page, perPage, actions });
  });
}
