import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/server/auth/session';
import { can } from '@/server/auth/rbac';
import { SettingsScreen } from './SettingsScreen';

export const metadata: Metadata = { title: 'Settings' };
export const dynamic = 'force-dynamic';

/**
 * Administrators only. Gated on the permission rather than the role name, so
 * `rbac.ts` stays the only place that decides.
 */
export default async function SettingsPage() {
  const user = await getSessionUser();
  if (!user) redirect('/admin/login');
  if (!can(user, 'settings:write')) redirect('/admin');

  return <SettingsScreen />;
}
