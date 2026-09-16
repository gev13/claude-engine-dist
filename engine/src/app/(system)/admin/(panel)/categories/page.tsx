import type { Metadata } from 'next';
import { ToastProvider } from '@/components/admin/useToast';
import { CategoriesManager } from './CategoriesManager';

export const metadata: Metadata = { title: 'Categories' };
export const dynamic = 'force-dynamic';

export default function CategoriesScreen() {
  return (
    <ToastProvider>
      <CategoriesManager />
    </ToastProvider>
  );
}
