'use client';

import Link from 'next/link';
import { useState } from 'react';
import useSWR from 'swr';
import { PageHeader } from '@/components/admin/PageHeader';
import {
  AdminButton,
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
import { RetentionPanel } from '@/components/admin/RetentionPanel';
import { api, fetcher } from '@/lib/admin/client';
import { formatDate } from '@/lib/utils';
import { ConfirmDelete, Pagination, errorMessage, useDebounced } from '../_shared';

/* ═══════════════════════════════════════════════════════════════════════════
   Applications
   ───────────────────────────────────────────────────────────────────────────
   The inbox for the careers form. It sits under Enquiries rather than beside
   the adverts, because what is in it is personal data: a name, an email, a
   phone number and a CV, given to this company for one purpose.

   Which is also why there is no trash here. Deleting an application erases
   the row and the file, and only an administrator can do it.
   ═══════════════════════════════════════════════════════════════════════════ */

type ApplicationRow = {
  id: string;
  jobId: string;
  jobTitle: string;
  jobSlug: string | null;
  name: string;
  email: string;
  phone: string;
  cvFilename: string | null;
  cvOriginalName: string;
  cvBytes: number;
  status: 'new' | 'read' | 'shortlisted' | 'rejected';
  createdAt: string;
};

type Detail = ApplicationRow & { coverLetter: string };
type Retention = { days: number; sweptAt?: string; lastRemoved?: number };
type ListResponse = {
  items: ApplicationRow[];
  total: number;
  page: number;
  perPage: number;
  retention: Retention;
};

const PER_PAGE = 20;

/* The four the `application_status` enum actually has. Changing this list
   means a migration, not just an edit here. */
const STATUSES = [
  ['new', 'New'],
  ['read', 'Read'],
  ['shortlisted', 'Shortlisted'],
  ['rejected', 'Not proceeding'],
] as const;

const kb = (bytes: number) => (bytes > 0 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : '');

export function ApplicationsScreen({
  initialJobId = '',
  canErase = false,
}: {
  initialJobId?: string;
  /** `applications:write` — the permission that governs erasing personal data. */
  canErase?: boolean;
}) {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [jobId, setJobId] = useState(initialJobId);
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const query = useDebounced(search);

  const params = new URLSearchParams({ page: String(page), perPage: String(PER_PAGE) });
  if (query) params.set('q', query);
  if (status !== 'all') params.set('status', status);
  if (jobId) params.set('job', jobId);

  const { data, error, isLoading, mutate } = useSWR<ListResponse>(
    `/api/admin/applications?${params.toString()}`,
    fetcher,
    { keepPreviousData: true },
  );

  /* The covering letter is fetched only when somebody opens one, so a page of
     twenty does not carry twenty people's letters to render six words of each. */
  const { data: detail, isLoading: loadingDetail } = useSWR<Detail>(
    open ? `/api/admin/applications/${open}` : null,
    fetcher,
  );

  const items = data?.items ?? [];
  const filtering = query !== '' || status !== 'all' || jobId !== '';

  function refilter(apply: () => void) {
    apply();
    setPage(1);
  }

  async function move(row: ApplicationRow, next: ApplicationRow['status']) {
    setBusy(row.id);
    try {
      await api(`/api/admin/applications/${row.id}`, { method: 'PUT', json: { status: next } });
      await mutate();
    } catch (caught) {
      toast(errorMessage(caught, 'The application could not be updated.'), 'error');
    } finally {
      setBusy(null);
    }
  }

  async function erase(row: ApplicationRow) {
    setBusy(row.id);
    try {
      await api(`/api/admin/applications/${row.id}`, { method: 'DELETE' });
      toast('Application erased, CV and all.', 'success');
      if (open === row.id) setOpen(null);
      await mutate();
    } catch (caught) {
      toast(errorMessage(caught, 'The application could not be erased.'), 'error');
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Applications"
        description="People who have applied through the careers pages. CVs are stored outside the media library and every download is logged."
      />

      <Panel>
        <div className="mb-5 flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <Input
              type="search"
              value={search}
              onChange={(e) => refilter(() => setSearch(e.target.value))}
              placeholder="Search name, email or role…"
              aria-label="Search applications"
            />
          </div>
          <Select
            value={status}
            onChange={(e) => refilter(() => setStatus(e.target.value))}
            aria-label="Filter by status"
            className="w-[180px]"
          >
            <option value="all">All statuses</option>
            {STATUSES.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Select>
          {jobId && (
            <AdminButton type="button" variant="ghost" onClick={() => refilter(() => setJobId(''))}>
              Showing one role — show all
            </AdminButton>
          )}
          {isLoading && <Spinner />}
        </div>

        {error ? (
          <Alert tone="error">{errorMessage(error, 'The applications could not be loaded.')}</Alert>
        ) : items.length === 0 ? (
          <EmptyState
            title={filtering ? 'Nothing matches those filters.' : 'No applications yet.'}
            body={
              filtering
                ? 'Try a broader search, or clear the status filter.'
                : 'Applications arrive here when somebody uses the form on an open role.'
            }
          />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Applicant</Th>
                  <Th>Role</Th>
                  <Th>CV</Th>
                  <Th>Status</Th>
                  <Th>Received</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id}>
                    <Td>
                      <button
                        type="button"
                        onClick={() => setOpen(open === row.id ? null : row.id)}
                        className="cursor-pointer bg-transparent p-0 text-left text-bone hover:text-flare-soft"
                      >
                        {row.name}
                      </button>
                      <div className="mt-0.5 font-mono text-[11px] text-smoke">
                        <a href={`mailto:${row.email}`} className="hover:text-flare-soft">
                          {row.email}
                        </a>
                        {row.phone ? ` · ${row.phone}` : ''}
                      </div>
                    </Td>
                    <Td>
                      {row.jobSlug ? (
                        <Link href={`/admin/jobs?q=${row.jobSlug}`} className="text-bone hover:text-flare-soft">
                          {row.jobTitle}
                        </Link>
                      ) : (
                        /* The advert may have been deleted; the title was kept
                           beside the id for exactly this. */
                        <span title="This role has been deleted.">{row.jobTitle}</span>
                      )}
                    </Td>
                    <Td>
                      {row.cvFilename ? (
                        <a
                          href={`/api/admin/applications/${row.id}/cv`}
                          className="text-bone hover:text-flare-soft"
                          title={`${row.cvOriginalName} — downloads are logged`}
                        >
                          Download{row.cvBytes ? ` (${kb(row.cvBytes)})` : ''}
                        </a>
                      ) : (
                        <span className="text-smoke">None</span>
                      )}
                    </Td>
                    <Td>
                      <Select
                        value={row.status}
                        disabled={busy === row.id}
                        onChange={(e) => void move(row, e.target.value as ApplicationRow['status'])}
                        aria-label={`Status of the application from ${row.name}`}
                        className="w-[150px]"
                      >
                        {STATUSES.map(([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ))}
                      </Select>
                    </Td>
                    <Td className="whitespace-nowrap font-mono text-[12px] text-smoke">
                      {formatDate(row.createdAt)}
                    </Td>
                    <Td className="text-right whitespace-nowrap">
                      <AdminButton
                        variant="ghost"
                        type="button"
                        onClick={() => setOpen(open === row.id ? null : row.id)}
                        className="mr-1"
                      >
                        {open === row.id ? 'Hide' : 'Read'}
                      </AdminButton>
                      <ConfirmDelete
                        onConfirm={() => erase(row)}
                        busy={busy === row.id}
                        label="Erase"
                        warning="The CV is deleted too. This cannot be undone."
                      />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>

            {open && (
              <div className="mt-5 border-2 border-hairline bg-ink p-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-smoke">
                    Covering letter
                  </span>
                  <Badge>{items.find((row) => row.id === open)?.name ?? ''}</Badge>
                </div>
                {loadingDetail ? (
                  <Spinner />
                ) : detail?.coverLetter ? (
                  /* Plain text in a <p>, never HTML: this came from a form on
                     the public internet and is not rich text. */
                  <p className="m-0 max-w-[70ch] whitespace-pre-line text-[14px] leading-relaxed text-ash">
                    {detail.coverLetter}
                  </p>
                ) : (
                  <p className="m-0 text-[13px] text-smoke">No covering letter was written.</p>
                )}
              </div>
            )}

            <Pagination
              page={data?.page ?? page}
              perPage={data?.perPage ?? PER_PAGE}
              total={data?.total ?? 0}
              onPage={setPage}
            />
          </>
        )}
      </Panel>

      <div className="mt-6">
        <RetentionPanel
          endpoint="/api/admin/applications"
          retention={data?.retention}
          canChange={canErase}
          noun="applications"
          alsoDeletes="and its CV"
          onSaved={() => mutate()}
        />
      </div>
    </>
  );
}
