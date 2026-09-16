import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { can } from '@/server/auth/rbac';
import { getSessionUser } from '@/server/auth/session';
import { NewsletterScreen } from './NewsletterScreen';

export const metadata: Metadata = { title: 'Newsletter sign-ups' };
export const dynamic = 'force-dynamic';

/** Everyone who handles enquiries sees the list; export and removal are admin-only, here and in the API. */
export default async function NewsletterPage() {
  const user = await getSessionUser();
  if (!user) redirect('/admin/login');
  if (!can(user, 'newsletter:read')) redirect('/admin');

  return <NewsletterScreen canManage={can(user, 'newsletter:write')} />;
}
