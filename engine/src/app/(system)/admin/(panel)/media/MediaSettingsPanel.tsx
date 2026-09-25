'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { AdminButton, Panel } from '@/components/admin/ui';
import { useToast } from '@/components/admin/useToast';
import { api, fetcher } from '@/lib/admin/client';
import type { MediaSettings } from '@/lib/mediaSettings';
import { RESPONSIVE_WIDTHS } from '@/lib/responsive';
import { errorMessage } from '../_shared';

/* ═══════════════════════════════════════════════════════════════════════════
   Media → Picture sizes (T18, 2.17)
   ───────────────────────────────────────────────────────────────────────────
   Responsive images are one switch, off until chosen; switching them on
   offers to make sizes for the pictures already here, and the job runs in
   the background while this panel reports how far it has got.
   ═══════════════════════════════════════════════════════════════════════════ */

type Job = { running: boolean; total: number; done: number; failed: number; startedAt: string | null; finishedAt: string | null };
type Loaded = { settings: MediaSettings; job: Job; missing: number };

export function MediaSettingsPanel() {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const { data, mutate } = useSWR<Loaded>('/api/admin/media/settings', fetcher, {
    // Poll while sizes are being made; otherwise leave the server alone.
    refreshInterval: (latest) => (latest?.job.running ? 1500 : 0),
  });
  if (!data) return null;
  const { settings, job, missing } = data;

  async function save(patch: Partial<MediaSettings>) {
    setBusy(true);
    try {
      const result = await api<Loaded>('/api/admin/media/settings', { method: 'PUT', json: { settings: { ...settings, ...patch } } });
      await mutate(result, { revalidate: false });
      toast('Saved.', 'success');
    } catch (error) {
      toast(errorMessage(error, 'That could not be saved.'), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function generate(onlyMissing: boolean) {
    setBusy(true);
    try {
      const result = await api<{ job: Job; missing: number }>('/api/admin/media/sizes', { json: { onlyMissing } });
      await mutate({ ...data!, ...result }, { revalidate: false });
    } catch (error) {
      toast(errorMessage(error, 'Sizes could not be started.'), 'error');
    } finally {
      setBusy(false);
    }
  }

  const progress = job.total ? Math.round(((job.done + job.failed) / job.total) * 100) : 0;

  return (
    <Panel title="Picture sizes">
      <div className="flex flex-col gap-4">
        <label className="flex items-start gap-2.5 text-[14px] text-ash">
          <input type="checkbox" className="mt-1 h-4 w-4 accent-flare" checked={settings.responsive} disabled={busy} onChange={(e) => void save({ responsive: e.target.checked })} />
          <span>
            Responsive images
            <span className="block text-[13px] text-smoke">
              Each picture gets smaller copies ({RESPONSIVE_WIDTHS.join(', ')} pixels wide, never wider than the original), and every image on the site offers them,
              so a phone downloads a phone-sized picture. GIFs keep their animation and SVGs need none.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-2.5 text-[14px] text-ash">
          <input type="checkbox" className="mt-1 h-4 w-4 accent-flare" checked={settings.avif} disabled={busy || !settings.responsive} onChange={(e) => void save({ avif: e.target.checked })} />
          <span>
            Also make AVIF copies
            <span className="block text-[13px] text-smoke">Smaller again for browsers that take them; slower to make. Run “Make sizes for every picture” after changing this.</span>
          </span>
        </label>

        {settings.responsive && (
          <div className="border-t-2 border-hairline pt-4">
            {job.running ? (
              <>
                <p className="m-0 text-[14px] text-ash">
                  Making sizes… {job.done + job.failed} of {job.total}
                  {job.failed ? ` (${job.failed} could not be read)` : ''}
                </p>
                <div className="mt-2 h-1.5 bg-hairline" aria-hidden="true">
                  <div className="h-full bg-flare" style={{ width: `${progress}%` }} />
                </div>
              </>
            ) : (
              <>
                <p className="m-0 text-[14px] text-ash">
                  {missing === 0 ? 'Every picture has its sizes.' : `${missing} picture${missing === 1 ? ' has' : 's have'} no sizes yet — ${missing === 1 ? 'it is' : 'they are'} served whole until then.`}
                  {job.finishedAt && ` Last run: ${job.done} made${job.failed ? `, ${job.failed} failed` : ''}.`}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {missing > 0 && (
                    <AdminButton type="button" disabled={busy} onClick={() => void generate(true)}>
                      Make the missing sizes
                    </AdminButton>
                  )}
                  <AdminButton type="button" variant="secondary" disabled={busy} onClick={() => void generate(false)}>
                    Make sizes for every picture
                  </AdminButton>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </Panel>
  );
}
