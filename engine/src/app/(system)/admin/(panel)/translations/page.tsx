import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { can } from '@/server/auth/rbac';
import { getSessionUser } from '@/server/auth/session';
import { localeConfig } from '@/lib/locales';
import { SiteTranslationsScreen } from './SiteTranslationsScreen';

export const metadata: Metadata = { title: 'Site translations' };
export const dynamic = 'force-dynamic';

export default async function SiteTranslationsPage() {
  const user = await getSessionUser();
  if (!user) redirect('/admin/login');
  if (!can(user, 'settings:write')) redirect('/admin');

  const config = localeConfig();
  return <SiteTranslationsScreen locales={config.locales} defaultLocale={config.defaultLocale} />;
}
