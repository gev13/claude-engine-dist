import 'server-only';
import { cookies } from 'next/headers';
import { eq } from 'drizzle-orm';
import { env, isProd } from '@/lib/env';
import type { Role } from '@/lib/roles';
import { db } from '@/server/db';
import { users } from '@/server/db/schema';
import { type AccessClaims, signAccessToken, verifyAccessToken } from './tokens';

export const ACCESS_COOKIE = 'he_at';
export const REFRESH_COOKIE = 'he_rt';
export const PENDING_2FA_COOKIE = 'he_2fa';
export const CSRF_COOKIE = 'he_csrf';

const baseCookie = {
  httpOnly: true,
  secure: isProd,
  sameSite: 'strict' as const,
  path: '/',
  ...(env.AUTH_COOKIE_DOMAIN ? { domain: env.AUTH_COOKIE_DOMAIN } : {}),
};

export async function setAccessCookie(token: string) {
  (await cookies()).set(ACCESS_COOKIE, token, { ...baseCookie, maxAge: env.AUTH_ACCESS_TTL });
}

export async function setRefreshCookie(token: string) {
  (await cookies()).set(REFRESH_COOKIE, token, {
    ...baseCookie,
    // Scoped to the refresh endpoint so it is never sent with ordinary requests.
    path: '/api/auth',
    maxAge: env.AUTH_REFRESH_TTL,
  });
}

/**
 * Double-submit CSRF token. Readable by JS on purpose: the admin client echoes
 * it in an X-CSRF-Token header, which a cross-site request cannot forge.
 */
export async function setCsrfCookie(token: string) {
  (await cookies()).set(CSRF_COOKIE, token, {
    ...baseCookie,
    httpOnly: false,
    maxAge: env.AUTH_REFRESH_TTL,
  });
}

export async function setPending2faCookie(token: string) {
  (await cookies()).set(PENDING_2FA_COOKIE, token, { ...baseCookie, maxAge: 300 });
}

export async function clearAuthCookies() {
  const jar = await cookies();
  jar.delete(ACCESS_COOKIE);
  jar.delete({ name: REFRESH_COOKIE, path: '/api/auth' });
  jar.delete(PENDING_2FA_COOKIE);
  jar.delete(CSRF_COOKIE);
}

export type SessionUser = {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: Role;
  totpEnabled: boolean;
};

/** Claims only — cheap, no database round trip. */
export async function getClaims(): Promise<AccessClaims | null> {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) return null;
  return verifyAccessToken(token);
}

/**
 * The authenticated user, re-read from the database on every call so a
 * deactivated or role-changed account loses access immediately rather than at
 * the next token expiry.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const claims = await getClaims();
  if (!claims) return null;

  try {
    const [row] = await db.select().from(users).where(eq(users.id, claims.sub)).limit(1);
    if (!row || !row.isActive) return null;
    return {
      id: row.id,
      email: row.email,
      username: row.username,
      firstName: row.firstName,
      lastName: row.lastName,
      phone: row.phone,
      role: row.role,
      totpEnabled: Boolean(row.totpEnabledAt),
    };
  } catch {
    return null;
  }
}

export async function mintAccessFor(user: {
  id: string;
  email: string;
  role: Role;
}, familyId: string) {
  return signAccessToken({ sub: user.id, email: user.email, role: user.role, fam: familyId });
}
