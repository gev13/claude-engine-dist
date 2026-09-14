import type { Metadata } from 'next';
import { ToastProvider } from '@/components/admin/useToast';
import { PageEditor } from '../PageEditor';

export const metadata: Metadata = { title: 'New page' };
export const dynamic = 'force-dynamic';

export default function NewPageScreen() {
  return (
    <ToastProvider>
      <PageEditor />
    </ToastProvider>
  );
}
