import 'server-only';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { and, eq, isNull, lt, or } from 'drizzle-orm';
import { ACCESS_AUDIENCE as AUDIENCE, ACCESS_ISSUER as ISSUER } from '@/lib/accessToken';
import { env } from '@/lib/env';
import type { Role } from '@/lib/roles';
import { db } from '@/server/db';
import { refreshTokens } from '@/server/db/schema';

const accessKey = new TextEncoder().encode(env.AUTH_ACCESS_SECRET);

export type AccessClaims = {
  sub: string;
  email: string;
  role: Role;
  /** Session family, so an access token can be tied to its refresh family. */
  fam: string;
};

/* ── Access tokens (stateless, short-lived) ───────────────────────────────── */

export async function signAccessToken(claims: AccessClaims): Promise<string> {
  return new SignJWT({ email: claims.email, role: claims.role, fam: claims.fam })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(claims.sub)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setJti(randomUUID())
    .setExpirationTime(`${env.AUTH_ACCESS_TTL}s`)
    .sign(accessKey);
}

export async function verifyAccessToken(token: string): Promise<AccessClaims | null> {
  try {
    const { payload } = await jwtVerify(token, accessKey, { issuer: ISSUER, audience: AUDIENCE });
    if (!payload.sub || typeof payload.email !== 'string' || typeof payload.role !== 'string') return null;
    if (payload.role !== 'admin' && payload.role !== 'editor') return null;
    return {
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
      fam: typeof payload.fam === 'string' ? payload.fam : '',
    };
  } catch {
    return null;
  }
}

/* ── Refresh tokens (stateful, rotating, revocable) ───────────────────────── */

function hashToken(raw: string) {
  return createHash('sha256').update(raw).digest('hex');
}

export type IssuedRefresh = { raw: string; familyId: string; expiresAt: Date };

/**
 * Issue a refresh token. Passing an existing familyId continues that session;
 * omitting it starts a new family (a fresh login).
 */
export async function issueRefreshToken(opts: {
  userId: string;
  familyId?: string;
  userAgent?: string | null;
  ip?: string | null;
}): Promise<IssuedRefresh> {
  const raw = randomBytes(48).toString('base64url');
  const familyId = opts.familyId ?? randomUUID();
  const expiresAt = new Date(Date.now() + env.AUTH_REFRESH_TTL * 1000);

  await db.insert(refreshTokens).values({
    userId: opts.userId,
    tokenHash: hashToken(raw),
    familyId,
    expiresAt,
    userAgent: opts.userAgent?.slice(0, 400) ?? null,
    ip: opts.ip ?? null,
  });

  return { raw, familyId, expiresAt };
}

export type RefreshOutcome =
  | { status: 'ok'; userId: string; familyId: string }
  | { status: 'invalid' }
  | { status: 'expired' }
  | { status: 'reused'; userId: string; familyId: string };

/**
 * Consume a refresh token exactly once.
 *
 * If a token that has already been used is presented again, the token has
 * leaked: the entire family is revoked and every session in it dies. This is
 * the standard refresh-token-rotation reuse detection.
 */
export async function consumeRefreshToken(raw: string): Promise<RefreshOutcome> {
  const tokenHash = hashToken(raw);

  const [row] = await db.select().from(refreshTokens).where(eq(refreshTokens.tokenHash, tokenHash)).limit(1);
  if (!row) return { status: 'invalid' };

  if (row.revokedAt) return { status: 'invalid' };

  if (row.usedAt) {
    await revokeFamily(row.familyId);
    return { status: 'reused', userId: row.userId, familyId: row.familyId };
  }

  if (row.expiresAt.getTime() <= Date.now()) return { status: 'expired' };

  await db.update(refreshTokens).set({ usedAt: new Date() }).where(eq(refreshTokens.id, row.id));

  return { status: 'ok', userId: row.userId, familyId: row.familyId };
}

export async function revokeFamily(familyId: string) {
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.familyId, familyId), isNull(refreshTokens.revokedAt)));
}

export async function revokeAllForUser(userId: string) {
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)));
}

/** Housekeeping: drop tokens that are expired or long revoked. */
export async function pruneRefreshTokens() {
  const cutoff = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  await db
    .delete(refreshTokens)
    .where(or(lt(refreshTokens.expiresAt, new Date()), lt(refreshTokens.revokedAt, cutoff)));
}
