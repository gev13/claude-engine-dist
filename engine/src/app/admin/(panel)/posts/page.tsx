import type { Metadata } from 'next';
import { ToastProvider } from '@/components/admin/useToast';
import { PostsList } from './PostsList';

export const metadata: Metadata = { title: 'Posts' };
export const dynamic = 'force-dynamic';

export default function PostsScreen() {
  return (
    <ToastProvider>
      <PostsList />
    </ToastProvider>
  );
}
