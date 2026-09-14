import { z } from 'zod';
import { and, asc, ilike, or, sql, type SQL } from 'drizzle-orm';
import { readListParams } from '@/server/api/schemas';
import { badRequest, conflict, created, handle, ok, readJson } from '@/server/api/respond';
import { requireUser } from '@/server/api/guard';
import { audit } from '@/server/auth/audit';
import { checkPasswordPolicy, hashPassword } from '@/server/auth/password';
import { sendWelcome } from '@/server/mail/notify';
import { clientIp } from '@/server/auth/rateLimit';
import { db } from '@/server/db';
import { users } from '@/server/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Never select the hash, the TOTP secret or the recovery codes. */
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

const createSchema = z.object({
  email: z.string().email().max(255),
  username: z.string().min(3).max(64).regex(/^[a-zA-Z0-9._-]+$/, 'Letters, numbers, dot, dash and underscore only.'),
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  phone: z.string().max(40).nullable().optional(),
  role: z.enum(['admin', 'editor']),
  password: z.string().min(1).max(200),
  isActive: z.boolean().optional(),
});

export async function GET(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'users:read');
    if (!guard.ok) return guard.response;

    const { page, perPage, offset, q } = readListParams(new URL(request.url));
    const filters: SQL[] = [];
    if (q) {
      filters.push(
        or(ilike(users.email, `%${q}%`), ilike(users.username, `%${q}%`), ilike(users.lastName, `%${q}%`))!,
      );
    }
    const where = filters.length ? and(...filters) : undefined;

    const [items, [count]] = await Promise.all([
      db.select(publicColumns).from(users).where(where).orderBy(asc(users.createdAt)).limit(perPage).offset(offset),
      db.select({ n: sql<number>`count(*)::int` }).from(users).where(where),
    ]);

    return ok({ items, total: count?.n ?? 0, page, perPage });
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'users:write');
    if (!guard.ok) return guard.response;

    const parsed = await readJson(request, createSchema);
    if (!parsed.ok) return parsed.response;
    const input = parsed.data;

    const policy = checkPasswordPolicy(input.password, { email: input.email, username: input.username });
    if (!policy.ok) return badRequest(policy.reason);

    const [clash] = await db
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.email}) = ${input.email.toLowerCase()} or lower(${users.username}) = ${input.username.toLowerCase()}`)
      .limit(1);
    if (clash) return conflict('That email address or username is already in use.');

    const [row] = await db
      .insert(users)
      .values({
        email: input.email,
        username: input.username,
        firstName: input.firstName ?? '',
        lastName: input.lastName ?? '',
        phone: input.phone ?? null,
        role: input.role,
        isActive: input.isActive ?? true,
        passwordHash: await hashPassword(input.password),
      })
      .returning(publicColumns);

    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: 'user.create',
      targetType: 'user',
      targetId: row?.id,
      summary: `Created ${input.role} account for ${input.email}`,
      ip: clientIp(request.headers),
    });

    // Started, not awaited, and carries no password.
    sendWelcome({
      name: [input.firstName, input.lastName].filter(Boolean).join(' '),
      email: input.email,
      invitedBy: guard.user.email,
    });

    return created(row);
  });
}
