import type { Metadata } from 'next';
import { ToastProvider } from '@/components/admin/useToast';
import { getPermalinks } from '@/server/routing/config';
import { CategoriesManager } from './CategoriesManager';

export const metadata: Metadata = { title: 'Categories' };
export const dynamic = 'force-dynamic';

export default async function CategoriesScreen() {
  // Where a category's archive lives is a setting (Settings → Permalinks).
  const { categoryBase } = await getPermalinks();
  return (
    <ToastProvider>
      <CategoriesManager categoryBase={categoryBase} />
    </ToastProvider>
  );
}
