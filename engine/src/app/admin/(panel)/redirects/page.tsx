import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/server/auth/session';
import { RedirectsScreen } from './RedirectsScreen';

export const metadata: Metadata = { title: 'Redirects' };
export const dynamic = 'force-dynamic';

/** Administrators only; the API enforces the same rule on every request. */
export default async function RedirectsPage() {
  const user = await getSessionUser();
  if (!user) redirect('/admin/login');
  if (user.role !== 'admin') redirect('/admin');

  return <RedirectsScreen />;
}
