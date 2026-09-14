import { randomBytes, randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import QRCode from 'qrcode';
import { db } from '@/server/db';
import { users } from '@/server/db/schema';
import { audit } from '@/server/auth/audit';
import { clientIp } from '@/server/auth/rateLimit';
import {
  PENDING_2FA_COOKIE,
  getSessionUser,
  mintAccessFor,
  setAccessCookie,
  setCsrfCookie,
  setRefreshCookie,
} from '@/server/auth/session';
import { issueRefreshToken, verifyAccessToken } from '@/server/auth/tokens';
import { generateRecoveryCodes, generateTotpSecret, totpUri, verifyTotp } from '@/server/auth/totp';
import { badRequest, handle, ok, unauthorized } from '@/server/api/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Enrolment is reachable in two states: mid-login (the pending-2fa cookie,
 * for an account that must enrol before it can finish signing in) and from
 * an authenticated session (a user adding or replacing their authenticator).
 */
async function resolveUserId(): Promise<{ id: string; midLogin: boolean } | null> {
  const session = await getSessionUser();
  if (session) return { id: session.id, midLogin: false };

  const pending = (await cookies()).get(PENDING_2FA_COOKIE)?.value;
  if (!pending) return null;
  const claims = await verifyAccessToken(pending);
  return claims && claims.fam === 'pending-2fa' ? { id: claims.sub, midLogin: true } : null;
}

/** Step 1 — mint a secret and return the provisioning QR. Not yet enabled. */
export async function GET() {
  return handle(async () => {
    const resolved = await resolveUserId();
    if (!resolved) return unauthorized();

    const [user] = await db.select().from(users).where(eq(users.id, resolved.id)).limit(1);
    if (!user) return unauthorized();

    const secret = user.totpEnabledAt ? null : (user.totpSecret ?? generateTotpSecret());
    if (!secret) return badRequest('Two-factor authentication is already enabled on this account.');

    // Store the candidate secret but leave totpEnabledAt null — it only counts
    // once the user proves they can generate a code from it.
    if (secret !== user.totpSecret) {
      await db.update(users).set({ totpSecret: secret }).where(eq(users.id, user.id));
    }

    const uri = totpUri(secret, user.email);
    const qrDataUrl = await QRCode.toDataURL(uri, {
      margin: 1,
      width: 240,
      color: { dark: '#f3f2f2', light: '#201e1d' },
    });

    return ok({ secret, uri, qrDataUrl });
  });
}

const confirmSchema = z.object({ code: z.string().min(6).max(10) });

/** Step 2 — confirm a code, enable 2FA, and hand back the recovery codes once. */
export async function POST(request: Request) {
  return handle(async () => {
    const resolved = await resolveUserId();
    if (!resolved) return unauthorized();

    let body: z.infer<typeof confirmSchema>;
    try {
      body = confirmSchema.parse(await request.json());
    } catch {
      return badRequest('Enter the six-digit code from your authenticator app.');
    }

    const [user] = await db.select().from(users).where(eq(users.id, resolved.id)).limit(1);
    if (!user?.totpSecret) return badRequest('Start the setup again.');

    if (!(await verifyTotp(user.totpSecret, body.code))) {
      return badRequest('That code is not correct. Check your device clock and try again.');
    }

    const { plain, hashed } = generateRecoveryCodes();
    await db
      .update(users)
      .set({ totpEnabledAt: new Date(), recoveryCodes: hashed })
      .where(eq(users.id, user.id));

    await audit({
      action: 'auth.2fa.enabled',
      actorId: user.id,
      actorEmail: user.email,
      ip: clientIp(request.headers),
      summary: 'Two-factor authentication enabled',
    });

    // Enrolment that happens mid-login completes the login: the password step
    // already passed, and the code just verified is the second factor. Without
    // this the user is bounced back to the sign-in page having done everything
    // correctly.
    if (resolved.midLogin) {
      const familyId = randomUUID();
      const refresh = await issueRefreshToken({
        userId: user.id,
        familyId,
        userAgent: request.headers.get('user-agent'),
        ip: clientIp(request.headers),
      });

      await setAccessCookie(await mintAccessFor(user, familyId));
      await setRefreshCookie(refresh.raw);
      await setCsrfCookie(randomBytes(24).toString('base64url'));
      (await cookies()).delete(PENDING_2FA_COOKIE);

      await audit({
        actorId: user.id,
        actorEmail: user.email,
        action: 'auth.login.success',
        ip: clientIp(request.headers),
        summary: 'Signed in, completing 2FA enrolment',
      });
    }

    // The only time these are ever readable.
    return ok({ status: 'enabled' as const, recoveryCodes: plain });
  });
}
