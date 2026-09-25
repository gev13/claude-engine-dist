'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Panel } from '@/components/admin/ui';
import { useToast } from '@/components/admin/useToast';
import { api, fetcher } from '@/lib/admin/client';
import type { MediaSettings } from '@/lib/mediaSettings';
import { ROLE_CHOICES, type Role } from '@/lib/roles';
import { errorMessage } from '../_shared';

/**
 * Security → SVG uploads (T17, 2.17). An SVG is a document, so who may add
 * one is a security choice: every upload is cleaned of anything that could
 * run, and this decides who is trusted to upload at all. The media
 * library's own role still applies — this only narrows it.
 */
export function SvgUploadsPanel() {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const { data, mutate } = useSWR<{ settings: MediaSettings }>('/api/admin/media/settings', fetcher);
  if (!data) return null;
  const roles = data.settings.svgRoles;

  async function toggle(role: Role, on: boolean) {
    setBusy(true);
    const svgRoles = on ? [...roles, role] : roles.filter((r) => r !== role);
    try {
      const result = await api<{ settings: MediaSettings }>('/api/admin/media/settings', { method: 'PUT', json: { settings: { ...data!.settings, svgRoles } } });
      await mutate(result, { revalidate: false });
      toast('Saved.', 'success');
    } catch (error) {
      toast(errorMessage(error, 'That could not be saved.'), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="SVG uploads">
      <p className="m-0 mb-3 text-[13px] leading-relaxed text-smoke">
        An SVG is a small document. Each upload is rebuilt with only its shapes, text and styles — no script, no links out — and served so nothing in it can run.
        Choose who may upload one.
      </p>
      <div className="flex flex-col gap-2">
        {[...ROLE_CHOICES].reverse().map((choice) => (
          <label key={choice.value} className="flex items-center gap-2 text-[14px] text-ash">
            <input
              type="checkbox"
              className="h-4 w-4 accent-flare"
              checked={roles.includes(choice.value)}
              disabled={busy}
              onChange={(e) => void toggle(choice.value, e.target.checked)}
            />
            {choice.label}
          </label>
        ))}
      </div>
    </Panel>
  );
}
