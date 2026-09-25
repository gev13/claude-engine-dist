import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ToastProvider } from '@/components/admin/useToast';
import { getSessionUser } from '@/server/auth/session';
import { can } from '@/server/auth/rbac';
import { getCookieNotice } from '@/server/content/cookies';
import { IntegrationsScreen } from './IntegrationsScreen';

export const metadata: Metadata = { title: 'Integrations' };
export const dynamic = 'force-dynamic';

/** Administrators only: a tag runs in every visitor's browser. `settings:*`, like the API. */
export default async function IntegrationsPage() {
  const user = await getSessionUser();
  if (!user) redirect('/admin/login');
  if (!can(user, 'settings:write')) redirect('/admin');
  const notice = await getCookieNotice();
  return (
    <ToastProvider>
      <IntegrationsScreen consentMode={notice.enabled && notice.mode === 'consent'} />
    </ToastProvider>
  );
}
