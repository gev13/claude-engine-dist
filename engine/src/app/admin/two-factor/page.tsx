import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SiteMark } from '@/components/ui/Logo';
import { TwoFactorFlow } from './TwoFactorFlow';

export const metadata: Metadata = { title: 'Two-factor authentication' };
export const dynamic = 'force-dynamic';

export default function TwoFactorPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-5 py-16">
      <div className="w-full max-w-[440px]">
        <div className="mb-9 flex items-center gap-3">
          <span className="h-10 w-9">
            <SiteMark />
          </span>
          <span className="font-display text-[18px] font-extrabold tracking-[-0.01em]">the admin panel</span>
        </div>
        <Suspense fallback={null}>
          <TwoFactorFlow />
        </Suspense>
      </div>
    </div>
  );
}
