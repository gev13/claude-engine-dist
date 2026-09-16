import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ToastProvider } from '@/components/admin/useToast';
import { getSessionUser } from '@/server/auth/session';
import { can } from '@/server/auth/rbac';
import { ApplicationsScreen } from './ApplicationsScreen';

export const metadata: Metadata = { title: 'Applications' };
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // `?job=` is how the roles list links through to one advert's applications.
  const user = await getSessionUser();
  if (!user) redirect('/admin/login');
  if (!can(user, 'applications:read')) redirect('/admin');

  const params = await searchParams;
  const job = typeof params.job === 'string' && UUID.test(params.job) ? params.job : '';

  return (
    <ToastProvider>
      <ApplicationsScreen initialJobId={job} canErase={can(user, 'applications:write')} />
    </ToastProvider>
  );
}
