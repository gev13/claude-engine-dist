'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AdminButton } from '@/components/admin/ui';
import { useToast } from '@/components/admin/useToast';
import { api } from '@/lib/admin/client';

type Kind = 'pages' | 'posts' | 'projects' | 'saved-blocks';

/**
 * Duplicate (T7, 2.15): ask the server for a draft copy — fresh block ids,
 * forms renamed, a new translation group — and open it straight away. The
 * original is not touched. `dirty` guards the editor's own button: a copy is
 * made from what is saved, so unsaved changes would not be in it.
 */
export function DuplicateButton({
  kind,
  id,
  label = 'Duplicate',
  dirty = false,
  compact = false,
}: {
  kind: Kind;
  id: string;
  label?: string;
  dirty?: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function run() {
    if (dirty && !window.confirm('The copy is made from what is saved — unsaved changes will not be in it. Duplicate anyway?')) return;
    setBusy(true);
    try {
      const copy = await api<{ editUrl: string; title?: string; name?: string }>(`/api/admin/${kind}/${id}/duplicate`, { method: 'POST' });
      toast(`Made a draft copy${copy.title || copy.name ? `: “${copy.title ?? copy.name}”` : ''}.`, 'success');
      router.push(copy.editUrl);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'That could not be duplicated.', 'error');
      setBusy(false);
    }
  }

  return (
    <AdminButton type="button" variant={compact ? 'ghost' : 'secondary'} disabled={busy} onClick={() => void run()} className={compact ? 'mr-1' : undefined}>
      {busy ? 'Copying…' : label}
    </AdminButton>
  );
}
