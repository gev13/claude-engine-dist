'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { PageHeader } from '@/components/admin/PageHeader';
import { AdminButton, Alert, Badge, EmptyState, Field, Input, Panel, Spinner } from '@/components/admin/ui';
import { ToastProvider, useToast } from '@/components/admin/useToast';
import { api, fetcher } from '@/lib/admin/client';
import { SECURITY_DEFAULTS, type SecuritySettings, describeBlock } from '@/lib/security';
import { errorMessage } from '../_shared';

/* ═══════════════════════════════════════════════════════════════════════════
   Security (package 5)
   ───────────────────────────────────────────────────────────────────────────
   Everything about who is being kept out and why: the thresholds, the
   addresses refused at the door, the accounts locked by failed sign-ins, and
   the recent sign-in record.
   ═══════════════════════════════════════════════════════════════════════════ */

type Block = {
  ip: string;
  reason: string;
  expiresAt: string | null;
  automatic: boolean;
  hits: number;
  lastSeenAt: string | null;
  createdAt: string;
};

type LockedAccount = {
  id: string;
  email: string;
  username: string;
  role: string;
  isActive: boolean;
  failedLoginCount: number;
  lockedUntil: string | null;
  lastLoginAt: string | null;
};

type AuthEvent = {
  id: string;
  action: string;
  actorEmail: string | null;
  summary: string;
  ip: string | null;
  createdAt: string;
};

type Loaded = { settings: SecuritySettings; blocks: Block[]; locked: LockedAccount[]; recent: AuthEvent[] };

