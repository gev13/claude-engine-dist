import type { Metadata } from 'next';
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { env } from '@/lib/env';
import { getSiteSettings } from '@/server/content/siteSettings';
import { isInstalled } from '@/server/install/status';
import { SiteMark } from '@/components/ui/Logo';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = { title: 'Sign in' };
export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const site = await getSiteSettings();
  /* A site with no administrator has nothing to protect and nothing to show;
     send people to the installer rather than to a login they cannot pass or a
     page that does not exist yet. */
  if (!(await isInstalled())) redirect('/install');

  return (
    <div className="flex min-h-dvh items-center justify-center px-5 py-16">
      <div className="w-full max-w-[400px]">
        <div className="mb-9 flex items-center gap-3">
          <span className="h-10 w-9">
            <SiteMark />
          </span>
          <span className="font-display text-[18px] font-extrabold tracking-[-0.01em]">{site.name}</span>
        </div>

        <h1 className="display m-0 text-[30px]">Sign in</h1>
        <p className="mb-8 mt-2 text-[15px] text-ash">Administrator access to the {site.name} content system.</p>

        <Suspense fallback={null}>
          <LoginForm requireTwoFactor={env.AUTH_REQUIRE_2FA} />
        </Suspense>
      </div>
    </div>
  );
}
