import 'server-only';
import { and, desc, eq, gt, isNull, lt, or, sql } from 'drizzle-orm';
import {
  SECURITY_DEFAULTS,
  SECURITY_SETTING_KEY,
  type SecuritySettings,
  normaliseIp,
  securitySettingsSchema,
} from '@/lib/security';
import { rateLimit } from '@/server/auth/rateLimit';
import { db } from '@/server/db';
import { blockedIps, settings } from '@/server/db/schema';

/* ═══════════════════════════════════════════════════════════════════════════
   The blocklist (package 5)
   ───────────────────────────────────────────────────────────────────────────
   Addresses that are refused before anything else happens. Two ways in: an
   administrator adds one by hand, or an address trips the rate limiter often
   enough that the engine adds it itself.

   Enforcement is in the node request path rather than in middleware: the edge
   runtime cannot reach Postgres, and a blocklist that lied because it could
   not read its own table would be worse than none.
   ═══════════════════════════════════════════════════════════════════════════ */

export async function getSecuritySettings(): Promise<SecuritySettings> {
  try {
    const [row] = await db.select().from(settings).where(eq(settings.key, SECURITY_SETTING_KEY)).limit(1);
    if (!row) return SECURITY_DEFAULTS;
    const parsed = securitySettingsSchema.safeParse(row.value);
    return parsed.success ? parsed.data : SECURITY_DEFAULTS;
  } catch {
    return SECURITY_DEFAULTS;
  }
}

/** Live blocks only: an expired row stays for the record until it is pruned. */
const live = (ip: string) =>
  and(eq(blockedIps.ip, ip), or(isNull(blockedIps.expiresAt), gt(blockedIps.expiresAt, sql`now()`)));

/**
 * Whether this address is refused. Counts the attempt as it goes, so the
 * screen can show how hard something is knocking, and never throws — a
 * database hiccup must not lock everybody out of the site.
 */
export async function isIpBlocked(rawIp: string): Promise<boolean> {
  const ip = normaliseIp(rawIp);
  if (!ip) return false;
  try {
    const [row] = await db.select({ ip: blockedIps.ip }).from(blockedIps).where(live(ip)).limit(1);
    if (!row) return false;
    void db
      .update(blockedIps)
      .set({ hits: sql`${blockedIps.hits} + 1`, lastSeenAt: new Date() })
      .where(eq(blockedIps.ip, ip))
      .catch(() => {});
    return true;
  } catch {
    return false;
  }
}

export type BlockRow = typeof blockedIps.$inferSelect;

export async function listBlocks(limit = 100): Promise<BlockRow[]> {
  return db.select().from(blockedIps).orderBy(desc(blockedIps.createdAt)).limit(limit);
}

/** Add or replace a block. `minutes` of null keeps it until somebody removes it. */
export async function addBlock(input: {
  ip: string;
  reason: string;
  minutes: number | null;
  automatic: boolean;
  createdById?: string | null;
}): Promise<BlockRow | null> {
  const ip = normaliseIp(input.ip);
  if (!ip) return null;
  const values = {
    ip,
    reason: input.reason.slice(0, 200),
    expiresAt: input.minutes === null ? null : new Date(Date.now() + input.minutes * 60_000),
    automatic: input.automatic,
    createdById: input.createdById ?? null,
  };
  const [row] = await db
    .insert(blockedIps)
    .values(values)
    .onConflictDoUpdate({
      target: blockedIps.ip,
      // A hand-made block outlasts an automatic one: never shorten it silently.
      set: { reason: values.reason, expiresAt: values.expiresAt, automatic: values.automatic, createdById: values.createdById },
    })
    .returning();
  return row ?? null;
}

export async function removeBlock(rawIp: string): Promise<boolean> {
  const ip = normaliseIp(rawIp);
  if (!ip) return false;
  const removed = await db.delete(blockedIps).where(eq(blockedIps.ip, ip)).returning({ ip: blockedIps.ip });
  return removed.length > 0;
}

/** Drop blocks that expired more than a week ago; the recent ones stay visible. */
export async function pruneBlocks(): Promise<void> {
  await db.delete(blockedIps).where(lt(blockedIps.expiresAt, new Date(Date.now() - 7 * 86_400_000)));
}

/**
 * Called when an address trips a rate limit. Counts the breaches in an hour
 * and, past the threshold, blocks the address itself. Returns the block when
 * it made one, so the caller can raise an alert.
 */
export async function noteLimiterBreach(rawIp: string, what: string): Promise<BlockRow | null> {
  const ip = normaliseIp(rawIp);
  if (!ip) return null;

  const security = await getSecuritySettings();
  if (security.autoBlockAfter === 0) return null;

  // The limiter counts for us: this key breaches exactly when the address has
  // tripped `autoBlockAfter` limits within the hour.
  const counter = await rateLimit({ key: `abuse:${ip}`, limit: security.autoBlockAfter, windowSec: 3600, blockSec: 3600 });
  if (counter.allowed) return null;

  return addBlock({
    ip,
    reason: `Too many refused requests (${what})`,
    minutes: security.autoBlockMinutes,
    automatic: true,
  });
}
