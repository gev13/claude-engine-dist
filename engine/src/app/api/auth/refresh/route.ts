import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { eq } from 'drizzle-orm';
import { db } from '@/server/db';
import { users } from '@/server/db/schema';
import { audit } from '@/server/auth/audit';
import { clientIp } from '@/server/auth/rateLimit';
import {
  REFRESH_COOKIE,
  clearAuthCookies,
  mintAccessFor,
  setAccessCookie,
  setCsrfCookie,
  setRefreshCookie,
} from '@/server/auth/session';
import { consumeRefreshToken, issueRefreshToken } from '@/server/auth/tokens';
import { handle, ok, unauthorized } from '@/server/api/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Rotate the refresh token and issue a fresh access token.
 *
 * A token presented twice means it leaked, so the whole family is revoked and
 * every session derived from that login is ended — including the attacker's.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const ip = clientIp(request.headers);
    const raw = (await cookies()).get(REFRESH_COOKIE)?.value;
    if (!raw) return unauthorized('Your session has ended.');

    const outcome = await consumeRefreshToken(raw);

    if (outcome.status === 'reused') {
      await clearAuthCookies();
      await audit({
        action: 'auth.refresh.reuse_detected',
        actorId: outcome.userId,
        ip,
        summary: 'Refresh token reuse detected — session family revoked',
        metadata: { familyId: outcome.familyId },
      });
      return unauthorized('Your session was ended for security reasons. Please sign in again.');
    }

    if (outcome.status !== 'ok') {
      await clearAuthCookies();
      return unauthorized('Your session has ended.');
    }

    const [user] = await db.select().from(users).where(eq(users.id, outcome.userId)).limit(1);
    if (!user || !user.isActive) {
      await clearAuthCookies();
      return unauthorized('Your session has ended.');
    }

    const next = await issueRefreshToken({
      userId: user.id,
      familyId: outcome.familyId,
      userAgent: request.headers.get('user-agent'),
      ip,
    });

    await setAccessCookie(await mintAccessFor(user, outcome.familyId));
    await setRefreshCookie(next.raw);
    await setCsrfCookie(randomBytes(24).toString('base64url'));

    return ok({ status: 'ok' as const, role: user.role });
  });
}
