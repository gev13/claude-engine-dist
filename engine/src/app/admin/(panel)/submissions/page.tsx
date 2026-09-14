import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { can } from '@/server/auth/rbac';
import { getSessionUser } from '@/server/auth/session';
import { SubmissionsScreen } from './SubmissionsScreen';

export const metadata: Metadata = { title: 'Form submissions' };
export const dynamic = 'force-dynamic';

/** Everyone who handles enquiries reads them; export and deletion are admin-only, here and in the API. */
export default async function SubmissionsPage() {
  const user = await getSessionUser();
  if (!user) redirect('/admin/login');
  if (!can(user, 'submissions:read')) redirect('/admin');

  return <SubmissionsScreen canManage={can(user, 'submissions:write')} />;
}
