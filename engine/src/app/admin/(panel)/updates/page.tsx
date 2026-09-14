import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { can } from '@/server/auth/rbac';
import { getSessionUser } from '@/server/auth/session';
import { UpdatesScreen } from './UpdatesScreen';

export const metadata: Metadata = { title: 'Updates' };
export const dynamic = 'force-dynamic';

/** Which engine this site runs is administrator business; the API enforces it too. */
export default async function UpdatesPage() {
  const user = await getSessionUser();
  if (!user) redirect('/admin/login');
  if (!can(user, 'updates:read')) redirect('/admin');

  return <UpdatesScreen canWrite={can(user, 'updates:write')} />;
}
