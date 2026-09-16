import type { Metadata } from 'next';
import { ToastProvider } from '@/components/admin/useToast';
import { JobEditor } from '../JobEditor';

export const metadata: Metadata = { title: 'New role' };
export const dynamic = 'force-dynamic';

export default function NewJobScreen() {
  return (
    <ToastProvider>
      <JobEditor />
    </ToastProvider>
  );
}
