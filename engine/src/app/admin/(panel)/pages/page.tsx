import type { Metadata } from 'next';
import { ToastProvider } from '@/components/admin/useToast';
import { PagesList } from './PagesList';

export const metadata: Metadata = { title: 'Pages' };
export const dynamic = 'force-dynamic';

export default function PagesScreen() {
  return (
    <ToastProvider>
      <PagesList />
    </ToastProvider>
  );
}
