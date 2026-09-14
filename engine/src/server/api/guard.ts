import 'server-only';
import { cookies } from 'next/headers';
import { CSRF_COOKIE, type SessionUser, getSessionUser } from '@/server/auth/session';
import { type Permission, can } from '@/server/auth/rbac';
import { forbidden, unauthorized } from './respond';

export type Guarded = { user: SessionUser };

/**
 * The single entry point for authorising an admin API request.
 *
 * Order matters: authenticate, then verify CSRF for state-changing verbs, then
 * check the permission. Every check happens server-side on every request; the
 * UI never carries the decision.
 */
export async function requireUser(
  request: Request,
  permission: Permission,
): Promise<{ ok: true; user: SessionUser } | { ok: false; response: Response }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, response: unauthorized() };

  const method = request.method.toUpperCase();
  if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
    const header = request.headers.get('x-csrf-token');
    const cookie = (await cookies()).get(CSRF_COOKIE)?.value;
    if (!header || !cookie || header !== cookie) {
      return { ok: false, response: forbidden('CSRF check failed. Reload the page and try again.') };
    }
  }

  if (!can(user, permission)) return { ok: false, response: forbidden() };

  return { ok: true, user };
}
