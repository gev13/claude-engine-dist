'use client';

import { DuplicateButton } from '@/components/admin/DuplicateButton';
import Link from 'next/link';
import { useState } from 'react';
import useSWR from 'swr';
import { PageHeader } from '@/components/admin/PageHeader';
import { AdminButton, AdminLinkButton, Alert, Badge, EmptyState, Input, Panel, Select, Spinner, Table, Td, Th } from '@/components/admin/ui';
import { useToast } from '@/components/admin/useToast';
import { api, fetcher } from '@/lib/admin/client';
import { formatDate } from '@/lib/utils';
import { ConfirmDelete, Pagination, StatusBadge, errorMessage, useDebounced } from '../_shared';

type PageRow = {
  id: string;
  slug: string;
  path: string;
  title: string;
  navLabel: string | null;
  status: 'draft' | 'published' | 'archived';
  template: string;
  priorityTier: string | null;
  isSystem: boolean;
  blockCount: number;
  updatedAt: string;
};

type ListResponse = { items: PageRow[]; total: number; page: number; perPage: number };

const PER_PAGE = 20;

export function PagesList() {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [trashed, setTrashed] = useState(false);

  const query = useDebounced(search);

  const params = new URLSearchParams({ page: String(page), perPage: String(PER_PAGE) });
  if (query) params.set('q', query);
  if (status !== 'all') params.set('status', status);
  if (trashed) params.set('trashed', '1');

  const { data, error, isLoading, mutate } = useSWR<ListResponse>(
    `/api/admin/pages?${params.toString()}`,
    fetcher,
    { keepPreviousData: true },
  );

  const items = data?.items ?? [];
  const filtering = query !== '' || status !== 'all';

  /** Any change to the filters invalidates the current page number. */
  function refilter(apply: () => void) {
    apply();
    setPage(1);
  }

  async function restore(row: PageRow) {
    setDeleting(row.id);
    try {
      await api(`/api/admin/pages/${row.id}/restore`, { method: 'POST' });
      toast(`Restored "${row.title}" as a draft.`, 'success');
      await mutate();
    } catch (caught) {
      toast(errorMessage(caught, 'The page could not be restored.'), 'error');
    } finally {
      setDeleting(null);
    }
  }

  async function remove(row: PageRow) {
    setDeleting(row.id);
    try {
      // In the trash a delete is permanent; everywhere else it trashes.
      await api(`/api/admin/pages/${row.id}${trashed ? '?permanent=true' : ''}`, { method: 'DELETE' });
      toast(trashed ? `Deleted "${row.title}" permanently.` : `Moved "${row.title}" to the trash.`, 'success');
      await mutate();
    } catch (caught) {
      toast(errorMessage(caught, 'The page could not be deleted.'), 'error');
    } finally {
      setDeleting(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Pages"
        description="Every fixed page on the site, built from blocks."
        actions={<AdminLinkButton href="/admin/pages/new">New page</AdminLinkButton>}
      />

      <Panel>
        <div className="mb-5 flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <Input
              type="search"
              value={search}
              onChange={(e) => refilter(() => setSearch(e.target.value))}
              placeholder="Search title, slug or path…"
              aria-label="Search pages"
            />
          </div>
          <Select
            value={status}
            onChange={(e) => refilter(() => setStatus(e.target.value))}
            aria-label="Filter by status"
            className="w-[170px]"
          >
            <option value="all">All statuses</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </Select>
          <button
            type="button"
            onClick={() => refilter(() => setTrashed(!trashed))}
            className={
              trashed
                ? 'border-2 border-flare px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-bone'
                : 'border-2 border-hairline px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-smoke hover:text-bone'
            }
          >
            {trashed ? 'Viewing trash' : 'Trash'}
          </button>
          {isLoading && <Spinner />}
        </div>

        {error ? (
          <Alert tone="error">{errorMessage(error, 'The page list could not be loaded.')}</Alert>
        ) : items.length === 0 ? (
          <EmptyState
            title={trashed ? 'The trash is empty.' : filtering ? 'Nothing matches those filters.' : 'No pages yet.'}
            body={
              filtering
                ? 'Try a broader search, or clear the status filter.'
                : 'Pages carry the fixed parts of the site — services, about, contact.'
            }
            action={!filtering && <AdminLinkButton href="/admin/pages/new">New page</AdminLinkButton>}
          />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Title</Th>
                  <Th>Path</Th>
                  <Th>Template</Th>
                  <Th>Status</Th>
                  <Th>Updated</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id}>
                    <Td>
                      <Link href={`/admin/pages/${row.id}`} className="text-bone hover:text-flare-soft">
                        {row.title}
                      </Link>
                      <div className="mt-0.5 font-mono text-[11px] text-smoke">
                        {row.blockCount} block{row.blockCount === 1 ? '' : 's'}
                        {row.isSystem && ' · system'}
                      </div>
                    </Td>
                    <Td className="font-mono text-[12px] text-smoke">{row.path}</Td>
                    <Td>
                      <Badge>{row.template}</Badge>
                    </Td>
                    <Td>
                      <StatusBadge status={row.status} />
                    </Td>
                    <Td className="whitespace-nowrap font-mono text-[12px] text-smoke">{formatDate(row.updatedAt)}</Td>
                    <Td className="text-right whitespace-nowrap">
                      {!trashed && <DuplicateButton kind="pages" id={row.id} compact />}
                      {trashed && (
                        <AdminButton
                          variant="ghost"
                          type="button"
                          onClick={() => restore(row)}
                          disabled={deleting === row.id}
                          className="mr-1"
                        >
                          Restore
                        </AdminButton>
                      )}
                      <ConfirmDelete
                        onConfirm={() => remove(row)}
                        busy={deleting === row.id}
                        locked={row.isSystem}
                        lockedReason="This page is part of the site structure and cannot be deleted."
                      />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>

            <Pagination
              page={data?.page ?? page}
              perPage={data?.perPage ?? PER_PAGE}
              total={data?.total ?? 0}
              onPage={setPage}
            />
          </>
        )}
      </Panel>
    </>
  );
}
