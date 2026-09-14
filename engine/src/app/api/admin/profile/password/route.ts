import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { badRequest, handle, ok, readJson, tooMany, unauthorized } from '@/server/api/respond';
import { requireUser } from '@/server/api/guard';
import { audit } from '@/server/auth/audit';
import { checkPasswordPolicy, hashPassword, verifyPassword } from '@/server/auth/password';
import { clientIp, rateLimit } from '@/server/auth/rateLimit';
import { revokeAllForUser } from '@/server/auth/tokens';
import { db } from '@/server/db';
import { users } from '@/server/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(1).max(200),
});

/**
 * Changing a password requires proving you know the current one — otherwise a
 * borrowed session becomes permanent account takeover. On success every
 * refresh token is revoked, including this device's, so the change ends all
 * sessions everywhere.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'profile:write');
    if (!guard.ok) return guard.response;

    const limit = await rateLimit({ key: `pwchange:${guard.user.id}`, limit: 5, windowSec: 900, blockSec: 900 });
    if (!limit.allowed) return tooMany(limit.retryAfter);

    const parsed = await readJson(request, schema);
    if (!parsed.ok) return parsed.response;
    const { currentPassword, newPassword } = parsed.data;

    const [row] = await db.select().from(users).where(eq(users.id, guard.user.id)).limit(1);
    if (!row) return unauthorized();

    if (!(await verifyPassword(row.passwordHash, currentPassword))) {
      await audit({
        actorId: row.id,
        actorEmail: row.email,
        action: 'profile.password.failed',
        targetType: 'user',
        targetId: row.id,
        summary: 'Password change rejected — current password incorrect',
        ip: clientIp(request.headers),
      });
      return unauthorized('Your current password is not correct.');
    }

    const policy = checkPasswordPolicy(newPassword, { email: row.email, username: row.username });
    if (!policy.ok) return badRequest(policy.reason);

    if (await verifyPassword(row.passwordHash, newPassword)) {
      return badRequest('Your new password must be different from your current one.');
    }

    await db
      .update(users)
      .set({ passwordHash: await hashPassword(newPassword), failedLoginCount: 0, lockedUntil: null })
      .where(eq(users.id, row.id));

    await revokeAllForUser(row.id);

    await audit({
      actorId: row.id,
      actorEmail: row.email,
      action: 'profile.password.changed',
      targetType: 'user',
      targetId: row.id,
      summary: 'Changed own password — all sessions revoked',
      ip: clientIp(request.headers),
    });

    return ok({ status: 'ok' as const, reauthRequired: true });
  });
}
