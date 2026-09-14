import { and, desc, eq, gt, like, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { SECURITY_SETTING_KEY, looksLikeIp, normaliseIp, securitySettingsSchema } from '@/lib/security';
import { badRequest, handle, ok, readJson } from '@/server/api/respond';
import { requireUser } from '@/server/api/guard';
import { audit } from '@/server/auth/audit';
import { clientIp } from '@/server/auth/rateLimit';
import { notifySecurity } from '@/server/mail/notify';
import { addBlock, getSecuritySettings, listBlocks, removeBlock } from '@/server/security/blocklist';
import { db } from '@/server/db';
import { auditLog, settings, users } from '@/server/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The security screen's data and actions (package 5).
 *
 * Everything here is administrator-only and audited: releasing an account or
 * an address is exactly the sort of thing somebody needs to be able to look
 * back on.
 */

/** Accounts locked now, or close enough to it to be worth showing. */
async function lockedAccounts(threshold: number) {
  return db
    .select({
      id: users.id,
      email: users.email,
      username: users.username,
      role: users.role,
      isActive: users.isActive,
      failedLoginCount: users.failedLoginCount,
      lockedUntil: users.lockedUntil,
      lastLoginAt: users.lastLoginAt,
    })
    .from(users)
    .where(or(gt(users.lockedUntil, sql`now()`), gt(users.failedLoginCount, threshold - 1)))
    .orderBy(desc(users.lockedUntil))
    .limit(50);
}

/** The sign-in story: what has been tried, refused, locked or reset lately. */
async function recentAuthEvents() {
  return db
    .select({
      id: auditLog.id,
      action: auditLog.action,
      actorEmail: auditLog.actorEmail,
      summary: auditLog.summary,
      ip: auditLog.ip,
      createdAt: auditLog.createdAt,
    })
    .from(auditLog)
    .where(or(like(auditLog.action, 'auth.%'), like(auditLog.action, 'security.%')))
    .orderBy(desc(auditLog.createdAt))
    .limit(60);
}

export async function GET(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'security:read');
    if (!guard.ok) return guard.response;

    const security = await getSecuritySettings();
    const [blocks, locked, recent] = await Promise.all([
      listBlocks(100),
      lockedAccounts(security.maxFailures),
      recentAuthEvents(),
    ]);

    return ok({ settings: security, blocks, locked, recent });
  });
}

export async function PUT(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'security:write');
    if (!guard.ok) return guard.response;

    const parsed = await readJson(request, z.object({ settings: securitySettingsSchema }));
    if (!parsed.ok) return parsed.response;
    const value = parsed.data.settings;

    await db
      .insert(settings)
      .values({ key: SECURITY_SETTING_KEY, value, updatedById: guard.user.id })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value, updatedById: guard.user.id, updatedAt: new Date() },
      });

    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: 'security.settings.update',
      targetType: 'settings',
      targetId: SECURITY_SETTING_KEY,
      summary: `Lock after ${value.maxFailures} failures for ${value.lockMinutes} minutes; automatic IP blocks ${value.autoBlockAfter === 0 ? 'off' : `after ${value.autoBlockAfter} refusals`}`,
      ip: clientIp(request.headers),
    });

    return ok({ settings: value });
  });
}

const actionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('block'),
    ip: z.string().trim().min(3).max(64),
    reason: z.string().trim().max(200).default(''),
    /** Null keeps it until somebody removes it. */
    minutes: z.number().int().min(5).max(525_600).nullable().default(null),
  }),
  z.object({ action: z.literal('unblock'), ip: z.string().trim().min(3).max(64) }),
  z.object({ action: z.literal('unlock'), userId: z.string().uuid() }),
]);

export async function POST(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'security:write');
    if (!guard.ok) return guard.response;

    const parsed = await readJson(request, actionSchema);
    if (!parsed.ok) return parsed.response;
    const input = parsed.data;
    const ip = clientIp(request.headers);

    if (input.action === 'block') {
      if (!looksLikeIp(input.ip)) return badRequest('That does not look like an IP address.');
      if (normaliseIp(input.ip) === normaliseIp(ip)) return badRequest('That is the address you are using now.');

      const row = await addBlock({
        ip: input.ip,
        reason: input.reason || 'Blocked by an administrator',
        minutes: input.minutes,
        automatic: false,
        createdById: guard.user.id,
      });

      await audit({
        actorId: guard.user.id,
        actorEmail: guard.user.email,
        action: 'security.ip.blocked',
        targetType: 'ip',
        targetId: normaliseIp(input.ip),
        summary: `Blocked ${normaliseIp(input.ip)}${input.minutes ? ` for ${input.minutes} minutes` : ' until removed'}`,
        ip,
      });

      notifySecurity({
        kind: 'ipBlocked',
        summary: `${guard.user.email} blocked ${normaliseIp(input.ip)}.`,
        facts: [
          ['Address', normaliseIp(input.ip)],
          ['Reason', input.reason || 'Blocked by an administrator'],
          ['Lasts', input.minutes ? `${input.minutes} minutes` : 'until removed'],
        ],
      });

      return ok({ block: row });
    }

    if (input.action === 'unblock') {
      const removed = await removeBlock(input.ip);
      if (!removed) return badRequest('That address is not on the list.');

      await audit({
        actorId: guard.user.id,
        actorEmail: guard.user.email,
        action: 'security.ip.unblocked',
        targetType: 'ip',
        targetId: normaliseIp(input.ip),
        summary: `Unblocked ${normaliseIp(input.ip)}`,
        ip,
      });

      return ok({ unblocked: normaliseIp(input.ip) });
    }

    // unlock
    const [account] = await db
      .update(users)
      .set({ failedLoginCount: 0, lockedUntil: null })
      .where(and(eq(users.id, input.userId), sql`true`))
      .returning({ id: users.id, email: users.email });
    if (!account) return badRequest('That account no longer exists.');

    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: 'security.account.unlocked',
      targetType: 'user',
      targetId: account.id,
      summary: `Unlocked ${account.email}`,
      ip,
    });

    return ok({ unlocked: account.email });
  });
}
