'use client';

import { useState } from 'react';
import { AdminButton } from './ui';
import { api } from '@/lib/admin/client';

/* ═══════════════════════════════════════════════════════════════════════════
   Clear the site's rendered pages
   ───────────────────────────────────────────────────────────────────────────
   Saving already revalidates what it touched, so this button is for the case
   where something still looks wrong — and it says so rather than presenting
   itself as a step in the normal flow, which would teach everybody to press
   it after every edit.

   It carries its own status text instead of a toast, because the dashboard
   has no toast provider and one button is not a reason to wrap it in one.
   ═══════════════════════════════════════════════════════════════════════════ */

export function PurgeCacheButton() {
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'failed'>('idle');

  async function purge() {
    setState('busy');
    try {
      await api('/api/admin/cache', { method: 'POST', json: {} });
      setState('done');
    } catch {
      setState('failed');
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <AdminButton
        type="button"
        variant="ghost"
        onClick={() => void purge()}
        disabled={state === 'busy'}
        title="Rebuild every page the next time it is asked for. Your own browser still needs a refresh."
      >
        {state === 'busy' ? 'Clearing…' : 'Clear cache'}
      </AdminButton>
      {state === 'done' && <span className="text-[12px] text-smoke">Cleared — refresh the site to see it.</span>}
      {state === 'failed' && <span className="text-[12px] text-flare-soft">That did not work.</span>}
    </span>
  );
}
