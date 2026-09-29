import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ToastProvider } from '@/components/admin/useToast';
import { getSessionUser } from '@/server/auth/session';
import { can } from '@/server/auth/rbac';
import { SchemaScreen } from './SchemaScreen';

export const metadata: Metadata = { title: 'Structured data' };
export const dynamic = 'force-dynamic';

/** 3.20 — `settings:write`, the same as the organization's details in Settings. */
export default async function SchemaPage() {
  const user = await getSessionUser();
  if (!user) redirect('/admin/login');
  if (!can(user, 'settings:write')) redirect('/admin');
  return (
    <ToastProvider>
      <SchemaScreen />
    </ToastProvider>
  );
}
