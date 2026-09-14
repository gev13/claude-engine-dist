import { and, desc, eq, ilike, or, sql, type SQL } from 'drizzle-orm';
import { readListParams } from '@/server/api/schemas';
import { handle, ok } from '@/server/api/respond';
import { requireUser } from '@/server/api/guard';
import { db } from '@/server/db';
import { enquiries } from '@/server/db/schema';

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
    const where = filters.length ? and(...filters) : undefined;

    const [items, [count], [unread]] = await Promise.all([
      db.select().from(enquiries).where(where).orderBy(desc(enquiries.createdAt)).limit(perPage).offset(offset),
      db.select({ n: sql<number>`count(*)::int` }).from(enquiries).where(where),
      db.select({ n: sql<number>`count(*)::int` }).from(enquiries).where(eq(enquiries.status, 'new')),
    ]);

    return ok({ items, total: count?.n ?? 0, page, perPage, unread: unread?.n ?? 0 });
  });
}
