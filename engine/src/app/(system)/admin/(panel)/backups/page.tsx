import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { can } from '@/server/auth/rbac';
import { getSessionUser } from '@/server/auth/session';
import { BackupsScreen } from './BackupsScreen';

export const metadata: Metadata = { title: 'Backups' };
export const dynamic = 'force-dynamic';

/** A backup holds every account and enquiry; the API enforces this too. */
export default async function BackupsPage() {
  const user = await getSessionUser();
  if (!user) redirect('/admin/login');
  if (!can(user, 'backups:read')) redirect('/admin');

  return <BackupsScreen canWrite={can(user, 'backups:write')} />;
}
