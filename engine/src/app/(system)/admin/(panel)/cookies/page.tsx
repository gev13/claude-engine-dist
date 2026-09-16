import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ToastProvider } from '@/components/admin/useToast';
import { getSessionUser } from '@/server/auth/session';
import { can } from '@/server/auth/rbac';
import { CookiesScreen } from './CookiesScreen';

export const metadata: Metadata = { title: 'Cookie notice' };
export const dynamic = 'force-dynamic';

/**
 * Gated on the permission rather than on a role name, so this screen and the
 * API it calls cannot disagree: both read `popups:*`, which a manager holds,
 * because the notice is site chrome like the menus and the popups.
 *
 * `:read` to open and `:write` to change, the same split the Email screen
 * uses — unlike Appearance, Menus and Popups, this screen has a read-only
 * mode, so somebody who may not change the wording can still see what the
 * site is telling visitors. The sidebar still offers it only to those who can
 * change it; `tests/ui/adminNav.test.tsx` holds it to that.
 */
export default async function CookiesPage() {
  const user = await getSessionUser();
  if (!user) redirect('/admin/login');
  if (!can(user, 'popups:read')) redirect('/admin');

  return (
    <ToastProvider>
      <CookiesScreen canWrite={can(user, 'popups:write')} />
    </ToastProvider>
  );
}
