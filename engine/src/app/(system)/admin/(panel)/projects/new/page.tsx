import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ToastProvider } from '@/components/admin/useToast';
import { getSessionUser } from '@/server/auth/session';
import { can } from '@/server/auth/rbac';
import { ProjectEditor } from '../ProjectEditor';
import { loadTermOptions } from '../load';

export const metadata: Metadata = { title: 'New project' };
export const dynamic = 'force-dynamic';

export default async function NewProjectScreen() {
  const user = await getSessionUser();
  if (!user) redirect('/admin/login');
  if (!can(user, 'projects:write')) redirect('/admin/projects');
  return (
    <ToastProvider>
      <ProjectEditor terms={await loadTermOptions()} media={{}} canPublish={can(user, 'projects:publish')} />
    </ToastProvider>
  );
}
