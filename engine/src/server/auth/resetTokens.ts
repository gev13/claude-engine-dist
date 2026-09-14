import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { and, eq, isNull, lt } from 'drizzle-orm';
import { db } from '@/server/db';
import { passwordResetTokens } from '@/server/db/schema';

/* ═══════════════════════════════════════════════════════════════════════════
   Password reset tokens (package 5)
   ───────────────────────────────────────────────────────────────────────────
   The raw token exists in one place only: the link in the email. What is
   stored is its sha256, so a copy of the database does not let anybody reset
   an account. A token lasts thirty minutes, works once, and asking for a new
   one retires the last.
   ═══════════════════════════════════════════════════════════════════════════ */

export const RESET_TTL_MINUTES = 30;

const digest = (raw: string) => createHash('sha256').update(raw).digest('hex');

/** Retire any live token for this account, then mint one. Returns the raw token. */
export async function issueResetToken(userId: string, ip: string | null): Promise<string> {
  await db
    .update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(passwordResetTokens.userId, userId), isNull(passwordResetTokens.usedAt)));

  const raw = randomBytes(32).toString('base64url');
  await db.insert(passwordResetTokens).values({
    userId,
    tokenHash: digest(raw),
    expiresAt: new Date(Date.now() + RESET_TTL_MINUTES * 60_000),
    requestedIp: ip,
  });
  return raw;
}

export type ResetOutcome = { ok: true; userId: string } | { ok: false; reason: 'unknown' | 'used' | 'expired' };

/**
 * Spend a token. It is marked used before the password changes, so two
 * requests racing with the same link cannot both succeed.
 */
export async function consumeResetToken(raw: string): Promise<ResetOutcome> {
  const [row] = await db.select().from(passwordResetTokens).where(eq(passwordResetTokens.tokenHash, digest(raw))).limit(1);
  if (!row) return { ok: false, reason: 'unknown' };
  if (row.usedAt) return { ok: false, reason: 'used' };
  if (row.expiresAt.getTime() < Date.now()) return { ok: false, reason: 'expired' };

  const spent = await db
    .update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(passwordResetTokens.id, row.id), isNull(passwordResetTokens.usedAt)))
    .returning({ id: passwordResetTokens.id });
  if (spent.length === 0) return { ok: false, reason: 'used' };

  return { ok: true, userId: row.userId };
}

/** Housekeeping: drop tokens that expired more than a day ago. */
export async function pruneResetTokens(): Promise<void> {
  await db.delete(passwordResetTokens).where(lt(passwordResetTokens.expiresAt, new Date(Date.now() - 86_400_000)));
}
