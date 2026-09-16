import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/server/auth/session';
import { can } from '@/server/auth/rbac';
import { PopupsScreen } from './PopupsScreen';

export const metadata: Metadata = { title: 'Popups' };
export const dynamic = 'force-dynamic';

/**
 * Gated on the permission, not on a role name.
 *
 * A popup appears over every page it targets, so it belongs to whoever owns the site's
 * look — an administrator *or* a manager, which is what `rbac.ts` says and
 * what the API behind this screen has always enforced. The page used to
 * check `role !== 'admin'` and bounce a manager the sidebar had just invited,
 * and its comment claimed the API agreed with it. It did not.
 *
 * `:write` rather than `:read`: every role can read, and there is nothing
 * here worth opening without being able to change it.
 */
export default async function PopupsPage() {
  const user = await getSessionUser();
  if (!user) redirect('/admin/login');
  if (!can(user, 'popups:write')) redirect('/admin');

  return <PopupsScreen />;
}
