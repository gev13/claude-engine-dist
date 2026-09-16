'use client';

import Link from 'next/link';
import { useState } from 'react';
import useSWR from 'swr';
import { PageHeader } from '@/components/admin/PageHeader';
import {
  AdminButton,
  AdminLinkButton,
  Alert,
  Badge,
  EmptyState,
  Input,
  Panel,
  Select,
  Spinner,
  Table,
  Td,
  Th,
} from '@/components/admin/ui';
import { useToast } from '@/components/admin/useToast';
import { api, fetcher } from '@/lib/admin/client';
import { formatDate } from '@/lib/utils';
import { formatRelative, hasPassed } from '@/lib/relativeDate';
import { ConfirmDelete, Pagination, StatusBadge, errorMessage, useDebounced } from '../_shared';

/* ═══════════════════════════════════════════════════════════════════════════
   Open roles
   ───────────────────────────────────────────────────────────────────────────
   Two things this list has to say that the posts list does not.

   Open or closed is *not* the same as published or draft, and conflating them
   is the mistake everybody makes here: a filled role stays published, because
   its page should keep working for anybody holding the link — it simply stops
   taking applications. So both are shown, separately.

   And the number of applications, because it is what anybody opening this
   screen actually came for. It is joined in the list query rather than
   fetched per row.
   ═══════════════════════════════════════════════════════════════════════════ */

type JobRow = {
  id: string;
  slug: string;
  locale: string;
  title: string;
  department: string;
  location: string;
  contractType: string;
  status: 'draft' | 'published' | 'archived';
  isOpen: boolean;
  deletedAt: string | null;
  postedAt: string | null;
  deadline: string | null;
  publishedAt: string | null;
  updatedAt: string;
  applicationCount: number;
};

type ListResponse = { items: JobRow[]; total: number; page: number; perPage: number };

const PER_PAGE = 20;

/** "12 days left", or "closed 3 days ago" once the date has gone by. */
function deadlineNote(row: JobRow) {
  if (!row.deadline) return <span className="text-smoke">No deadline</span>;
  const date = new Date(row.deadline);
  const passed = hasPassed(date);
  return (
    <span className={passed ? 'text-flare-soft' : undefined} title={formatDate(row.deadline)}>
      {passed ? 'Closed ' : ''}
      {formatRelative(date, 'en')}
    </span>
  );
}

