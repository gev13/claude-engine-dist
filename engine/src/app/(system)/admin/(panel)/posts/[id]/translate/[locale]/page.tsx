import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { can } from '@/server/auth/rbac';
import { getSessionUser } from '@/server/auth/session';
import { TranslateScreen } from '../../../../pages/[id]/translate/[locale]/TranslateScreen';

export const metadata: Metadata = { title: 'Translate' };
export const dynamic = 'force-dynamic';

/** The same screen as for a page; posts differ only in having an article body. */
export default async function TranslatePostPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect('/admin/login');
  if (!can(user, 'posts:write')) redirect('/admin');

  const { id, locale } = await params;
  return <TranslateScreen sourceId={id} locale={locale} kind="post" />;
}
