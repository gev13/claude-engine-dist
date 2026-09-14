import { randomBytes, randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@/server/db';
import { users } from '@/server/db/schema';
import { audit } from '@/server/auth/audit';
import { clientIp, rateLimit } from '@/server/auth/rateLimit';
import {
  PENDING_2FA_COOKIE,
  mintAccessFor,
  setAccessCookie,
  setCsrfCookie,
  setRefreshCookie,
} from '@/server/auth/session';
import { issueRefreshToken, verifyAccessToken } from '@/server/auth/tokens';
import { consumeRecoveryCode, verifyTotp } from '@/server/auth/totp';
import { badRequest, handle, ok, tooMany, unauthorized } from '@/server/api/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  code: z.string().min(6).max(20),
  /** True when the user is redeeming a recovery code rather than a TOTP. */
  recovery: z.boolean().default(false),
});

export async function POST(request: Request) {
  return handle(async () => {
    const ip = clientIp(request.headers);

    const pending = (await cookies()).get(PENDING_2FA_COOKIE)?.value;
    if (!pending) return unauthorized('Start again from the sign-in page.');

    const claims = await verifyAccessToken(pending);
    if (!claims || claims.fam !== 'pending-2fa') return unauthorized('That sign-in attempt has expired.');

    const limit = await rateLimit({ key: `2fa:${claims.sub}`, limit: 6, windowSec: 300, blockSec: 300 });
    if (!limit.allowed) return tooMany(limit.retryAfter);

    let body: z.infer<typeof schema>;
    try {
      body = schema.parse(await request.json());
    } catch {
      return badRequest('Enter the six-digit code from your authenticator app.');
    }

    const [user] = await db.select().from(users).where(eq(users.id, claims.sub)).limit(1);
    if (!user || !user.isActive || !user.totpSecret) return unauthorized('Start again from the sign-in page.');

    let valid = false;

    if (body.recovery) {
      const remaining = consumeRecoveryCode(user.recoveryCodes, body.code);
      if (remaining) {
        valid = true;
        await db.update(users).set({ recoveryCodes: remaining }).where(eq(users.id, user.id));
        await audit({
          action: 'auth.2fa.recovery_used',
          actorId: user.id,
          actorEmail: user.email,
          ip,
          summary: `Recovery code redeemed — ${remaining.length} remaining`,
        });
      }
    } else {
      valid = await verifyTotp(user.totpSecret, body.code);
    }

    if (!valid) {
      await audit({ action: 'auth.2fa.failed', actorId: user.id, actorEmail: user.email, ip, summary: 'Second factor rejected' });
      return unauthorized('That code is not correct.');
    }

    const familyId = randomUUID();
    const refresh = await issueRefreshToken({
      userId: user.id,
      familyId,
      userAgent: request.headers.get('user-agent'),
      ip,
    });

    await setAccessCookie(await mintAccessFor(user, familyId));
    await setRefreshCookie(refresh.raw);
    await setCsrfCookie(randomBytes(24).toString('base64url'));
    (await cookies()).delete(PENDING_2FA_COOKIE);

    await audit({ action: 'auth.login.success', actorId: user.id, actorEmail: user.email, ip, summary: 'Signed in with 2FA' });

    return ok({ status: 'ok' as const, role: user.role });
  });
}
