'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { PageHeader } from '@/components/admin/PageHeader';
import {
  AdminButton,
  Alert,
  EmptyState,
  Field,
  Input,
  Panel,
  Select,
  Spinner,
  Table,
  Td,
  Th,
} from '@/components/admin/ui';
import { ToastProvider, useToast } from '@/components/admin/useToast';
import { api, fetcher } from '@/lib/admin/client';
import { cn } from '@/lib/utils';

type Redirect = {
  id: string;
  fromPath: string;
  toPath: string;
  status: number;
  isActive: boolean;
  note: string;
  hits: number;
  lastHitAt: string | null;
};

type NotFound = {
  id: string;
  path: string;
  hits: number;
  lastReferrer: string | null;
  lastSeenAt: string;
};

type Response = { items: Redirect[]; notFound: NotFound[] };

export function RedirectsScreen() {
  return (
    <ToastProvider>
      <RedirectsScreenInner />
    </ToastProvider>
  );
}

function RedirectsScreenInner() {
  const { toast } = useToast();
  const { data, isLoading, mutate } = useSWR<Response>('/api/admin/redirects', fetcher);
  const [tab, setTab] = useState<'redirects' | 'missing'>('redirects');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [status, setStatus] = useState('301');
  const [busy, setBusy] = useState(false);

  const items = data?.items ?? [];
  const missing = data?.notFound ?? [];

  async function create(fromPath = from, toPath = to) {
    if (!fromPath.trim() || !toPath.trim()) {
      toast('Both paths are required.', 'error');
      return;
    }
    setBusy(true);
    try {
      await api('/api/admin/redirects', {
        method: 'POST',
        json: { fromPath, toPath, status: Number(status) },
      });
      setFrom('');
      setTo('');
      await mutate();
      toast(`Redirecting ${fromPath} to ${toPath}.`, 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not create that redirect.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function toggle(row: Redirect) {
    await api(`/api/admin/redirects/${row.id}`, { method: 'PATCH', json: { isActive: !row.isActive } });
    await mutate();
  }

  async function remove(row: Redirect) {
    if (!window.confirm(`Delete the redirect from ${row.fromPath}?`)) return;
    await api(`/api/admin/redirects/${row.id}`, { method: 'DELETE' });
    await mutate();
    toast('Redirect deleted.', 'success');
  }

  return (
    <>
      <PageHeader
        title="Redirects"
        description="Send old paths to new ones, and see which paths visitors are failing to reach."
      />

      {isLoading && <Spinner label="Loading redirects" />}

      <nav className="mb-6 flex gap-1 border-b-2 border-hairline">
        {([
          ['redirects', `Redirects${items.length ? ` (${items.length})` : ''}`],
          ['missing', `Not found${missing.length ? ` (${missing.length})` : ''}`],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              '-mb-0.5 border-b-2 px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.12em] transition-colors',
              tab === key ? 'border-flare text-bone' : 'border-transparent text-smoke hover:text-bone',
            )}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === 'redirects' ? (
        <div className="space-y-6">
          <Panel title="Add a redirect">
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_120px_auto] sm:items-end">
              <Field label="From" hint="a path on this site">
                <Input value={from} placeholder="/old-path" onChange={(e) => setFrom(e.target.value)} />
              </Field>
              <Field label="To" hint="a path, or a full https:// URL">
                <Input value={to} placeholder="/new-path" onChange={(e) => setTo(e.target.value)} />
              </Field>
              <Field label="Type" hint="permanent sends 308, temporary 307">
                <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="301">Permanent</option>
                  <option value="302">Temporary</option>
                </Select>
              </Field>
              <AdminButton type="button" onClick={() => void create()} disabled={busy}>
                Add
              </AdminButton>
            </div>
          </Panel>

          {items.length === 0 ? (
            <EmptyState
              title="No redirects yet."
              body="When you change a page's path, add a redirect here so existing links keep working."
            />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>From</Th>
                  <Th>To</Th>
                  <Th>Type</Th>
                  <Th>Hits</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id} className={row.isActive ? undefined : 'opacity-50'}>
                    <Td className="font-mono text-[13px]">{row.fromPath}</Td>
                    <Td className="font-mono text-[13px] text-ash">{row.toPath}</Td>
                    <Td className="font-mono text-[12px] text-smoke">{row.status === 301 ? 'permanent' : 'temporary'}</Td>
                    <Td className="font-mono text-[12px] text-smoke">{row.hits}</Td>
                    <Td className="text-right whitespace-nowrap">
                      <AdminButton variant="ghost" type="button" onClick={() => void toggle(row)} className="mr-1">
                        {row.isActive ? 'Disable' : 'Enable'}
                      </AdminButton>
                      <AdminButton
                        variant="ghost"
                        type="button"
                        onClick={() => void remove(row)}
                        className="text-flare-soft"
                      >
                        Delete
                      </AdminButton>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      ) : missing.length === 0 ? (
        <EmptyState title="Nothing is 404ing." body="Paths visitors fail to reach will appear here." />
      ) : (
        <div className="space-y-4">
          <Alert tone="info">
            These paths returned a 404. Give one a destination and the redirect is created and the entry cleared.
          </Alert>
          <Table>
            <thead>
              <tr>
                <Th>Path</Th>
                <Th>Hits</Th>
                <Th>Last seen</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {missing.map((row) => (
                <MissingRow key={row.id} row={row} onCreate={(target) => create(row.path, target)} busy={busy} />
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </>
  );
}

/** One 404 row, with an inline "redirect this to…" box. */
function MissingRow({
  row,
  onCreate,
  busy,
}: {
  row: NotFound;
  onCreate: (target: string) => void;
  busy: boolean;
}) {
  const [target, setTarget] = useState('');

  return (
    <tr>
      <Td className="font-mono text-[13px]">{row.path}</Td>
      <Td className="font-mono text-[12px] text-smoke">{row.hits}</Td>
      <Td className="whitespace-nowrap font-mono text-[12px] text-smoke">
        {new Date(row.lastSeenAt).toLocaleDateString()}
      </Td>
      <Td className="text-right">
        <div className="flex items-center justify-end gap-2">
          <Input
            value={target}
            placeholder="/send-here"
            className="max-w-[220px]"
            onChange={(e) => setTarget(e.target.value)}
          />
          <AdminButton type="button" onClick={() => onCreate(target)} disabled={busy || !target.trim()}>
            Redirect
          </AdminButton>
        </div>
      </Td>
    </tr>
  );
}
