import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ToastProvider } from '@/components/admin/useToast';
import { getSessionUser } from '@/server/auth/session';
import { can } from '@/server/auth/rbac';
import { ProjectsList } from './ProjectsList';

export const metadata: Metadata = { title: 'Projects' };
export const dynamic = 'force-dynamic';

export default async function ProjectsScreen() {
  const user = await getSessionUser();
  if (!user) redirect('/admin/login');
  if (!can(user, 'projects:read')) redirect('/admin');
  return (
    <ToastProvider>
      <ProjectsList canDesign={can(user, 'appearance:write')} />
    </ToastProvider>
  );
}