function when(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  // A lock with no end is stored far in the future; say so rather than showing the year 9999.
  if (date.getUTCFullYear() > 9000) return 'until released';
  return date.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function SecurityScreen({ canWrite }: { canWrite: boolean }) {
  return (
    <ToastProvider>
      <SecurityScreenInner canWrite={canWrite} />
    </ToastProvider>
  );
}

function SecurityScreenInner({ canWrite }: { canWrite: boolean }) {
  const { toast } = useToast();
  const { data, isLoading, mutate } = useSWR<Loaded>('/api/admin/security', fetcher);

  const [form, setForm] = useState<SecuritySettings>(SECURITY_DEFAULTS);
  const [newIp, setNewIp] = useState('');
  const [newReason, setNewReason] = useState('');
  const [newMinutes, setNewMinutes] = useState('');
  const [busy, setBusy] = useState('');

  useEffect(() => {
    if (data) setForm(data.settings);
  }, [data]);

  const set = <K extends keyof SecuritySettings>(key: K, value: SecuritySettings[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  async function saveSettings() {
    setBusy('settings');
    try {
      await api('/api/admin/security', { method: 'PUT', json: { settings: form } });
      await mutate();
      toast('Security settings saved.', 'success');
    } catch (error) {
      toast(errorMessage(error, 'Those settings could not be saved.'), 'error');
    } finally {
      setBusy('');
    }
  }

  async function act(body: Record<string, unknown>, key: string, done: string) {
    setBusy(key);
    try {
      await api('/api/admin/security', { json: body });
      await mutate();
      toast(done, 'success');
    } catch (error) {
      toast(errorMessage(error, 'That did not work.'), 'error');
    } finally {
      setBusy('');
    }
  }

  if (isLoading) return <Spinner label="Loading security" />;

  const blocks = data?.blocks ?? [];
  const locked = data?.locked ?? [];
  const recent = data?.recent ?? [];

  return (
    <>
      <PageHeader
        title="Security"
        description="Who is being kept out, and the rules that decide it. Sign-in failures, locked accounts and blocked addresses all appear here."
      />

      <div className="mb-6">
        <Alert>
          These rules stop password guessing and abusive bots. They cannot absorb a large flood of traffic — that has to
          be stopped in front of the site, by a CDN or a reverse proxy such as Cloudflare or nginx.
        </Alert>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel
            title="Blocked addresses"
            actions={<span className="font-mono text-[10px] uppercase tracking-[0.12em] text-smoke">{blocks.length} listed</span>}
          >
            {canWrite && (
              <div className="mb-5 grid gap-3 sm:grid-cols-[160px_minmax(0,1fr)_120px_auto]">
                <Field label="IP address" htmlFor="block-ip">
                  <Input id="block-ip" value={newIp} placeholder="203.0.113.9" spellCheck={false} onChange={(e) => setNewIp(e.target.value)} />
                </Field>
                <Field label="Reason" htmlFor="block-reason">
                  <Input id="block-reason" value={newReason} placeholder="Why it is being blocked" onChange={(e) => setNewReason(e.target.value)} />
                </Field>
                <Field label="Minutes" htmlFor="block-minutes" hint="blank = until removed">
                  <Input id="block-minutes" type="number" min={5} value={newMinutes} onChange={(e) => setNewMinutes(e.target.value)} />
                </Field>
                <div className="flex items-end pb-3">
                  <AdminButton
                    disabled={!newIp.trim() || busy === 'block'}
                    onClick={() =>
                      void act(
                        {
                          action: 'block',
                          ip: newIp.trim(),
                          reason: newReason.trim(),
                          minutes: newMinutes.trim() ? Number(newMinutes) : null,
                        },
                        'block',
                        `Blocked ${newIp.trim()}.`,
                      ).then(() => {
                        setNewIp('');
                        setNewReason('');
                        setNewMinutes('');
                      })
                    }
                  >
                    Block
                  </AdminButton>
                </div>
              </div>
            )}

            {blocks.length === 0 ? (
              <EmptyState title="Nothing is blocked" body="Addresses you block by hand, and any the engine blocks itself, appear here." />
            ) : (
              <div className="flex flex-col gap-2">
                {blocks.map((block) => (
                  <div key={block.ip} className="flex flex-wrap items-center justify-between gap-3 border-2 border-hairline px-4 py-3">
                    <div className="min-w-0">
                      <p className="m-0 font-mono text-[13px] text-bone">
                        {block.ip} {block.automatic && <Badge>automatic</Badge>}
                      </p>
                      <p className="m-0 text-[13px] text-smoke">
                        {block.reason || 'No reason given'} · {describeBlock({ automatic: block.automatic, expiresAt: block.expiresAt })} · {block.hits} turned away
                      </p>
                    </div>
                    {canWrite && (
                      <AdminButton variant="ghost" disabled={busy === `unblock-${block.ip}`} onClick={() => void act({ action: 'unblock', ip: block.ip }, `unblock-${block.ip}`, `Unblocked ${block.ip}.`)}>
                        Remove
                      </AdminButton>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Accounts with failed sign-ins">
            {locked.length === 0 ? (
              <EmptyState title="No accounts are locked" body="An account appears here once it has failed sign-ins against it." />
            ) : (
              <div className="flex flex-col gap-2">
                {locked.map((account) => (
                  <div key={account.id} className="flex flex-wrap items-center justify-between gap-3 border-2 border-hairline px-4 py-3">
                    <div className="min-w-0">
                      <p className="m-0 text-[14px] text-bone">
                        {account.email} <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-smoke">{account.role}</span>
                      </p>
                      <p className="m-0 text-[13px] text-smoke">
                        {account.failedLoginCount} failed · locked {when(account.lockedUntil)} · last signed in {when(account.lastLoginAt)}
                      </p>
                    </div>
                    {canWrite && (
                      <AdminButton variant="secondary" disabled={busy === `unlock-${account.id}`} onClick={() => void act({ action: 'unlock', userId: account.id }, `unlock-${account.id}`, `Unlocked ${account.email}.`)}>
                        Unlock
                      </AdminButton>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Recent sign-in activity">
            {recent.length === 0 ? (
              <EmptyState title="Nothing yet" body="Sign-ins, failures, lockouts and password resets appear here." />
            ) : (
              <div className="flex flex-col gap-1.5">
                {recent.map((event) => (
                  <div key={event.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-hairline pb-1.5 text-[13px]">
                    <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-smoke">{when(event.createdAt)}</span>
                    <span className="text-ash">{event.summary || event.action}</span>
                    <span className="font-mono text-[11px] text-smoke">
                      {event.actorEmail ?? '—'} · {event.ip ?? '—'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>

        <aside className="flex flex-col gap-6 lg:sticky lg:top-10">
          <Panel
            title="Rules"
            actions={
              canWrite ? (
                <AdminButton variant="ghost" disabled={busy === 'settings'} onClick={() => void saveSettings()}>
                  {busy === 'settings' ? 'Saving…' : 'Save'}
                </AdminButton>
              ) : null
            }
          >
            <div className="flex flex-col gap-5">
              <Field label="Lock an account after" htmlFor="sec-failures" hint="failed sign-ins">
                <Input id="sec-failures" type="number" min={3} max={20} value={form.maxFailures} disabled={!canWrite} onChange={(e) => set('maxFailures', Number(e.target.value) || 5)} />
              </Field>
              <Field label="First lock lasts" htmlFor="sec-lock" hint="minutes; each further lock lasts longer">
                <Input id="sec-lock" type="number" min={1} max={1440} value={form.lockMinutes} disabled={!canWrite} onChange={(e) => set('lockMinutes', Number(e.target.value) || 15)} />
              </Field>
              <Field label="Hold for an administrator after" htmlFor="sec-manual" hint="further failures; 0 = locks always expire">
                <Input id="sec-manual" type="number" min={0} max={10} value={form.manualUnlockAfter} disabled={!canWrite} onChange={(e) => set('manualUnlockAfter', Number(e.target.value) || 0)} />
              </Field>
              <Field label="Block an address after" htmlFor="sec-auto" hint="refused requests in an hour; 0 = never">
                <Input id="sec-auto" type="number" min={0} max={50} value={form.autoBlockAfter} disabled={!canWrite} onChange={(e) => set('autoBlockAfter', Number(e.target.value) || 0)} />
              </Field>
              <Field label="Automatic blocks last" htmlFor="sec-autolen" hint="minutes">
                <Input id="sec-autolen" type="number" min={5} max={10080} value={form.autoBlockMinutes} disabled={!canWrite} onChange={(e) => set('autoBlockMinutes', Number(e.target.value) || 60)} />
              </Field>
              <label className="flex items-center gap-2 text-[14px] text-ash">
                <input type="checkbox" className="h-4 w-4 accent-flare" checked={form.alertOnLockout} disabled={!canWrite} onChange={(e) => set('alertOnLockout', e.target.checked)} />
                Email an alert when something is locked or blocked
              </label>
              <p className="m-0 text-[13px] leading-relaxed text-smoke">
                Alerts go to the addresses on the Email screen, and only while security alerts are switched on there.
              </p>
            </div>
          </Panel>
        </aside>
      </div>
    </>
  );
}
