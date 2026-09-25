import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ToastProvider } from '@/components/admin/useToast';
import { getSessionUser } from '@/server/auth/session';
import { can } from '@/server/auth/rbac';
import { ProjectTemplateScreen } from './ProjectTemplateScreen';

export const metadata: Metadata = { title: 'Project page template' };
export const dynamic = 'force-dynamic';

/** Design, so it follows Appearance: `appearance:write`, the same as the API it calls. */
export default async function ProjectTemplatePage() {
  const user = await getSessionUser();
  if (!user) redirect('/admin/login');
  if (!can(user, 'appearance:write')) redirect('/admin/projects');
  return (
    <ToastProvider>
      <ProjectTemplateScreen />
    </ToastProvider>
  );
}
