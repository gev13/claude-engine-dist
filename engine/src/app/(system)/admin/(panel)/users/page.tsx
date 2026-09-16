import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/server/auth/session';
import { can } from '@/server/auth/rbac';
import { UsersScreen } from './UsersScreen';

export const metadata: Metadata = { title: 'Users' };
export const dynamic = 'force-dynamic';

/**
 * Administrators only — an account that can create accounts can promote
 * itself, which is why `users:*` never widens. The API enforces this on every
 * request too; this check exists so an editor who guesses the URL gets a
 * redirect rather than a shell full of failing requests.
 *
 * Gated on the permission rather than the role name, so `rbac.ts` stays the
 * only place that decides who may open which screen.
 */
export default async function UsersPage() {
  const user = await getSessionUser();
  if (!user) redirect('/admin/login');
  if (!can(user, 'users:read')) redirect('/admin');

  return <UsersScreen currentUserId={user.id} />;
}
