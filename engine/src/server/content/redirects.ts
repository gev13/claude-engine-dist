import 'server-only';
import { desc, eq, isNull, sql } from 'drizzle-orm';
import { db } from '@/server/db';
import { notFoundLog, redirects } from '@/server/db/schema';
import { normalisePath, pickRule } from '@/lib/redirectRules';
import { routingConfig } from '@/server/routing/config';
import { countHit } from '@/server/routing/hits';

export { countHit };

/* ═══════════════════════════════════════════════════════════════════════════
   Redirects and the 404 log
   ───────────────────────────────────────────────────────────────────────────
   Path rules are resolved in the page routes, where a path would otherwise
   404 — so live content always wins over a redirect. Rules that also match a
   query (`/?s=*`) are applied earlier, by the middleware, because the path
   they sit on usually *is* live content. The matching itself is
   `lib/redirectRules.ts`, shared by both and by the import preview.
   ═══════════════════════════════════════════════════════════════════════════ */

export { isSafeTarget, normalisePath } from '@/lib/redirectRules';

export type ResolvedRedirect = { to: string; status: 301 | 302 };

/** Find the rule for a path that has no content, and count the hit. */
export async function findRedirect(path: string): Promise<ResolvedRedirect | null> {
  const from = normalisePath(path);
  try {
    const { pathRules } = await routingConfig();
    const found = pickRule(pathRules, from);
    if (!found) return null;
    countHit(found.rule.id);
    return { to: found.to, status: found.rule.status };
  } catch {
    return null;
  }
}

/** Record a 404 so somebody can decide whether it deserves a redirect. */
export async function recordNotFound(path: string, referrer?: string | null): Promise<void> {
  const clean = normalisePath(path);
  if (clean === '/') return;

  try {
    await db
      .insert(notFoundLog)
      .values({ path: clean, hits: 1, lastReferrer: referrer?.slice(0, 500) ?? null })
      .onConflictDoUpdate({
        target: notFoundLog.path,
        set: {
          hits: sql`${notFoundLog.hits} + 1`,
          lastSeenAt: new Date(),
          lastReferrer: referrer?.slice(0, 500) ?? null,
          // Seeing it again reopens it.
          resolvedAt: null,
        },
      });
  } catch {
    // A missing-page log entry is never worth failing a request for.
  }
}

export async function listRedirects() {
  return db.select().from(redirects).orderBy(desc(redirects.createdAt));
}

export async function listNotFound(includeResolved = false) {
  const query = db
    .select()
    .from(notFoundLog)
    .orderBy(desc(notFoundLog.hits), desc(notFoundLog.lastSeenAt))
    .limit(200);

  return includeResolved ? query : query.where(isNull(notFoundLog.resolvedAt));
}

export async function resolveNotFound(path: string) {
  await db
    .update(notFoundLog)
    .set({ resolvedAt: new Date() })
    .where(eq(notFoundLog.path, normalisePath(path)));
}
