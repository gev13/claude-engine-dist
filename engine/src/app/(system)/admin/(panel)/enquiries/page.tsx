import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { can } from '@/server/auth/rbac';
import { getSessionUser } from '@/server/auth/session';
import { EnquiriesScreen } from './EnquiriesScreen';

export const metadata: Metadata = { title: 'Contact enquiries' };
export const dynamic = 'force-dynamic';

/**
 * The panel layout checks that somebody is signed in; this checks that they
 * may be here. Without it an author — who has no `enquiries:read` — reached a
 * shell full of failing requests rather than a redirect, which is the same
 * reason every other screen carries one.
 */
export default async function EnquiriesPage() {
  const user = await getSessionUser();
  if (!user) redirect('/admin/login');
  if (!can(user, 'enquiries:read')) redirect('/admin');

  return <EnquiriesScreen canChange={can(user, 'enquiries:write')} />;
}
