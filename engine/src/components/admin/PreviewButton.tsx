'use client';

import { useState } from 'react';
import { AdminButton } from '@/components/admin/ui';
import { useToast } from '@/components/admin/useToast';
import { api } from '@/lib/admin/client';

/**
 * Mints a shareable preview link for unpublished content.
 *
 * Copies it rather than only opening it: the point of a preview link is that
 * it can be sent to somebody who does not have an admin account.
 */
export function PreviewButton({
  entityType,
  entityId,
  disabled,
}: {
  entityType: 'page' | 'post';
  entityId: string;
  disabled?: boolean;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    try {
      const result = await api<{ url: string; path: string }>('/api/admin/preview', {
        method: 'POST',
        json: { entityType, entityId },
      });

      window.open(result.path, '_blank', 'noopener');

      try {
        await navigator.clipboard.writeText(result.url);
        toast('Preview opened, and the link is on your clipboard. It expires in 7 days.', 'success');
      } catch {
        // Clipboard access is refused in plenty of contexts; the tab still opened.
        toast('Preview opened in a new tab. The link expires in 7 days.', 'success');
      }
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not create a preview link.', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminButton variant="ghost" type="button" onClick={create} disabled={disabled || busy}>
      {busy ? 'Preparing…' : 'Preview'}
    </AdminButton>
  );
}
