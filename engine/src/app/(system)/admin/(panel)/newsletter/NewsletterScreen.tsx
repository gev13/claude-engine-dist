'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { PageHeader } from '@/components/admin/PageHeader';
import { EmptyState, Field, Input, Spinner, Table, Td, Th } from '@/components/admin/ui';
import { ToastProvider, useToast } from '@/components/admin/useToast';
import { api, fetcher } from '@/lib/admin/client';
import { ConfirmDelete, Pagination, errorMessage, useDebounced } from '../_shared';

type Subscriber = {
  id: string;
  email: string;
  source: string;
  consentAt: string | null;
  createdAt: string;
};

type ListResponse = { items: Subscriber[]; total: number; page: number; perPage: number };

const PER_PAGE = 25;

function humanDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** `canManage` shows export and remove; the API enforces both regardless. */
export function NewsletterScreen({ canManage }: { canManage: boolean }) {
  return (
    <ToastProvider>
      <NewsletterScreenInner canManage={canManage} />
    </ToastProvider>
  );
}

function NewsletterScreenInner({ canManage }: { canManage: boolean }) {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState<string | null>(null);

  const query = useDebounced(search.trim());

  // A new query always restarts at the first page.
  useEffect(() => {
    setPage(1);
  }, [query]);

  const params = new URLSearchParams({ page: String(page), perPage: String(PER_PAGE) });
  if (query) params.set('q', query);

  const { data, isLoading, mutate } = useSWR<ListResponse>(`/api/admin/newsletter?${params.toString()}`, fetcher);
  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  async function remove(row: Subscriber) {
    setBusy(row.id);
    try {
      await api(`/api/admin/newsletter/${row.id}`, { method: 'DELETE' });
      toast(`Removed ${row.email}.`, 'success');
      await mutate();
    } catch (error) {
      toast(errorMessage(error, 'Could not remove that sign-up.'), 'error');
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Newsletter sign-ups"
        description="Addresses collected by newsletter blocks on the site. The site does not send email yet — export the list and send from your mail service."
      />

      <div className="mb-5 flex flex-wrap items-end gap-3">
        <Field label="Search" htmlFor="newsletter-search" className="w-[280px]">
          <Input
            id="newsletter-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Email address…"
          />
        </Field>
        <p className="m-0 pb-3 font-mono text-[10px] uppercase tracking-[0.12em] text-smoke">
          {total} sign-up{total === 1 ? '' : 's'}
        </p>
        <span className="flex-1" />
        {canManage && total > 0 && (
          // A file download from an API route, not a page, so not a <Link>.
          <a
            href="/api/admin/newsletter?format=csv"
            download
            className="mb-1 inline-flex items-center border-2 border-hairline px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.12em] text-bone transition-colors hover:border-flare"
          >
            Export CSV
          </a>
        )}
      </div>

      {isLoading && <Spinner label="Loading sign-ups" />}

      {!isLoading && items.length === 0 && (
        <EmptyState
          title={query ? 'No sign-ups match' : 'No sign-ups yet'}
          body={query ? 'Try a different address.' : 'Add a newsletter block to a page; addresses people leave there appear here.'}
        />
      )}

      {items.length > 0 && (
        <Table>
          <thead>
            <tr>
              <Th>Email</Th>
              <Th>Signed up</Th>
              <Th>Consent</Th>
              <Th>Page</Th>
              {canManage && <Th>{''}</Th>}
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.id}>
                <Td>
                  <span className="text-bone">{row.email}</span>
                </Td>
                <Td>{humanDate(row.createdAt)}</Td>
                <Td>{row.consentAt ? humanDate(row.consentAt) : '—'}</Td>
                <Td>{row.source || '—'}</Td>
                {canManage && (
                  <Td>
                    <ConfirmDelete
                      onConfirm={() => remove(row)}
                      busy={busy === row.id}
                      label="Remove"
                      confirmLabel="Remove for good"
                    />
                  </Td>
                )}
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <Pagination page={page} perPage={PER_PAGE} total={total} onPage={setPage} />
    </>
  );
}
