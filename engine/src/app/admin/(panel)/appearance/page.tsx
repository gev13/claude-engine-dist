import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/server/auth/session';
import { AppearanceScreen } from './AppearanceScreen';

export const metadata: Metadata = { title: 'Appearance' };
export const dynamic = 'force-dynamic';

/** Administrators only; the API enforces the same rule on every request. */
export default async function AppearancePage() {
  const user = await getSessionUser();
  if (!user) redirect('/admin/login');
  if (user.role !== 'admin') redirect('/admin');

  return <AppearanceScreen />;
}
