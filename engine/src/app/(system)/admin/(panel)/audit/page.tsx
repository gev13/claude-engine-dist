import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/server/auth/session';
import { can } from '@/server/auth/rbac';
import { AuditScreen } from './AuditScreen';

export const metadata: Metadata = { title: 'Audit log' };
export const dynamic = 'force-dynamic';

/**
 * The audit log is the administrator's alone. Gated on the permission rather
 * than the role name, so `rbac.ts` stays the only place that decides.
 */
export default async function AuditPage() {
  const user = await getSessionUser();
  if (!user) redirect('/admin/login');
  if (!can(user, 'audit:read')) redirect('/admin');

  return <AuditScreen />;
}
