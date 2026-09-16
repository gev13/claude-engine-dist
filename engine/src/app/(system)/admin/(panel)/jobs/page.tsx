import type { Metadata } from 'next';
import { ToastProvider } from '@/components/admin/useToast';
import { JobsList } from './JobsList';

export const metadata: Metadata = { title: 'Roles' };
export const dynamic = 'force-dynamic';

export default function JobsScreen() {
  return (
    <ToastProvider>
      <JobsList />
    </ToastProvider>
  );
}
