import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { can } from '@/server/auth/rbac';
import { getSessionUser } from '@/server/auth/session';
import { TransferScreen } from './TransferScreen';

export const metadata: Metadata = { title: 'Export & import' };
export const dynamic = 'force-dynamic';

/** An export carries the whole site off the server; an import replaces it. */
export default async function TransferPage() {
  const user = await getSessionUser();
  if (!user) redirect('/admin/login');
  if (!can(user, 'transfer:read')) redirect('/admin');

  return <TransferScreen canWrite={can(user, 'transfer:write')} />;
}
