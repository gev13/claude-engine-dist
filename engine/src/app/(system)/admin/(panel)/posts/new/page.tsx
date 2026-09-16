import type { Metadata } from 'next';
import { asc } from 'drizzle-orm';
import { ToastProvider } from '@/components/admin/useToast';
import { db } from '@/server/db';
import { categories } from '@/server/db/schema';
import { PostEditor, type CategoryOption } from '../PostEditor';

export const metadata: Metadata = { title: 'New post' };
export const dynamic = 'force-dynamic';

async function loadCategories(): Promise<CategoryOption[]> {
  try {
    return await db
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .orderBy(asc(categories.sortOrder), asc(categories.name));
  } catch {
    // A missing category list should not block writing a draft.
    return [];
  }
}

export default async function NewPostScreen() {
  const options = await loadCategories();

  return (
    <ToastProvider>
      <PostEditor categories={options} />
    </ToastProvider>
  );
}
