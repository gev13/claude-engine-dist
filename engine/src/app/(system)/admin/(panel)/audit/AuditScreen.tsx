'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { PageHeader } from '@/components/admin/PageHeader';
import { Alert, EmptyState, Field, Input, Select, Spinner, Table, Td, Th } from '@/components/admin/ui';
import { ToastProvider, useToast } from '@/components/admin/useToast';
import { fetcher } from '@/lib/admin/client';
import { Pagination, errorMessage, useDebounced } from '../_shared';

type AuditEntry = {
  id: string;
  actorId: string | null;
  actorEmail: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  summary: string;
  metadata: Record<string, unknown>;
  ip: string | null;
  requestId: string | null;
  createdAt: string;
};

type ListResponse = {
  items: AuditEntry[];
  total: number;
  page: number;
  perPage: number;
  actions: { action: string; n: number }[];
};

const PER_PAGE = 25;

function humanDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function AuditScreen() {
  return (
    <ToastProvider>
      <AuditScreenInner />
    </ToastProvider>
  );
}

function AuditScreenInner() {
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);

  const query = useDebounced(search.trim());

  // A new query always restarts at the first page.
  useEffect(() => {
    setPage(1);
  }, [query]);

  const params = new URLSearchParams({ page: String(page), perPage: String(PER_PAGE) });
  if (query) params.set('q', query);
  if (action) params.set('action', action);

  const { data, isLoading, error } = useSWR<ListResponse>(`/api/admin/audit?${params.toString()}`, fetcher);

  // The list is read-only, so the only thing worth toasting is a failed read.
  useEffect(() => {
    if (error) toast(errorMessage(error, 'Could not load the audit log.'), 'error');
  }, [error, toast]);

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Every mutation in the panel, plus reads of anything sensitive."
      />

      <div className="mb-5">
        <Alert tone="info">
          This log is append-only. Nothing here can be edited or deleted — the application exposes no such path and a
          database trigger refuses UPDATE and DELETE on the table regardless.
        </Alert>
      </div>

      <div className="mb-5 flex flex-wrap items-end gap-3">
        <Field label="Search" htmlFor="audit-search" className="w-[280px]">
          <Input
            id="audit-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Summary or target id…"
          />
        </Field>
        <Field label="Action" htmlFor="audit-action" className="w-[240px]">
          <Select
            id="audit-action"
            value={action}
            onChange={(event) => {
              setAction(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All actions</option>
            {(data?.actions ?? []).map((entry) => (
              <option key={entry.action} value={entry.action}>
                {entry.action} ({entry.n})
              </option>
            ))}
          </Select>
        </Field>
        <p className="m-0 pb-3 font-mono text-[10px] uppercase tracking-[0.12em] text-smoke">
          {total} entr{total === 1 ? 'y' : 'ies'}
        </p>
      </div>

      {isLoading && <Spinner label="Loading the audit log" />}

      {!isLoading && items.length === 0 && (
        <EmptyState title="Nothing recorded yet" body="No entries match this filter." />
      )}

      {items.length > 0 && (
        <Table>
          <thead>
            <tr>
              <Th>Time</Th>
              <Th>Actor</Th>
              <Th>Action</Th>
              <Th>Target</Th>
              <Th>Summary</Th>
              <Th>IP</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((entry) => (
              <tr key={entry.id}>
                <Td className="whitespace-nowrap font-mono text-[12px]">{humanDate(entry.createdAt)}</Td>
                <Td>{entry.actorEmail ?? '—'}</Td>
                <Td className="font-mono text-[12px] text-bone">{entry.action}</Td>
                <Td className="font-mono text-[11px]">
                  {entry.targetType ? (
                    <>
                      {entry.targetType}
                      {entry.targetId && <span className="block text-smoke">{entry.targetId}</span>}
                    </>
                  ) : (
                    '—'
                  )}
                </Td>
                <Td>{entry.summary || '—'}</Td>
                <Td className="whitespace-nowrap font-mono text-[12px]">{entry.ip ?? '—'}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <Pagination page={page} perPage={PER_PAGE} total={total} onPage={setPage} />
    </>
  );
}
