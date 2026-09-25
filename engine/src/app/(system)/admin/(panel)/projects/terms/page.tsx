import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ToastProvider } from '@/components/admin/useToast';
import { getSessionUser } from '@/server/auth/session';
import { can } from '@/server/auth/rbac';
import { getPermalinks } from '@/server/routing/config';
import { ProjectTermsScreen } from './ProjectTermsScreen';

export const metadata: Metadata = { title: 'Project categories & tags' };
export const dynamic = 'force-dynamic';

export default async function ProjectTermsPage() {
  const user = await getSessionUser();
  if (!user) redirect('/admin/login');
  if (!can(user, 'projects:read')) redirect('/admin');
  const permalinks = await getPermalinks();
  return (
    <ToastProvider>
      <ProjectTermsScreen
        canWrite={can(user, 'projectTerms:write')}
        canDesign={can(user, 'appearance:write')}
        bases={{ category: permalinks.projectCategoryBase, tag: permalinks.projectTagBase }}
      />
    </ToastProvider>
  );
}
