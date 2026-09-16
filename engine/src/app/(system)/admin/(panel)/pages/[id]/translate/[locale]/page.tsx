import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { can } from '@/server/auth/rbac';
import { getSessionUser } from '@/server/auth/session';
import { TranslateScreen } from './TranslateScreen';

export const metadata: Metadata = { title: 'Translate' };
export const dynamic = 'force-dynamic';

export default async function TranslatePage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect('/admin/login');
  if (!can(user, 'pages:write')) redirect('/admin');

  const { id, locale } = await params;
  return <TranslateScreen sourceId={id} locale={locale} />;
}
