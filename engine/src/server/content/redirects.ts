import 'server-only';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { db } from '@/server/db';
import { notFoundLog, redirects } from '@/server/db/schema';

/* ═══════════════════════════════════════════════════════════════════════════
   Redirects and the 404 log
   ───────────────────────────────────────────────────────────────────────────
   Resolved in the page route rather than in middleware: middleware runs on the
   Edge runtime, which cannot reach Postgres through the driver this project
   uses. The cost is that a redirect only fires where a route would otherwise
   404, which is exactly where it is wanted.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Leading slash, no trailing slash, query and hash dropped. */
export function normalisePath(input: string): string {
  const trimmed = (input ?? '').trim().split('?')[0]!.split('#')[0]!;
  if (!trimmed || trimmed === '/') return '/';
  const withSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withSlash.replace(/\/+$/, '') || '/';
}

/**
 * A redirect target may be a site-relative path or a full URL.
 *
 * The value is handed to `redirect()`, which will happily send a visitor
 * anywhere — including to a `javascript:` URL in some contexts — so the
 * grammar is an allowlist rather than a sanity check.
 */
export function isSafeTarget(value: string): boolean {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return false;

  // `//evil.com` and `/\evil.com` are protocol-relative: they look like site
  // paths and silently send the visitor to another origin. That is an open
  // redirect, so a site path must have exactly one leading slash.
  if (/^\/[/\\]/.test(trimmed)) return false;

  return /^\/[A-Za-z0-9\-._~!$&'()*+,;=:@%/?#]*$/.test(trimmed) || /^https?:\/\/[^\s<>"]+$/.test(trimmed);
}

export type ResolvedRedirect = { to: string; status: 301 | 302 };

/** Find an active redirect for a path, and count the hit. */
export async function findRedirect(path: string): Promise<ResolvedRedirect | null> {
  const from = normalisePath(path);

  try {
    const [row] = await db
      .select()
      .from(redirects)
      .where(and(eq(redirects.fromPath, from), eq(redirects.isActive, true)))
      .limit(1);

    if (!row || !isSafeTarget(row.toPath)) return null;

    // A redirect that points at itself would loop forever.
    if (normalisePath(row.toPath) === from) return null;

    // Counting is useful but never worth failing a request for.
    void db
      .update(redirects)
      .set({ hits: sql`${redirects.hits} + 1`, lastHitAt: new Date() })
      .where(eq(redirects.id, row.id))
      .catch(() => {});

    return { to: row.toPath, status: row.status === 302 ? 302 : 301 };
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
