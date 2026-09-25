import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { ToastProvider } from '@/components/admin/useToast';
import { getSessionUser } from '@/server/auth/session';
import { can } from '@/server/auth/rbac';
import { ProjectEditor } from '../ProjectEditor';
import { loadProjectRecord, loadTermOptions } from '../load';

export const metadata: Metadata = { title: 'Edit project' };
export const dynamic = 'force-dynamic';

export default async function EditProjectScreen({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect('/admin/login');
  if (!can(user, 'projects:read')) redirect('/admin');
  const loaded = await loadProjectRecord((await params).id).catch(() => null);
  if (!loaded) notFound();
  return (
    <ToastProvider>
      <ProjectEditor
        record={loaded.record}
        media={loaded.media}
        terms={await loadTermOptions()}
        canPublish={can(user, 'projects:publish')}
      />
    </ToastProvider>
  );
}
