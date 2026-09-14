'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { PageHeader } from '@/components/admin/PageHeader';
import { AdminButton, Alert, Badge, Input, Panel, Spinner } from '@/components/admin/ui';
import { ToastProvider, useToast } from '@/components/admin/useToast';
import { api, fetcher } from '@/lib/admin/client';
import { errorMessage } from '../_shared';

/* ═══════════════════════════════════════════════════════════════════════════
   Updates (package 6)
   ───────────────────────────────────────────────────────────────────────────
   What this site runs, what exists, and what stands between the two. Taking
   an update is a separate, deliberate act — and on a deployment where it is
   switched off, the screen says so plainly rather than offering a button that
   would fail.
   ═══════════════════════════════════════════════════════════════════════════ */

type Pending = { version: string; date: string; summary: string };

type State = {
  autoCheck: boolean;
  checkedAt?: string;
  latestVersion?: string;
  latestDate?: string;
  latestSummary?: string;
  latestUrl?: string;
  requiresMigration?: boolean;
  pending: Pending[];
  notifiedVersion?: string;
  error?: string;
};

type RunLogLine = { step: string; ok: boolean; detail: string };

type Run = {
  status: 'idle' | 'running' | 'done' | 'failed';
  target?: string;
  fromVersion?: string;
  step?: string;
  log: RunLogLine[];
  backup?: string;
  error?: string;
  startedAt?: string;
  finishedAt?: string;
  startedByEmail?: string;
};

type Loaded = { version: string; state: State; available: boolean; canApply: boolean; run: Run };

const APPLY_CONFIRM = 'update this site';

