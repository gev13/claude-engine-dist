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
import { describeFrom, describeTo, type MatchType } from '@/lib/redirectRules';
import { cn } from '@/lib/utils';

type Redirect = {
  id: string;
  fromPath: string;
  matchType: MatchType;
  matchQuery: string;
  keepRest: boolean;
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

type Response = { items: Redirect[]; notFound: NotFound[]; canRegex: boolean };

type ImportReport = {
  dryRun: boolean;
  rows: { line: number; from: string; to: string; action: 'create' | 'update' | 'skip' | 'error'; reason?: string }[];
  counts: { create: number; update: number; skip: number; error: number };
  retargeted: number;
};

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
  const [tab, setTab] = useState<'redirects' | 'missing' | 'import'>('redirects');
  const [filter, setFilter] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [status, setStatus] = useState('301');
  const [busy, setBusy] = useState(false);

  const items = data?.items ?? [];
  const missing = data?.notFound ?? [];
  const query = filter.trim().toLowerCase();
  const shown = query
    ? items.filter((row) => `${describeFrom(row)} ${row.toPath} ${row.note}`.toLowerCase().includes(query))
    : items;

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
    if (!window.confirm(`Delete the redirect from ${describeFrom(row)}?`)) return;
    await api(`/api/admin/redirects/${row.id}`, { method: 'DELETE' });
    await mutate();
    toast('Redirect deleted.', 'success');
  }

  return (
    <>
      <PageHeader
        title="Redirects"
        description="Send old paths to new ones, and see which paths visitors are failing to reach."
        actions={
          <a
            href="/api/admin/redirects/export"
            download
            className="inline-flex items-center border-2 border-hairline px-4 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-ash hover:border-flare hover:text-bone"
          >
            Export CSV
          </a>
        }
      />

      {isLoading && <Spinner label="Loading redirects" />}

      <nav className="mb-6 flex gap-1 border-b-2 border-hairline">
        {([
          ['redirects', `Redirects${items.length ? ` (${items.length})` : ''}`],
          ['missing', `Not found${missing.length ? ` (${missing.length})` : ''}`],
          ['import', 'Import'],
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
              <Field label="From" hint="/old · /old/* for everything under it · /?s=* to match a query">
                <Input value={from} placeholder="/old-path" onChange={(e) => setFrom(e.target.value)} />
              </Field>
              <Field label="To" hint="a path or https:// URL · $1 for what * matched · /new/* keeps the rest">
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
            <p className="m-0 mt-4 text-[12px] leading-relaxed text-smoke">
              A rule fires only where a page would otherwise be missing, so it never hides live content — except a
              rule that matches a query (<code className="font-mono">/?s=*</code>), which runs first, because the
              path it sits on usually is live.
              {data?.canRegex
                ? ' A “from” starting with ^ is a regular expression; its groups are $1, $2… in the target.'
                : ''}
              {' '}A chain (A → B, B → C) is saved as one hop, and a loop is refused.
            </p>
          </Panel>

          {items.length > 8 && (
            <Input
              type="search"
              value={filter}
              placeholder="Filter redirects"
              aria-label="Filter redirects"
              onChange={(e) => setFilter(e.target.value)}
            />
          )}

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
                {shown.map((row) => (
                  <tr key={row.id} className={row.isActive ? undefined : 'opacity-50'}>
                    <Td className="font-mono text-[13px]">
                      {describeFrom(row)}
                      {row.note && <span className="block font-sans text-[12px] text-smoke">{row.note}</span>}
                    </Td>
                    <Td className="font-mono text-[13px] text-ash">{describeTo(row)}</Td>
                    <Td className="font-mono text-[12px] text-smoke">
                      {row.status === 301 ? 'permanent' : 'temporary'}
                      {row.matchType !== 'exact' && <span className="block">{row.matchType}</span>}
                    </Td>
                    <Td className="font-mono text-[12px] text-smoke">
                      {row.hits}
                      {row.lastHitAt && <span className="block">{new Date(row.lastHitAt).toLocaleDateString()}</span>}
                    </Td>
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
      ) : tab === 'import' ? (
        <ImportPanel onDone={() => void mutate()} />
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

/**
 * Import from a CSV: read the file in the browser, ask the server for the
 * plan (a dry run), show it row by row, and write it only when asked.
 */
function ImportPanel({ onDone }: { onDone: () => void }) {
  const { toast } = useToast();
  const [csv, setCsv] = useState('');
  const [name, setName] = useState('');
  const [report, setReport] = useState<ImportReport | null>(null);
  const [onDuplicate, setOnDuplicate] = useState<'update' | 'skip'>('update');
  const [busy, setBusy] = useState(false);

  async function run(dryRun: boolean) {
    setBusy(true);
    try {
      const result = await api<ImportReport>('/api/admin/redirects/import', {
        method: 'POST',
        json: { csv, dryRun, onDuplicate },
      });
      setReport(result);
      if (!dryRun) {
        toast(`Imported: ${result.counts.create} created, ${result.counts.update} updated.`, 'success');
        onDone();
      }
    } catch (error) {
      toast(error instanceof Error ? error.message : 'That file could not be read.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function pick(file: File | undefined) {
    if (!file) return;
    setName(file.name);
    setReport(null);
    setCsv(await file.text());
  }

  const writable = report ? report.counts.create + report.counts.update : 0;

  return (
    <div className="space-y-6">
      <Panel title="Import redirects">
        <div className="flex flex-col gap-4">
          <p className="m-0 text-[14px] leading-relaxed text-ash">
            A CSV with the columns <code className="font-mono text-flare-soft">from,to,status,note</code> — the
            same shape the export writes — or a redirect export from Yoast. Nothing is written until you have seen
            what it will do.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <label className="inline-flex cursor-pointer items-center border-2 border-hairline px-4 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-ash hover:border-flare hover:text-bone">
              Choose a file
              <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => void pick(e.target.files?.[0])} />
            </label>
            {name && <span className="font-mono text-[12px] text-smoke">{name}</span>}
            <Field label="A path that already has a rule">
              <Select value={onDuplicate} onChange={(e) => setOnDuplicate(e.target.value as 'update' | 'skip')}>
                <option value="update">Update it from the file</option>
                <option value="skip">Leave it as it is</option>
              </Select>
            </Field>
            <AdminButton type="button" variant="secondary" disabled={busy || !csv} onClick={() => void run(true)}>
              {busy && !report ? 'Checking…' : 'Check the file'}
            </AdminButton>
          </div>
        </div>
      </Panel>

      {report && (
        <Panel title={report.dryRun ? 'What this import will do' : 'Imported'}>
          <div className="flex flex-col gap-4">
            <p className="m-0 font-mono text-[12px] text-smoke">
              {report.counts.create} to create · {report.counts.update} to update · {report.counts.skip} skipped ·{' '}
              {report.counts.error} refused
              {report.retargeted > 0 && ` · ${report.retargeted} existing rule${report.retargeted === 1 ? '' : 's'} shortened to one hop`}
            </p>
            <Table>
              <thead>
                <tr>
                  <Th>Line</Th>
                  <Th>From</Th>
                  <Th>To</Th>
                  <Th>Result</Th>
                </tr>
              </thead>
              <tbody>
                {report.rows.slice(0, 500).map((row) => (
                  <tr key={`${row.line}-${row.from}`}>
                    <Td className="font-mono text-[12px] text-smoke">{row.line}</Td>
                    <Td className="font-mono text-[12px]">{row.from}</Td>
                    <Td className="font-mono text-[12px] text-ash">{row.to}</Td>
                    <Td className={cn('text-[12px]', row.action === 'error' ? 'text-flare-soft' : 'text-ash')}>
                      {row.action}
                      {row.reason && <span className="block text-smoke">{row.reason}</span>}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            {report.dryRun && (
              <div>
                <AdminButton type="button" disabled={busy || writable === 0} onClick={() => void run(false)}>
                  {busy ? 'Importing…' : `Import ${writable} rule${writable === 1 ? '' : 's'}`}
                </AdminButton>
              </div>
            )}
          </div>
        </Panel>
      )}
    </div>
  );
}
