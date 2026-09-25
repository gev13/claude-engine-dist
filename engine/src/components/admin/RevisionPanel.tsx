'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { AdminButton, Alert, Panel, Spinner } from '@/components/admin/ui';
import { useToast } from '@/components/admin/useToast';
import { api, fetcher } from '@/lib/admin/client';

type Revision = {
  id: string;
  revisionNumber: number;
  reason: string;
  authorEmail: string | null;
  authorName: string | null;
  createdAt: string;
  changed: string[];
};

const FIELD_LABELS: Record<string, string> = {
  slug: 'slug',
  path: 'path',
  title: 'title',
  navLabel: 'nav label',
  summary: 'summary',
  excerpt: 'excerpt',
  status: 'status',
  blocks: 'content blocks',
  seo: 'SEO',
  parentId: 'parent',
  sortOrder: 'order',
  template: 'template',
  priorityTier: 'tier',
  body: 'body',
  kind: 'kind',
  coverMediaId: 'cover image',
  primaryCategoryId: 'category',
  readingMinutes: 'reading time',
};

function when(iso: string): string {
  const date = new Date(iso);
  const mins = Math.round((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  return date.toLocaleString();
}

/**
 * The history of one page or post.
 *
 * Restoring is a write like any other, so it appears in the list afterwards —
 * the history grows rather than rewinds, and an accidental restore can itself
 * be undone.
 */
export function RevisionPanel({
  entityType,
  entityId,
  onRestored,
}: {
  entityType: 'page' | 'post' | 'project';
  entityId: string;
  onRestored?: () => void;
}) {
  const { toast } = useToast();
  const key = `/api/admin/revisions?entityType=${entityType}&entityId=${entityId}`;
  const { data, isLoading, mutate } = useSWR<{ items: Revision[] }>(key, fetcher);
  const [restoring, setRestoring] = useState<string | null>(null);

  const items = data?.items ?? [];

  async function restore(revision: Revision) {
    const ok = window.confirm(
      `Restore revision ${revision.revisionNumber}? The current version is kept in the history, so this can be undone.`,
    );
    if (!ok) return;

    setRestoring(revision.id);
    try {
      await api(`/api/admin/revisions/${revision.id}/restore`, { method: 'POST' });
      await mutate();
      toast(`Restored revision ${revision.revisionNumber}.`, 'success');
      onRestored?.();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not restore that revision.', 'error');
    } finally {
      setRestoring(null);
    }
  }

  return (
    <Panel title={`History${items.length ? ` (${items.length})` : ''}`}>
      {isLoading && <Spinner label="Loading history" />}

      {!isLoading && items.length === 0 && (
        <p className="m-0 text-[13px] text-smoke">
          No history yet. A revision is recorded each time this is saved.
        </p>
      )}

      {items.length > 0 && (
        <ol className="m-0 list-none space-y-2 p-0">
          {items.map((revision, i) => (
            <li
              key={revision.id}
              className="flex items-start justify-between gap-3 border-2 border-hairline bg-ink px-3 py-2.5"
            >
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-[11px] text-flare">#{revision.revisionNumber}</span>
                  {i === 0 && (
                    <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-smoke">current</span>
                  )}
                  {revision.reason !== 'update' && (
                    <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-smoke">
                      {revision.reason}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-[13px] text-ash">
                  {when(revision.createdAt)}
                  {revision.authorName || revision.authorEmail
                    ? ` · ${revision.authorName ?? revision.authorEmail}`
                    : ''}
                </div>
                {revision.changed.length > 0 && (
                  <div className="mt-1 text-[12px] text-smoke">
                    changed: {revision.changed.map((f) => FIELD_LABELS[f] ?? f).join(', ')}
                  </div>
                )}
              </div>

              {i !== 0 && (
                <AdminButton
                  variant="ghost"
                  type="button"
                  onClick={() => restore(revision)}
                  disabled={restoring !== null}
                  className="shrink-0"
                >
                  {restoring === revision.id ? 'Restoring…' : 'Restore'}
                </AdminButton>
              )}
            </li>
          ))}
        </ol>
      )}

      {items.length >= 30 && (
        <div className="mt-3">
          <Alert tone="info">Only the most recent 30 revisions are kept.</Alert>
        </div>
      )}
    </Panel>
  );
}
