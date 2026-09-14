import { randomBytes, randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, sql } from 'drizzle-orm';
import { env } from '@/lib/env';
import { db } from '@/server/db';
import { users } from '@/server/db/schema';
import { audit } from '@/server/auth/audit';
import { needsRehash, hashPassword, verifyPassword } from '@/server/auth/password';
import { clientIp, clearRateLimit, rateLimit } from '@/server/auth/rateLimit';
import {
  mintAccessFor,
  setAccessCookie,
  setCsrfCookie,
  setPending2faCookie,
  setRefreshCookie,
} from '@/server/auth/session';
import { notifySecurity } from '@/server/mail/notify';
import { getSecuritySettings } from '@/server/security/blocklist';
import { refuseIfBlocked, refuseRateLimited } from '@/server/security/guard';
import { issueRefreshToken, signAccessToken } from '@/server/auth/tokens';
import { badRequest, handle, ok, tooMany, unauthorized } from '@/server/api/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(200),
});

/**
 * Each further lock lasts longer than the last: the configured length, then
 * double, then four times, then eight. How many failures it takes and how long
 * the first lock lasts are both set on the Security screen.
 */
const LOCK_STEPS = [1, 2, 4, 8];

export async function POST(request: Request) {
  return handle(async () => {
    const ip = clientIp(request.headers);

    // Two limiters: one per IP (blunt), one per account (targeted).
    const refused = await refuseIfBlocked(ip);
    if (refused) return refused;

    const ipLimit = await rateLimit({ key: `login:ip:${ip}`, limit: 20, windowSec: 300, blockSec: 300 });
    if (!ipLimit.allowed) return refuseRateLimited(ip, 'sign-in attempts', ipLimit.retryAfter);

    let body: z.infer<typeof schema>;
    try {
      body = schema.parse(await request.json());
    } catch {
      return badRequest('Enter a valid email address and password.');
    }

    const email = body.email.toLowerCase().trim();
    const security = await getSecuritySettings();
    const accountLimit = await rateLimit({ key: `login:acct:${email}`, limit: 10, windowSec: 900, blockSec: 300 });
    if (!accountLimit.allowed) return tooMany(accountLimit.retryAfter);

    const [user] = await db.select().from(users).where(sql`lower(${users.email}) = ${email}`).limit(1);

    // Constant-ish work whether or not the account exists, so timing does not
    // disclose which emails are registered.
    const hash = user?.passwordHash ?? '$argon2id$v=19$m=19456,t=2,p=1$c2FsdHNhbHRzYWx0$0000000000000000000000000000000000000000000';
    const passwordOk = await verifyPassword(hash, body.password);

    if (!user || !passwordOk || !user.isActive) {
      if (user) {
        const failures = user.failedLoginCount + 1;
        const lockIndex = Math.min(Math.max(0, failures - security.maxFailures), LOCK_STEPS.length - 1);
        const shouldLock = failures >= security.maxFailures;
        // Zero means a lock always expires by itself; otherwise the nth lock
        // stays on until an administrator releases it from the Security screen.
        const holdForever = security.manualUnlockAfter > 0 && failures >= security.maxFailures + security.manualUnlockAfter;
        const lockFor = security.lockMinutes * LOCK_STEPS[lockIndex]!;
        await db
          .update(users)
          .set({
            failedLoginCount: failures,
            lockedUntil: shouldLock
              ? holdForever
                ? new Date('9999-12-31T00:00:00.000Z')
                : new Date(Date.now() + lockFor * 60_000)
              : user.lockedUntil,
          })
          .where(eq(users.id, user.id));

        // Told once, when the lock goes on — not on every wrong password, or a
        // bored attacker could fill an inbox by guessing badly.
        if (shouldLock && security.alertOnLockout) {
          notifySecurity({
            kind: 'accountLocked',
            summary: `${user.email} was locked after ${failures} failed sign-ins.`,
            facts: [
              ['Account', user.email],
              ['Username', user.username],
              ['Failed attempts', String(failures)],
              ['Locked for', holdForever ? 'until an administrator releases it' : `${lockFor} minutes`],
              ['From IP', ip],
              ['Browser', request.headers.get('user-agent')?.slice(0, 120) ?? 'unknown'],
            ],
          });
        }
      }
      await audit({
        action: 'auth.login.failed',
        actorEmail: email,
        ip,
        summary: 'Failed sign-in attempt',
      });
      return unauthorized('Those credentials are not correct.');
    }

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      const retryAfter = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 1000);
      await audit({ action: 'auth.login.locked', actorId: user.id, actorEmail: email, ip, summary: 'Sign-in on a locked account' });
      return tooMany(retryAfter, 'This account is temporarily locked after repeated failed attempts.');
    }

    // Successful password step — clear counters.
    await db
      .update(users)
      .set({
        failedLoginCount: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
        ...(needsRehash(user.passwordHash) ? { passwordHash: await hashPassword(body.password) } : {}),
      })
      .where(eq(users.id, user.id));
    await clearRateLimit(`login:acct:${email}`);

    /* ── Second factor ─────────────────────────────────────────────────────
       AUTH_REQUIRE_2FA is the single switch for the whole second factor. With
       it off, the password alone completes the login — including for an
       account that has already enrolled an authenticator, whose secret is left
       in place so that turning the flag back on restores the challenge without
       re-enrolment. Turning it off is a development convenience; production
       must run with it on.
       ──────────────────────────────────────────────────────────────────── */

    if (env.AUTH_REQUIRE_2FA) {
      if (user.totpSecret && user.totpEnabledAt) {
        // Short-lived, single-purpose token: proves the password step passed and
        // nothing more. It cannot be used as an access token.
        const pending = await signAccessToken({
          sub: user.id,
          email: user.email,
          role: user.role,
          fam: 'pending-2fa',
        });
        await setPending2faCookie(pending);
        await audit({ action: 'auth.login.password_ok', actorId: user.id, actorEmail: email, ip, summary: 'Password accepted, awaiting 2FA' });
        return ok({ status: '2fa_required' as const });
      }

      const pending = await signAccessToken({
        sub: user.id,
        email: user.email,
        role: user.role,
        fam: 'pending-2fa',
      });
      await setPending2faCookie(pending);
      await audit({ action: 'auth.login.enrol_required', actorId: user.id, actorEmail: email, ip, summary: '2FA enrolment required' });
      return ok({ status: '2fa_setup_required' as const });
    }

    /* ── No second factor configured or required ───────────────────────── */

    const familyId = randomUUID();
    const refresh = await issueRefreshToken({
      userId: user.id,
      familyId,
      userAgent: request.headers.get('user-agent'),
      ip,
    });
    const access = await mintAccessFor(user, familyId);

    await setAccessCookie(access);
    await setRefreshCookie(refresh.raw);
    await setCsrfCookie(randomBytes(24).toString('base64url'));

    await audit({
      action: 'auth.login.success',
      actorId: user.id,
      actorEmail: email,
      ip,
      summary: env.AUTH_REQUIRE_2FA ? 'Signed in' : 'Signed in (second factor disabled)',
      metadata: { secondFactor: env.AUTH_REQUIRE_2FA ? 'not_enrolled' : 'disabled' },
    });

    return NextResponse.json({ status: 'ok' as const, role: user.role });
  });
}
