import 'server-only';
import { sql } from 'drizzle-orm';
import { db } from '@/server/db';
import { rateLimits } from '@/server/db/schema';

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  /** Seconds until the caller may retry. 0 when allowed. */
  retryAfter: number;
};

/**
 * Fixed-window counter with a progressive block, kept in Postgres so it holds
 * across instances without another dependency. `limit` requests per `windowSec`;
 * exceeding it blocks for `blockSec`, doubling on each further breach up to a
 * one-hour ceiling.
 */
export async function rateLimit(opts: {
  key: string;
  limit: number;
  windowSec: number;
  blockSec?: number;
}): Promise<RateLimitResult> {
  const { key, limit, windowSec, blockSec = windowSec } = opts;
  const now = new Date();

  try {
    const [row] = await db
      .insert(rateLimits)
      .values({ key, count: 1, windowStart: now })
      .onConflictDoUpdate({
        target: rateLimits.key,
        set: {
          // Reset the window when it has elapsed, otherwise increment.
          count: sql`case
            when ${rateLimits.blockedUntil} is not null and ${rateLimits.blockedUntil} > now() then ${rateLimits.count}
            when ${rateLimits.windowStart} < now() - (${windowSec} || ' seconds')::interval then 1
            else ${rateLimits.count} + 1 end`,
          windowStart: sql`case
            when ${rateLimits.windowStart} < now() - (${windowSec} || ' seconds')::interval then now()
            else ${rateLimits.windowStart} end`,
        },
      })
      .returning();

    if (!row) return { allowed: true, remaining: limit - 1, retryAfter: 0 };

    if (row.blockedUntil && row.blockedUntil.getTime() > Date.now()) {
      return {
        allowed: false,
        remaining: 0,
        retryAfter: Math.ceil((row.blockedUntil.getTime() - Date.now()) / 1000),
      };
    }

    if (row.count > limit) {
      // Progressive: each breach past the limit doubles the penalty.
      const breaches = row.count - limit;
      const penalty = Math.min(blockSec * 2 ** (breaches - 1), 3600);
      const until = new Date(Date.now() + penalty * 1000);
      await db.update(rateLimits).set({ blockedUntil: until }).where(sql`${rateLimits.key} = ${key}`);
      return { allowed: false, remaining: 0, retryAfter: penalty };
    }

    return { allowed: true, remaining: Math.max(0, limit - row.count), retryAfter: 0 };
  } catch {
    // Never let a limiter outage lock people out of the product.
    return { allowed: true, remaining: limit, retryAfter: 0 };
  }
}

export async function clearRateLimit(key: string) {
  try {
    await db.delete(rateLimits).where(sql`${rateLimits.key} = ${key}`);
  } catch {
    /* best effort */
  }
}

/** The single place request identity for limiting is derived. */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]!.trim().slice(0, 64);
  return headers.get('x-real-ip')?.slice(0, 64) ?? 'unknown';
}
