import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ToastProvider } from '@/components/admin/useToast';
import { getSessionUser } from '@/server/auth/session';
import { can } from '@/server/auth/rbac';
import { BlogArchiveScreen } from './BlogArchiveScreen';

export const metadata: Metadata = { title: 'Category pages' };
export const dynamic = 'force-dynamic';

/** Design, so it follows Appearance: `appearance:write`, the same as the API it calls. */
export default async function BlogArchivePage() {
  const user = await getSessionUser();
  if (!user) redirect('/admin/login');
  if (!can(user, 'appearance:write')) redirect('/admin/posts');
  return (
    <ToastProvider>
      <BlogArchiveScreen />
    </ToastProvider>
  );
}
