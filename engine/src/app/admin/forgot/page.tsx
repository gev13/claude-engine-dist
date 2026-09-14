import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { SiteMark } from '@/components/ui/Logo';
import { getSiteSettings } from '@/server/content/siteSettings';
import { isInstalled } from '@/server/install/status';
import { ForgotForm } from './ForgotForm';

export const metadata: Metadata = { title: 'Forgotten password', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function ForgotPage() {
  const site = await getSiteSettings();
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

        <h1 className="display m-0 text-[30px]">Forgotten password</h1>
        <p className="mb-8 mt-2 text-[15px] text-ash">We will email you a link to set a new one.</p>

        <ForgotForm />
      </div>
    </div>
  );
}
