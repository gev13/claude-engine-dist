import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/server/auth/session';
import { can } from '@/server/auth/rbac';
import { RedirectsScreen } from './RedirectsScreen';

export const metadata: Metadata = { title: 'Redirects' };
export const dynamic = 'force-dynamic';

/**
 * A redirect can send every visitor to an arbitrary URL, so it belongs to
 * whoever owns the site rather than to content editing — an administrator or a
 * manager, which is what `rbac.ts` says and what the API has always enforced.
 * This page used to bounce the manager the sidebar had just invited.
 */
export default async function RedirectsPage() {
  const user = await getSessionUser();
  if (!user) redirect('/admin/login');
  if (!can(user, 'redirects:write')) redirect('/admin');

  return <RedirectsScreen />;
}
