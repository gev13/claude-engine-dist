import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { can } from '@/server/auth/rbac';
import { getSessionUser } from '@/server/auth/session';
import { WordPressImportScreen } from './WordPressImportScreen';

export const metadata: Metadata = { title: 'Import from WordPress' };
export const dynamic = 'force-dynamic';

/** An import writes content across the whole site, so it is Export & import's permission. */
export default async function WordPressImportPage() {
  const user = await getSessionUser();
  if (!user) redirect('/admin/login');
  if (!can(user, 'transfer:write')) redirect('/admin');

  return <WordPressImportScreen />;
}
