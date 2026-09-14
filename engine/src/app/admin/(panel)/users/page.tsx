import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/server/auth/session';
import { UsersScreen } from './UsersScreen';

export const metadata: Metadata = { title: 'Users' };
export const dynamic = 'force-dynamic';

/**
 * Administrators only. The API enforces this on every request too; this check
 * exists so an editor who guesses the URL gets a redirect rather than a shell
 * full of failing requests.
 */
export default async function UsersPage() {
  const user = await getSessionUser();
  if (!user) redirect('/admin/login');
  if (user.role !== 'admin') redirect('/admin');

  return <UsersScreen currentUserId={user.id} />;
}
