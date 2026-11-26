import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { can } from '@/server/auth/rbac';
import { getSessionUser } from '@/server/auth/session';
import { TranslateScreen } from '../../../../pages/[id]/translate/[locale]/TranslateScreen';

export const metadata: Metadata = { title: 'Translate' };
export const dynamic = 'force-dynamic';

/** 3.37 — the same screen as a page; a saved block is a name, a description and its blocks' words. */
export default async function TranslateSavedBlockPage({ params }: { params: Promise<{ id: string; locale: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect('/admin/login');
  if (!can(user, 'savedBlocks:write')) redirect('/admin');

  const { id, locale } = await params;
  return <TranslateScreen sourceId={id} locale={locale} kind="savedBlock" />;
}
