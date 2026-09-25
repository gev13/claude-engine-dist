import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ToastProvider } from '@/components/admin/useToast';
import { getSessionUser } from '@/server/auth/session';
import { can } from '@/server/auth/rbac';
import { WebhooksScreen } from './WebhooksScreen';

export const metadata: Metadata = { title: 'Webhooks' };
export const dynamic = 'force-dynamic';

/** Administrators only: the server fetches these addresses. `settings:*`, like the API. */
export default async function WebhooksPage() {
  const user = await getSessionUser();
  if (!user) redirect('/admin/login');
  if (!can(user, 'settings:write')) redirect('/admin');
  return (
    <ToastProvider>
      <WebhooksScreen />
    </ToastProvider>
  );
}
