import { z } from 'zod';
import { eq, sql } from 'drizzle-orm';
import { ROLES } from '@/lib/roles';
import { badRequest, conflict, handle, noContent, notFound, ok, readJson } from '@/server/api/respond';
import { requireUser } from '@/server/api/guard';
import { audit } from '@/server/auth/audit';
import { checkPasswordPolicy, hashPassword } from '@/server/auth/password';
import { clientIp } from '@/server/auth/rateLimit';
import { revokeAllForUser } from '@/server/auth/tokens';
import { db } from '@/server/db';
import { users } from '@/server/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

const publicColumns = {
  id: users.id,
  email: users.email,
  username: users.username,
  firstName: users.firstName,
  lastName: users.lastName,
  phone: users.phone,
  role: users.role,
  isActive: users.isActive,
  totpEnabledAt: users.totpEnabledAt,
  lastLoginAt: users.lastLoginAt,
  lockedUntil: users.lockedUntil,
  createdAt: users.createdAt,
};

const updateSchema = z.object({
  email: z.string().email().max(255).optional(),
  username: z.string().min(3).max(64).regex(/^[a-zA-Z0-9._-]+$/).optional(),
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  phone: z.string().max(40).nullable().optional(),
  role: z.enum(ROLES).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(1).max(200).optional(),
  /** Clears TOTP so the user must enrol again — for a lost authenticator. */
  resetTwoFactor: z.boolean().optional(),
});

export async function GET(request: Request, ctx: Ctx) {
  return handle(async () => {
    const guard = await requireUser(request, 'users:read');
    if (!guard.ok) return guard.response;
    const { id } = await ctx.params;
    const [row] = await db.select(publicColumns).from(users).where(eq(users.id, id)).limit(1);
    return row ? ok(row) : notFound('That user no longer exists.');
  });
}

export async function PATCH(request: Request, ctx: Ctx) {
  return handle(async () => {
    const guard = await requireUser(request, 'users:write');
    if (!guard.ok) return guard.response;

    const { id } = await ctx.params;
    const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!row) return notFound('That user no longer exists.');

    const parsed = await readJson(request, updateSchema);
    if (!parsed.ok) return parsed.response;
    const input = parsed.data;

    // An admin cannot demote or disable themselves. Without this, the last
    // admin can lock every remaining person out of the panel.
    const isSelf = row.id === guard.user.id;
    if (isSelf && (input.role === 'editor' || input.isActive === false)) {
      return conflict('You cannot change your own role or deactivate your own account.');
    }

    if (input.email || input.username) {
      const [clash] = await db
        .select({ id: users.id })
        .from(users)
        .where(
          sql`${users.id} <> ${row.id} and (
            ${input.email ? sql`lower(${users.email}) = ${input.email.toLowerCase()}` : sql`false`}
            or ${input.username ? sql`lower(${users.username}) = ${input.username.toLowerCase()}` : sql`false`}
          )`,
        )
        .limit(1);
      if (clash) return conflict('That email address or username is already in use.');
    }

    let passwordHash: string | undefined;
    if (input.password) {
      const policy = checkPasswordPolicy(input.password, {
        email: input.email ?? row.email,
        username: input.username ?? row.username,
      });
      if (!policy.ok) return badRequest(policy.reason);
      passwordHash = await hashPassword(input.password);
    }

    const [updated] = await db
      .update(users)
      .set({
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.username !== undefined ? { username: input.username } : {}),
        ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
        ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.role !== undefined ? { role: input.role } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(passwordHash ? { passwordHash, failedLoginCount: 0, lockedUntil: null } : {}),
        ...(input.resetTwoFactor ? { totpSecret: null, totpEnabledAt: null, recoveryCodes: [] } : {}),
      })
      .where(eq(users.id, row.id))
      .returning(publicColumns);

    // Any change to what a session is allowed to do must invalidate the
    // sessions that were issued under the old answer.
    const securityRelevant =
      passwordHash !== undefined ||
      input.role !== undefined ||
      input.isActive !== undefined ||
      input.resetTwoFactor === true;
    if (securityRelevant) await revokeAllForUser(row.id);

    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: 'user.update',
      targetType: 'user',
      targetId: row.id,
      summary: `Updated account ${row.email}${securityRelevant ? ' — all sessions revoked' : ''}`,
      metadata: {
        roleChanged: input.role !== undefined ? `${row.role} → ${input.role}` : undefined,
        activeChanged: input.isActive !== undefined ? `${row.isActive} → ${input.isActive}` : undefined,
        passwordReset: passwordHash !== undefined,
        twoFactorReset: input.resetTwoFactor === true,
      },
      ip: clientIp(request.headers),
    });

    return ok(updated);
  });
}

export async function DELETE(request: Request, ctx: Ctx) {
  return handle(async () => {
    const guard = await requireUser(request, 'users:delete');
    if (!guard.ok) return guard.response;

    const { id } = await ctx.params;
    const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!row) return notFound('That user no longer exists.');
    if (row.id === guard.user.id) return conflict('You cannot delete your own account.');

    // Refuse to remove the last active admin, for the same reason as above.
    if (row.role === 'admin') {
      const [remaining] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(users)
        .where(sql`${users.role} = 'admin' and ${users.isActive} = true and ${users.id} <> ${row.id}`);
      if ((remaining?.n ?? 0) === 0) return conflict('This is the last active administrator and cannot be deleted.');
    }

    await revokeAllForUser(row.id);
    await db.delete(users).where(eq(users.id, row.id));

    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: 'user.delete',
      targetType: 'user',
      targetId: row.id,
      summary: `Deleted account ${row.email} (${row.role})`,
      ip: clientIp(request.headers),
    });

    return noContent();
  });
}
