import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ToastProvider } from '@/components/admin/useToast';
import { getSessionUser } from '@/server/auth/session';
import { can } from '@/server/auth/rbac';
import { PermalinksScreen } from './PermalinksScreen';

export const metadata: Metadata = { title: 'Permalinks' };
export const dynamic = 'force-dynamic';

/**
 * Where the blog lives. `settings:write`, like the API it calls — moving every
 * post's address is Settings-sized reach, not a manager's day-to-day screen.
 */
export default async function PermalinksPage() {
  const user = await getSessionUser();
  if (!user) redirect('/admin/login');
  if (!can(user, 'settings:write')) redirect('/admin');

  return (
    <ToastProvider>
      <PermalinksScreen />
    </ToastProvider>
  );
}
