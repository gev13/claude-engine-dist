import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { can } from '@/server/auth/rbac';
import { getSessionUser } from '@/server/auth/session';
import { LanguagesScreen } from './LanguagesScreen';

export const metadata: Metadata = { title: 'Languages' };
export const dynamic = 'force-dynamic';

/** Changing the languages changes every URL on the site. */
export default async function LanguagesPage() {
  const user = await getSessionUser();
  if (!user) redirect('/admin/login');
  if (!can(user, 'settings:write')) redirect('/admin');

  return <LanguagesScreen />;
}
