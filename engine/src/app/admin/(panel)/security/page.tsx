import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { can } from '@/server/auth/rbac';
import { getSessionUser } from '@/server/auth/session';
import { SecurityScreen } from './SecurityScreen';

export const metadata: Metadata = { title: 'Security' };
export const dynamic = 'force-dynamic';

/** Releasing accounts and addresses is administrator work; the API enforces it too. */
export default async function SecurityPage() {
  const user = await getSessionUser();
  if (!user) redirect('/admin/login');
  if (!can(user, 'security:read')) redirect('/admin');

  return <SecurityScreen canWrite={can(user, 'security:write')} />;
}
