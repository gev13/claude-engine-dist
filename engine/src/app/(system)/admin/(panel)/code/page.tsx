import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ToastProvider } from '@/components/admin/useToast';
import { getSessionUser } from '@/server/auth/session';
import { can } from '@/server/auth/rbac';
import { CodeScreen } from './CodeScreen';

export const metadata: Metadata = { title: 'Custom code' };
export const dynamic = 'force-dynamic';

/**
 * `settings:write`, like Appearance — this row loads on every page of the
 * site, which is the same reach the theme has. There is no read-only mode
 * because there is no `settings:read`: nobody else can open this screen.
 */
export default async function CodePage() {
  const user = await getSessionUser();
  if (!user) redirect('/admin/login');
  if (!can(user, 'settings:write')) redirect('/admin');

  return (
    <ToastProvider>
      <CodeScreen canWrite />
    </ToastProvider>
  );
}
