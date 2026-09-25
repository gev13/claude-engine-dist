import { eq, sql } from 'drizzle-orm';
import { db } from '@/server/db';
import { redirects } from '@/server/db/schema';

/**
 * Count a redirect's hit. Useful, and never worth failing or slowing a request
 * for — so it is not awaited, and a failure is swallowed. Not `server-only`,
 * because the middleware counts the query rules it applies.
 */
export function countHit(id: string): void {
  void db
    .update(redirects)
    .set({ hits: sql`${redirects.hits} + 1`, lastHitAt: new Date() })
    .where(eq(redirects.id, id))
    .catch(() => {});
}
