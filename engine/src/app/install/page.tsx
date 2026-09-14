import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { SiteMark } from '@/components/ui/Logo';
import { isInstalled } from '@/server/install/status';
import { InstallWizard } from './InstallWizard';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'Install',
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = 'force-dynamic';

/**
 * The installer.
 *
 * Refuses to render once the site is installed — the API refuses too, and both
 * checks read the same two-fact gate. A page that merely hid itself would be a
 * permanent admin-account factory one URL away.
 */
export default async function InstallPage() {
  if (await isInstalled()) redirect('/admin');

  return (
    <div className="min-h-dvh bg-ink text-bone">
      <div className="mx-auto w-full max-w-[620px] px-5 py-16">
        <div className="mb-9 flex items-center gap-3">
          <span className="h-10 w-9">
            <SiteMark />
          </span>
          <span className="font-display text-[18px] font-extrabold tracking-[-0.01em]">Install</span>
        </div>

        <h1 className="display m-0 text-[30px]">Set up your site</h1>
        <p className="mb-8 mt-2 text-[15px] text-ash">
          Three steps. Nothing is created until the last one.
        </p>

        <InstallWizard />
      </div>
    </div>
  );
}
