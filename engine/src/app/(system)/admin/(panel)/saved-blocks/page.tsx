import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ToastProvider } from '@/components/admin/useToast';
import { getSessionUser } from '@/server/auth/session';
import { can } from '@/server/auth/rbac';
import { SavedBlocksList } from './SavedBlocksList';

export const metadata: Metadata = { title: 'My blocks' };
export const dynamic = 'force-dynamic';

/** Managing saved blocks changes every page that uses them — `savedBlocks:write`, like the API. */
export default async function SavedBlocksScreen() {
  const user = await getSessionUser();
  if (!user) redirect('/admin/login');
  if (!can(user, 'savedBlocks:write')) redirect('/admin');
  return (
    <ToastProvider>
      <SavedBlocksList />
    </ToastProvider>
  );
}