function when(value?: string): string {
  if (!value) return 'never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'never';
  return date.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function UpdatesScreen({ canWrite }: { canWrite: boolean }) {
  return (
    <ToastProvider>
      <UpdatesScreenInner canWrite={canWrite} />
    </ToastProvider>
  );
}

function UpdatesScreenInner({ canWrite }: { canWrite: boolean }) {
  const { toast } = useToast();
  const { data, isLoading, mutate } = useSWR<Loaded>('/api/admin/updates', fetcher, {
    // While a run is going the screen follows it; otherwise it sits still.
    refreshInterval: (latest) => (latest?.run?.status === 'running' ? 3000 : 0),
  });
  const [busy, setBusy] = useState('');
  const [typed, setTyped] = useState('');

  async function act(body: Record<string, unknown>, key: string, done: string) {
    setBusy(key);
    try {
      await api('/api/admin/updates', { json: body });
      await mutate();
      toast(done, 'success');
    } catch (error) {
      toast(errorMessage(error, 'That did not work.'), 'error');
    } finally {
      setBusy('');
    }
  }

  if (isLoading) return <Spinner label="Loading updates" />;
  if (!data) return <Alert>The update status could not be loaded.</Alert>;

  const { version, state, available, canApply, run } = data;

  return (
    <>
      <PageHeader
        title="Updates"
        description="Which engine this site runs, and whether a newer one has been released."
        actions={
          canWrite ? (
            <AdminButton disabled={busy === 'check'} onClick={() => void act({ action: 'check' }, 'check', 'Checked for updates.')}>
              {busy === 'check' ? 'Checking…' : 'Check now'}
            </AdminButton>
          ) : null
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel title="This site">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
              <p className="m-0 text-[28px] font-semibold text-bone">{version}</p>
              {available ? <Badge tone="alert">{state.latestVersion} available</Badge> : <Badge tone="live">up to date</Badge>}
            </div>
            <p className="m-0 mt-3 text-[13px] text-smoke">Last checked {when(state.checkedAt)}.</p>
            {state.error && (
              <div className="mt-4">
                <Alert>{state.error}</Alert>
              </div>
            )}
          </Panel>

          {available && (
            <Panel title={`What is waiting (${state.pending.length || 1})`}>
              <div className="flex flex-col gap-3">
                {state.pending.map((release) => (
                  <div key={release.version} className="border-2 border-hairline px-4 py-3">
                    <p className="m-0 text-[15px] text-bone">
                      {release.version} <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-smoke">{release.date}</span>
                    </p>
                    {release.summary && <p className="m-0 mt-1 text-[14px] leading-relaxed text-ash">{release.summary}</p>}
                  </div>
                ))}
              </div>

              {state.requiresMigration && (
                <p className="m-0 mt-4 border-l-2 border-amber-400 pl-3 text-[13px] leading-relaxed text-amber-400">
                  One of these changes the database. A backup is taken before anything is applied.
                </p>
              )}

              {state.latestUrl && (
                <p className="m-0 mt-4 text-[13px]">
                  <a href={state.latestUrl} target="_blank" rel="noreferrer" className="text-flare-soft hover:text-bone">
                    Read the release notes
                  </a>
                </p>
              )}
            </Panel>
          )}

          <Panel title="Taking an update">
            {canApply ? (
              <>
                <p className="m-0 text-[14px] leading-relaxed text-ash">
                  This deployment may update itself. An update takes a backup, fetches the release, installs it, runs any
                  database changes, rebuilds the site and reloads it. It refuses to run on a checkout with local changes,
                  and there is no automatic rollback — the backup is how you go back.
                </p>

                {run.status === 'running' && (
                  <div className="mt-4 border-2 border-flare p-4">
                    <p className="m-0 text-[14px] text-bone">
                      Updating to {run.target} — {run.step ?? 'starting'}…
                    </p>
                    <ul className="m-0 mt-3 flex list-none flex-col gap-1 p-0">
                      {run.log.map((line, i) => (
                        <li key={`${line.step}-${i}`} className="font-mono text-[12px] text-smoke">
                          {line.ok ? '✓' : '✕'} {line.step} — {line.detail}
                        </li>
                      ))}
                    </ul>
                    <p className="m-0 mt-3 text-[13px] text-smoke">
                      The site restarts at the end, so this page may drop its connection. That is the update finishing,
                      not failing.
                    </p>
                  </div>
                )}

                {(run.status === 'done' || run.status === 'failed') && (
                  <div className={`mt-4 border-2 p-4 ${run.status === 'done' ? 'border-hairline' : 'border-flare'}`}>
                    <p className="m-0 text-[14px] text-bone">
                      {run.status === 'done'
                        ? `Updated to ${run.target}. Reload this page to see the new version.`
                        : `The update to ${run.target} stopped at ${run.step ?? 'an early step'}.`}
                    </p>
                    {run.error && <p className="m-0 mt-2 text-[13px] leading-relaxed text-amber-400">{run.error}</p>}
                    {run.backup && (
                      <p className="m-0 mt-2 text-[13px] text-smoke">
                        The site as it was is kept as <span className="font-mono">{run.backup}</span> under Backups.
                      </p>
                    )}
                    <ul className="m-0 mt-3 flex list-none flex-col gap-1 p-0">
                      {run.log.map((line, i) => (
                        <li key={`${line.step}-${i}`} className="font-mono text-[12px] text-smoke">
                          {line.ok ? '✓' : '✕'} {line.step} — {line.detail}
                        </li>
                      ))}
                    </ul>
                    {canWrite && (
                      <div className="mt-3">
                        <AdminButton variant="ghost" disabled={busy === 'clear'} onClick={() => void act({ action: 'clearRun' }, 'clear', 'Cleared.')}>
                          Clear this record
                        </AdminButton>
                      </div>
                    )}
                  </div>
                )}

                {available && canWrite && run.status !== 'running' && (
                  <div className="mt-4 border-t-2 border-hairline pt-4">
                    <p className="m-0 text-[13px] text-smoke">
                      Type <strong className="text-bone">{APPLY_CONFIRM}</strong> to update to {state.latestVersion}.
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Input value={typed} onChange={(e) => setTyped(e.target.value)} className="w-[240px]" aria-label="Confirmation" />
                      <AdminButton
                        disabled={typed !== APPLY_CONFIRM || busy === 'apply'}
                        onClick={() =>
                          void act(
                            { action: 'apply', version: state.latestVersion, confirm: APPLY_CONFIRM },
                            'apply',
                            'The update has started.',
                          ).then(() => setTyped(''))
                        }
                      >
                        {busy === 'apply' ? 'Starting…' : `Update to ${state.latestVersion}`}
                      </AdminButton>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="m-0 text-[14px] leading-relaxed text-ash">
                Updating from the panel is switched off on this deployment. Set <code className="font-mono text-[13px]">ENGINE_UPDATE_ENABLED=true</code>{' '}
                to turn it on, or update the way you deploy: pull the release, install, migrate, build and reload.
              </p>
            )}
          </Panel>
        </div>

        <aside className="flex flex-col gap-6 lg:sticky lg:top-10">
          <Panel title="Checking">
            <label className="flex items-center gap-2 text-[14px] text-ash">
              <input
                type="checkbox"
                className="h-4 w-4 accent-flare"
                checked={state.autoCheck}
                disabled={!canWrite || busy === 'auto'}
                onChange={(e) =>
                  void act({ action: 'autoCheck', value: e.target.checked }, 'auto', e.target.checked ? 'Looking for releases.' : 'No longer looking.')
                }
              />
              Look for new releases
            </label>
            <p className="m-0 mt-3 text-[13px] leading-relaxed text-smoke">
              A check reads one small file from the engine&rsquo;s repository, at most every six hours. Nothing is
              downloaded or run by checking.
            </p>
            <p className="m-0 mt-3 text-[13px] leading-relaxed text-smoke">
              When a new version appears, whoever is listed on the Email screen is told once — if engine-update messages
              are switched on there.
            </p>
          </Panel>
        </aside>
      </div>
    </>
  );
}