export function JobsList() {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [openness, setOpenness] = useState('all');
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState<string | null>(null);
  const [trashed, setTrashed] = useState(false);

  const query = useDebounced(search);

  const params = new URLSearchParams({ page: String(page), perPage: String(PER_PAGE) });
  if (query) params.set('q', query);
  if (status !== 'all') params.set('status', status);
  if (openness !== 'all') params.set('open', openness);
  if (trashed) params.set('trashed', '1');

  const { data, error, isLoading, mutate } = useSWR<ListResponse>(
    `/api/admin/jobs?${params.toString()}`,
    fetcher,
    { keepPreviousData: true },
  );

  const items = data?.items ?? [];
  const filtering = query !== '' || status !== 'all' || openness !== 'all';

  function refilter(apply: () => void) {
    apply();
    setPage(1);
  }

  /* Closing a role is the single most common thing anybody does on this
     screen — it happens the moment somebody is hired — so it is one click
     here rather than a trip through the editor. */
  async function toggleOpen(row: JobRow) {
    setBusy(row.id);
    try {
      await api(`/api/admin/jobs/${row.id}`, { method: 'PUT', json: { isOpen: !row.isOpen } });
      toast(row.isOpen ? `Closed "${row.title}" to applications.` : `Reopened "${row.title}".`, 'success');
      await mutate();
    } catch (caught) {
      toast(errorMessage(caught, 'The role could not be updated.'), 'error');
    } finally {
      setBusy(null);
    }
  }

  async function restore(row: JobRow) {
    setBusy(row.id);
    try {
      await api(`/api/admin/jobs/${row.id}/restore`, { method: 'POST' });
      toast(`Restored "${row.title}" as a closed draft.`, 'success');
      await mutate();
    } catch (caught) {
      toast(errorMessage(caught, 'The role could not be restored.'), 'error');
    } finally {
      setBusy(null);
    }
  }

  async function remove(row: JobRow) {
    setBusy(row.id);
    try {
      await api(`/api/admin/jobs/${row.id}${trashed ? '?permanent=true' : ''}`, { method: 'DELETE' });
      toast(trashed ? `Deleted "${row.title}" permanently.` : `Moved "${row.title}" to the trash.`, 'success');
      await mutate();
    } catch (caught) {
      toast(errorMessage(caught, 'The role could not be deleted.'), 'error');
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Roles"
        description="Job adverts for the careers section, and the applications they have drawn."
        actions={<AdminLinkButton href="/admin/jobs/new">New role</AdminLinkButton>}
      />

      <Panel>
        <div className="mb-5 flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <Input
              type="search"
              value={search}
              onChange={(e) => refilter(() => setSearch(e.target.value))}
              placeholder="Search title or slug…"
              aria-label="Search roles"
            />
          </div>
          <Select
            value={status}
            onChange={(e) => refilter(() => setStatus(e.target.value))}
            aria-label="Filter by status"
            className="w-[160px]"
          >
            <option value="all">All statuses</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </Select>
          <Select
            value={openness}
            onChange={(e) => refilter(() => setOpenness(e.target.value))}
            aria-label="Filter by whether the role is open"
            className="w-[180px]"
          >
            <option value="all">Open and closed</option>
            <option value="open">Taking applications</option>
            <option value="closed">Closed</option>
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
          <Alert tone="error">{errorMessage(error, 'The list of roles could not be loaded.')}</Alert>
        ) : items.length === 0 ? (
          <EmptyState
            title={trashed ? 'The trash is empty.' : filtering ? 'Nothing matches those filters.' : 'No roles yet.'}
            body={
              filtering
                ? 'Try a broader search, or clear the status filter.'
                : 'A role is one job advert: the meta grid at the top of the page, three sections of copy, and an application form.'
            }
            action={!filtering && <AdminLinkButton href="/admin/jobs/new">New role</AdminLinkButton>}
          />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Role</Th>
                  <Th>Department</Th>
                  <Th>Status</Th>
                  <Th>Applications</Th>
                  <Th>Deadline</Th>
                  <Th>Posted</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id}>
                    <Td>
                      <Link href={`/admin/jobs/${row.id}`} className="text-bone hover:text-flare-soft">
                        {row.title}
                      </Link>
                      <div className="mt-0.5 font-mono text-[11px] text-smoke">
                        /careers/{row.slug}
                        {row.location ? ` · ${row.location}` : ''}
                        {row.contractType ? ` · ${row.contractType}` : ''}
                      </div>
                    </Td>
                    <Td>{row.department || <span className="text-smoke">—</span>}</Td>
                    <Td className="whitespace-nowrap">
                      <StatusBadge status={row.status} />{' '}
                      {/* Separate from the status on purpose: a filled role stays
                          published so its page keeps working. */}
                      <Badge>{row.isOpen ? 'Open' : 'Closed'}</Badge>
                    </Td>
                    <Td>
                      {row.applicationCount > 0 ? (
                        <Link
                          href={`/admin/applications?job=${row.id}`}
                          className="text-bone hover:text-flare-soft"
                        >
                          {row.applicationCount}
                        </Link>
                      ) : (
                        <span className="text-smoke">0</span>
                      )}
                    </Td>
                    <Td className="whitespace-nowrap text-[13px]">{deadlineNote(row)}</Td>
                    <Td className="whitespace-nowrap font-mono text-[12px] text-smoke">
                      {row.postedAt ? formatDate(row.postedAt) : '—'}
                    </Td>
                    <Td className="text-right whitespace-nowrap">
                      <>
                        {trashed ? (
                          <AdminButton
                            variant="ghost"
                            type="button"
                            onClick={() => restore(row)}
                            disabled={busy === row.id}
                            className="mr-1"
                          >
                            Restore
                          </AdminButton>
                        ) : (
                          <AdminButton
                            variant="ghost"
                            type="button"
                            onClick={() => toggleOpen(row)}
                            disabled={busy === row.id}
                            className="mr-1"
                          >
                            {row.isOpen ? 'Close' : 'Reopen'}
                          </AdminButton>
                        )}
                        <ConfirmDelete onConfirm={() => remove(row)} busy={busy === row.id} />
                      </>
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
