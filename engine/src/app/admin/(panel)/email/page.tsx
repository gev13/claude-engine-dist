import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { can } from '@/server/auth/rbac';
import { getSessionUser } from '@/server/auth/session';
import { EmailScreen } from './EmailScreen';

export const metadata: Metadata = { title: 'Email' };
export const dynamic = 'force-dynamic';

/** Mail credentials belong to the administrator; the API enforces it too. */
export default async function EmailPage() {
  const user = await getSessionUser();
  if (!user) redirect('/admin/login');
  if (!can(user, 'email:read')) redirect('/admin');

  return <EmailScreen canWrite={can(user, 'email:write')} />;
}
