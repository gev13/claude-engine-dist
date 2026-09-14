import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/admin/Sidebar';
import { getSessionUser } from '@/server/auth/session';
import { getSiteSettings } from '@/server/content/siteSettings';
import { isInstalled } from '@/server/install/status';

export const dynamic = 'force-dynamic';

/**
 * Server-side gate for the whole panel. The middleware already redirects
 * unauthenticated traffic; this re-checks against the database so a
 * deactivated account loses access immediately.
 */
export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  /* A site with no administrator has nothing to protect and nothing to show;
     send people to the installer rather than to a login they cannot pass or a
     page that does not exist yet. */
  if (!(await isInstalled())) redirect('/install');

  const user = await getSessionUser();
  if (!user) redirect('/admin/login');

  const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username;
  const { name: siteName } = await getSiteSettings();

  return (
    <div className="min-h-dvh">
      <Sidebar role={user.role} name={name} siteName={siteName} />
      <div className="lg:pl-[248px]">
        <div className="mx-auto max-w-[1180px] px-5 py-16 lg:px-10 lg:py-10">{children}</div>
      </div>
    </div>
  );
}
