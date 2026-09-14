import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { badRequest, handle, ok } from '@/server/api/respond';
import { refuseIfBlocked, refuseRateLimited } from '@/server/security/guard';
import { audit } from '@/server/auth/audit';
import { checkPasswordPolicy, hashPassword } from '@/server/auth/password';
import { clientIp, rateLimit } from '@/server/auth/rateLimit';
import { consumeResetToken } from '@/server/auth/resetTokens';
import { revokeAllForUser } from '@/server/auth/tokens';
import { notifySecurity } from '@/server/mail/notify';
import { db } from '@/server/db';
import { users } from '@/server/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Set a new password with a reset link.
 *
 * The token is spent first, then the password changes, then every session for
 * that account is revoked — whoever asked for the reset signs in again, and
 * anybody already signed in as them is turned out.
 */
const schema = z.object({
  token: z.string().min(20).max(200),
  password: z.string().min(1).max(200),
});

export async function POST(request: Request) {
  return handle(async () => {
    const ip = clientIp(request.headers);

    const refused = await refuseIfBlocked(ip);
    if (refused) return refused;

    const limit = await rateLimit({ key: `reset:use:${ip}`, limit: 10, windowSec: 3600, blockSec: 1800 });
    if (!limit.allowed) return refuseRateLimited(ip, 'password reset attempts', limit.retryAfter);

    const body = await request.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest('Enter a new password.');

    const outcome = await consumeResetToken(parsed.data.token);
    if (!outcome.ok) {
      await audit({
        action: 'auth.password_reset.rejected',
        summary: `A reset link was refused (${outcome.reason})`,
        ip,
      });
      return badRequest('That link has expired or has already been used. Ask for a new one.');
    }

    const [user] = await db.select().from(users).where(eq(users.id, outcome.userId)).limit(1);
    if (!user || !user.isActive) return badRequest('That link is no longer valid.');

    const policy = checkPasswordPolicy(parsed.data.password, { email: user.email, username: user.username });
    if (!policy.ok) return badRequest(policy.reason);

    await db
      .update(users)
      .set({
        passwordHash: await hashPassword(parsed.data.password),
        // A reset also clears a lockout: the person has proved they hold the inbox.
        failedLoginCount: 0,
        lockedUntil: null,
      })
      .where(eq(users.id, user.id));

    await revokeAllForUser(user.id);

    await audit({
      actorId: user.id,
      actorEmail: user.email,
      action: 'auth.password_reset.completed',
      targetType: 'user',
      targetId: user.id,
      summary: 'Password changed with a reset link; all sessions signed out',
      ip,
    });

    notifySecurity({
      kind: 'passwordChanged',
      summary: `The password for ${user.email} was changed with a reset link.`,
      facts: [
        ['Account', user.email],
        ['From IP', ip],
      ],
    });

    return ok({ ok: true });
  });
}
