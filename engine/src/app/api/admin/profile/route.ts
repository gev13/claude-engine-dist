import { z } from 'zod';
import { eq, sql } from 'drizzle-orm';
import { conflict, handle, notFound, ok, readJson } from '@/server/api/respond';
import { requireUser } from '@/server/api/guard';
import { audit } from '@/server/auth/audit';
import { clientIp } from '@/server/auth/rateLimit';
import { db } from '@/server/db';
import { users } from '@/server/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const publicColumns = {
  id: users.id,
  email: users.email,
  username: users.username,
  firstName: users.firstName,
  lastName: users.lastName,
  phone: users.phone,
  role: users.role,
  totpEnabledAt: users.totpEnabledAt,
  lastLoginAt: users.lastLoginAt,
  createdAt: users.createdAt,
};

const updateSchema = z.object({
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  username: z.string().min(3).max(64).regex(/^[a-zA-Z0-9._-]+$/, 'Letters, numbers, dot, dash and underscore only.').optional(),
  email: z.string().email().max(255).optional(),
  phone: z.string().max(40).nullable().optional(),
});

/** Always scoped to the caller — the id never comes from the request. */
export async function GET(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'profile:write');
    if (!guard.ok) return guard.response;
    const [row] = await db.select(publicColumns).from(users).where(eq(users.id, guard.user.id)).limit(1);
    return row ? ok(row) : notFound();
  });
}

export async function PATCH(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'profile:write');
    if (!guard.ok) return guard.response;

    const parsed = await readJson(request, updateSchema);
    if (!parsed.ok) return parsed.response;
    const input = parsed.data;

    if (input.email || input.username) {
      const [clash] = await db
        .select({ id: users.id })
        .from(users)
        .where(
          sql`${users.id} <> ${guard.user.id} and (
            ${input.email ? sql`lower(${users.email}) = ${input.email.toLowerCase()}` : sql`false`}
            or ${input.username ? sql`lower(${users.username}) = ${input.username.toLowerCase()}` : sql`false`}
          )`,
        )
        .limit(1);
      if (clash) return conflict('That email address or username is already in use.');
    }

    const [row] = await db
      .update(users)
      .set({
        ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
        ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
        ...(input.username !== undefined ? { username: input.username } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
      })
      .where(eq(users.id, guard.user.id))
      .returning(publicColumns);

    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: 'profile.update',
      targetType: 'user',
      targetId: guard.user.id,
      summary: 'Updated own profile',
      ip: clientIp(request.headers),
    });

    return ok(row);
  });
}
