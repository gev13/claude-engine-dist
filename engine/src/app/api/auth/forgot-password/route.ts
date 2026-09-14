import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { SITE_URL } from '@/lib/env';
import { handle, ok } from '@/server/api/respond';
import { refuseIfBlocked, refuseRateLimited } from '@/server/security/guard';
import { audit } from '@/server/auth/audit';
import { clientIp, rateLimit } from '@/server/auth/rateLimit';
import { RESET_TTL_MINUTES, issueResetToken } from '@/server/auth/resetTokens';
import { getMailSettings, mailBrand, sendMail } from '@/server/mail/send';
import { passwordResetEmail } from '@/server/mail/templates';
import { db } from '@/server/db';
import { users } from '@/server/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Ask for a reset link.
 *
 * The answer is the same whether or not the address belongs to an account:
 * this endpoint is unauthenticated, so anything that varied would turn it into
 * a way to find out who has one. The work behind it varies; the response does
 * not.
 */
const schema = z.object({ email: z.string().trim().email().max(255) });

export async function POST(request: Request) {
  return handle(async () => {
    const ip = clientIp(request.headers);

    const refused = await refuseIfBlocked(ip);
    if (refused) return refused;

    const byIp = await rateLimit({ key: `reset:ip:${ip}`, limit: 10, windowSec: 3600, blockSec: 3600 });
    if (!byIp.allowed) return refuseRateLimited(ip, 'password reset requests', byIp.retryAfter);

    let email = '';
    try {
      email = schema.parse(await request.json()).email.toLowerCase();
    } catch {
      // A malformed address is answered like any other: nothing to learn here.
      return ok({ ok: true });
    }

    const byAccount = await rateLimit({ key: `reset:acct:${email}`, limit: 3, windowSec: 3600, blockSec: 3600 });
    if (!byAccount.allowed) return ok({ ok: true });

    const [user] = await db.select().from(users).where(sql`lower(${users.email}) = ${email}`).limit(1);

    if (user && user.isActive) {
      const token = await issueResetToken(user.id, ip);
      const brand = await mailBrand();
      const message = passwordResetEmail({
        ...brand,
        name: [user.firstName, user.lastName].filter(Boolean).join(' '),
        resetUrl: `${SITE_URL}/admin/reset?token=${encodeURIComponent(token)}`,
        minutes: RESET_TTL_MINUTES,
        ip,
        when: new Date().toUTCString(),
      });

      const mail = await getMailSettings();
      const sent = await sendMail({ ...message, to: user.email }, mail);

      await audit({
        actorId: user.id,
        actorEmail: user.email,
        action: 'auth.password_reset.requested',
        targetType: 'user',
        targetId: user.id,
        summary: sent.ok ? 'Password reset link sent' : `Password reset link could not be sent: ${sent.error}`,
        ip,
      });
    } else {
      await audit({
        actorEmail: email,
        action: 'auth.password_reset.unknown',
        summary: 'Password reset asked for an address with no active account',
        ip,
      });
    }

    return ok({ ok: true });
  });
}
