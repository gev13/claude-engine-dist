'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { PageHeader } from '@/components/admin/PageHeader';
import { AdminButton, Alert, Badge, EmptyState, Input, Panel, Spinner } from '@/components/admin/ui';
import { ToastProvider, useToast } from '@/components/admin/useToast';
import { api, fetcher } from '@/lib/admin/client';
import { errorMessage } from '../_shared';

/* ═══════════════════════════════════════════════════════════════════════════
   Backups (package 6)
   ───────────────────────────────────────────────────────────────────────────
   Taking one is ordinary. Restoring one replaces every page, account and
   enquiry on the site, so it asks the administrator to type the words — and
   says, before they do, that the site as it stands will be kept.
   ═══════════════════════════════════════════════════════════════════════════ */

type Backup = {
  id: string;
  filename: string;
  reason: string;
  engineVersion: string;
  byteSize: number;
  contents: Record<string, number>;
  includesMedia: boolean;
  status: 'running' | 'ready' | 'failed';
  error: string | null;
  createdAt: string;
};

type Loaded = { items: Backup[]; orphans: string[]; engineVersion: string };

const CONFIRM = 'replace everything';

function size(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function when(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function rows(contents: Record<string, number>): string {
  const total = Object.values(contents).reduce((sum, n) => sum + n, 0);
  return `${total.toLocaleString('en-GB')} rows`;
}

export function BackupsScreen({ canWrite }: { canWrite: boolean }) {
  return (
    <ToastProvider>
      <BackupsScreenInner canWrite={canWrite} />
    </ToastProvider>
  );
}

function BackupsScreenInner({ canWrite }: { canWrite: boolean }) {
  const { toast } = useToast();
  const { data, isLoading, mutate } = useSWR<Loaded>('/api/admin/backups', fetcher);
  const [busy, setBusy] = useState('');
  const [includeMedia, setIncludeMedia] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [typed, setTyped] = useState('');

  async function act(body: Record<string, unknown>, key: string, done: string) {
    setBusy(key);
    try {
      await api('/api/admin/backups', { json: body });
      await mutate();
      toast(done, 'success');
      return true;
    } catch (error) {
      toast(errorMessage(error, 'That did not work.'), 'error');
      return false;
    } finally {
      setBusy('');
    }
  }

  async function restore(filename: string) {
    setBusy(`restore-${filename}`);
    try {
      await api('/api/admin/backups', { json: { action: 'restore', filename, confirm: CONFIRM } });
      // Every session was ended, including this one: send them to sign in again.
      window.location.href = '/admin/login';
    } catch (error) {
      toast(errorMessage(error, 'The restore did not happen.'), 'error');
      setBusy('');
    }
  }

  if (isLoading) return <Spinner label="Loading backups" />;

  const items = data?.items ?? [];
  const orphans = data?.orphans ?? [];

  return (
    <>
      <PageHeader
        title="Backups"
        description="A copy of every page, post, account, setting and uploaded file, in one archive you can download."
        actions={
          canWrite ? (
            <AdminButton
              disabled={busy === 'create'}
              onClick={() => void act({ action: 'create', includeMedia }, 'create', 'Backup taken.')}
            >
              {busy === 'create' ? 'Taking a backup…' : 'Take a backup'}
            </AdminButton>
          ) : null
        }
      />

      <div className="mb-6">
        <Alert tone="info">
          Sign-in sessions, password reset links and the audit log are deliberately left out: the first two are
          short-lived secrets, and an append-only log is not something to restore over.
        </Alert>
      </div>

      {canWrite && (
        <div className="mb-5">
          <label className="flex items-center gap-2 text-[14px] text-ash">
            <input type="checkbox" className="h-4 w-4 accent-flare" checked={includeMedia} onChange={(e) => setIncludeMedia(e.target.checked)} />
            Include uploaded files
          </label>
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState title="No backups yet" body="Take one before an update, or before anything else you would rather be able to undo." />
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((backup) => (
            <article key={backup.id} className="border-2 border-hairline p-4">
              <header className="flex flex-wrap items-baseline justify-between gap-3">
                <div className="min-w-0">
                  <p className="m-0 font-mono text-[13px] text-bone">
                    {backup.filename}{' '}
                    {backup.status === 'ready' ? (
                      <Badge tone="live">ready</Badge>
                    ) : backup.status === 'failed' ? (
                      <Badge tone="alert">failed</Badge>
                    ) : (
                      <Badge tone="draft">running</Badge>
                    )}
                  </p>
                  <p className="m-0 mt-1 text-[13px] text-smoke">
                    {when(backup.createdAt)} · engine {backup.engineVersion} · {size(backup.byteSize)} · {rows(backup.contents)} ·{' '}
                    {backup.includesMedia ? 'with files' : 'database only'} · {backup.reason}
                  </p>
                  {backup.error && <p className="m-0 mt-1 text-[13px] text-amber-400">{backup.error}</p>}
                </div>

                {backup.status === 'ready' && (
                  <div className="flex flex-wrap items-center gap-2">
                    {/* A file download from an API route, so a plain link. */}
                    <a
                      href={`/api/admin/backups?download=${encodeURIComponent(backup.filename)}`}
                      download
                      className="inline-flex items-center border-2 border-hairline px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.12em] text-bone transition-colors hover:border-flare"
                    >
                      Download
                    </a>
                    {canWrite && (
                      <>
                        <AdminButton
                          variant="secondary"
                          onClick={() => {
                            setRestoring(restoring === backup.filename ? null : backup.filename);
                            setTyped('');
                          }}
                        >
                          Restore
                        </AdminButton>
                        <AdminButton
                          variant="ghost"
                          disabled={busy === `delete-${backup.filename}`}
                          onClick={() => void act({ action: 'delete', filename: backup.filename }, `delete-${backup.filename}`, 'Backup deleted.')}
                        >
                          Delete
                        </AdminButton>
                      </>
                    )}
                  </div>
                )}
              </header>

              {restoring === backup.filename && (
                <div className="mt-4 border-2 border-flare p-4">
                  <p className="m-0 text-[14px] leading-relaxed text-bone">
                    Restoring replaces every page, post, account, setting and uploaded file with what this archive holds.
                    The site as it stands now is backed up first, and everybody is signed out.
                  </p>
                  <p className="m-0 mt-3 text-[13px] text-smoke">
                    Type <strong className="text-bone">{CONFIRM}</strong> to continue.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Input value={typed} onChange={(e) => setTyped(e.target.value)} className="w-[240px]" aria-label="Confirmation" />
                    <AdminButton disabled={typed !== CONFIRM || busy === `restore-${backup.filename}`} onClick={() => void restore(backup.filename)}>
                      {busy === `restore-${backup.filename}` ? 'Restoring…' : 'Restore this backup'}
                    </AdminButton>
                    <AdminButton variant="ghost" onClick={() => setRestoring(null)}>
                      Cancel
                    </AdminButton>
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {orphans.length > 0 && (
        <div className="mt-6">
          <Panel title="Archives with no record">
            <p className="m-0 mb-3 text-[13px] leading-relaxed text-ash">
              These files are in the backup directory but this site has no row for them — copied in from elsewhere, or
              left behind by a restore. They can still be restored by putting them back through the same directory.
            </p>
            <ul className="m-0 flex list-none flex-col gap-1 p-0 font-mono text-[12px] text-smoke">
              {orphans.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          </Panel>
        </div>
      )}
    </>
  );
}
