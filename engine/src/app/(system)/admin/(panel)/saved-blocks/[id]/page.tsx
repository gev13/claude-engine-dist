import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ToastProvider } from '@/components/admin/useToast';
import { getSessionUser } from '@/server/auth/session';
import { can } from '@/server/auth/rbac';
import { SavedBlockEditor } from './SavedBlockEditor';

export const metadata: Metadata = { title: 'Saved block' };
export const dynamic = 'force-dynamic';

export default async function SavedBlockScreen({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect('/admin/login');
  if (!can(user, 'savedBlocks:write')) redirect('/admin');
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) redirect('/admin/saved-blocks');
  return (
    <ToastProvider>
      <SavedBlockEditor id={id} />
    </ToastProvider>
  );
}
