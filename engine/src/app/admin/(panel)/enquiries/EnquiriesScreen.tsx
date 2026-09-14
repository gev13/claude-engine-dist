'use client';

import { useCallback, useEffect, useState } from 'react';
import useSWR from 'swr';
import { PageHeader } from '@/components/admin/PageHeader';
import {
  AdminButton,
  Badge,
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
import { ConfirmDelete, Pagination, errorMessage, useDebounced } from '../_shared';

type EnquiryStatus = 'new' | 'read' | 'replied' | 'spam';

type Enquiry = {
  id: string;
  name: string;
  email: string;
  company: string;
  role: string;
  businessType: string;
  services: string[];
  timing: string;
  message: string;
  status: EnquiryStatus;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
};

type ListResponse = { items: Enquiry[]; total: number; page: number; perPage: number; unread: number };

const PER_PAGE = 20;

const STATUSES: EnquiryStatus[] = ['new', 'read', 'replied', 'spam'];

const STATUS_TONE: Record<EnquiryStatus, 'live' | 'draft' | 'neutral' | 'alert'> = {
  new: 'draft',
  read: 'neutral',
  replied: 'live',
  spam: 'alert',
};

function humanDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function EnquiriesScreen() {
  return (
    <ToastProvider>
      <EnquiriesScreenInner />
    </ToastProvider>
  );
}

function EnquiriesScreenInner() {
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const [detail, setDetail] = useState<Enquiry | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const query = useDebounced(search.trim());

  // A new query always restarts at the first page.
  useEffect(() => {
    setPage(1);
  }, [query]);

  const params = new URLSearchParams({ page: String(page), perPage: String(PER_PAGE) });
  if (query) params.set('q', query);
  if (status) params.set('status', status);

  const { data, isLoading, mutate } = useSWR<ListResponse>(`/api/admin/enquiries?${params.toString()}`, fetcher);

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  const open = useCallback(
    async (row: Enquiry) => {
      setDetailLoading(true);
      try {
        // The GET is the audited read — always fetch the full record rather
        // than reusing the list row, so opening an enquiry is logged.
        const full = await api<Enquiry>(`/api/admin/enquiries/${row.id}`);

        if (full.status === 'new') {
          const marked = await api<Enquiry>(`/api/admin/enquiries/${row.id}`, {
            method: 'PATCH',
            json: { status: 'read' },
          });
          setDetail(marked);
          await mutate();
        } else {
          setDetail(full);
        }
      } catch (error) {
        toast(errorMessage(error, 'Could not open that enquiry.'), 'error');
      } finally {
        setDetailLoading(false);
      }
    },
    [mutate, toast],
  );

  async function setStatusOf(row: Enquiry, next: EnquiryStatus) {
    setBusy(true);
    try {
      const updated = await api<Enquiry>(`/api/admin/enquiries/${row.id}`, { method: 'PATCH', json: { status: next } });
      setDetail(updated);
      toast(`Marked as ${next}.`, 'success');
      await mutate();
    } catch (error) {
      toast(errorMessage(error, 'Could not change the status.'), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: Enquiry) {
    setBusy(true);
    try {
      await api(`/api/admin/enquiries/${row.id}`, { method: 'DELETE' });
      toast(`Deleted the enquiry from ${row.company || row.name}.`, 'success');
      setDetail(null);
      await mutate();
    } catch (error) {
      toast(errorMessage(error, 'Could not delete the enquiry.'), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Contact enquiries"
        description="Everything submitted through the contact form. Opening an enquiry is recorded in the audit log."
      />

      <div className="mb-5 flex flex-wrap items-end gap-3">
        <Field label="Search" htmlFor="enquiry-search" className="w-[260px]">
          <Input
            id="enquiry-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name, email or company…"
          />
        </Field>
        <Field label="Status" htmlFor="enquiry-status" className="w-[180px]">
          <Select
            id="enquiry-status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
        </Field>
        <p className="m-0 pb-3 font-mono text-[10px] uppercase tracking-[0.12em] text-smoke">
          {total} enquir{total === 1 ? 'y' : 'ies'}
          {data?.unread ? ` · ${data.unread} new` : ''}
        </p>
      </div>

      {detail && (
        <div className="mb-6">
          <Panel
            title={`Enquiry from ${detail.name}`}
            actions={
              <AdminButton variant="ghost" onClick={() => setDetail(null)}>
                Close
              </AdminButton>
            }
          >
            <div className="space-y-5">
              <dl className="m-0 grid gap-x-6 gap-y-3 text-[14px] sm:grid-cols-2">
                <div>
                  <dt className="m-0 font-mono text-[10px] uppercase tracking-[0.12em] text-smoke">Name</dt>
                  <dd className="m-0 mt-1 text-bone">{detail.name}</dd>
                </div>
                <div>
                  <dt className="m-0 font-mono text-[10px] uppercase tracking-[0.12em] text-smoke">Email</dt>
                  <dd className="m-0 mt-1">
                    <a href={`mailto:${detail.email}`} className="text-flare-soft underline underline-offset-2">
                      {detail.email}
                    </a>
                  </dd>
                </div>
                <div>
                  <dt className="m-0 font-mono text-[10px] uppercase tracking-[0.12em] text-smoke">Company</dt>
                  <dd className="m-0 mt-1 text-ash">{detail.company || '—'}</dd>
                </div>
                <div>
                  <dt className="m-0 font-mono text-[10px] uppercase tracking-[0.12em] text-smoke">Role</dt>
                  <dd className="m-0 mt-1 text-ash">{detail.role || '—'}</dd>
                </div>
                <div>
                  <dt className="m-0 font-mono text-[10px] uppercase tracking-[0.12em] text-smoke">Business type</dt>
                  <dd className="m-0 mt-1 text-ash">{detail.businessType || '—'}</dd>
                </div>
                <div>
                  <dt className="m-0 font-mono text-[10px] uppercase tracking-[0.12em] text-smoke">Timing</dt>
                  <dd className="m-0 mt-1 text-ash">{detail.timing || '—'}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="m-0 font-mono text-[10px] uppercase tracking-[0.12em] text-smoke">Services requested</dt>
                  <dd className="m-0 mt-1.5 flex flex-wrap gap-2">
                    {detail.services.length > 0 ? (
                      detail.services.map((service) => <Badge key={service}>{service}</Badge>)
                    ) : (
                      <span className="text-ash">—</span>
                    )}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="m-0 font-mono text-[10px] uppercase tracking-[0.12em] text-smoke">Received</dt>
                  <dd className="m-0 mt-1 text-ash">{humanDate(detail.createdAt)}</dd>
                </div>
              </dl>

              <div>
                <p className="m-0 mb-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-smoke">Message</p>
                <p className="m-0 whitespace-pre-wrap border-l-2 border-hairline pl-4 text-[14px] leading-relaxed text-ash">
                  {detail.message || '— no message —'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 border-t-2 border-hairline pt-4">
                <span className="mr-1 font-mono text-[10px] uppercase tracking-[0.12em] text-smoke">
                  Status: {detail.status}
                </span>
                {STATUSES.filter((value) => value !== detail.status).map((value) => (
                  <AdminButton
                    key={value}
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void setStatusOf(detail, value)}
                  >
                    Mark {value}
                  </AdminButton>
                ))}

                <span className="flex-1" />

                <ConfirmDelete onConfirm={() => remove(detail)} busy={busy} />
              </div>
            </div>
          </Panel>
        </div>
      )}

      {detailLoading && !detail && (
        <div className="mb-5">
          <Spinner label="Opening enquiry" />
        </div>
      )}

      {isLoading && <Spinner label="Loading enquiries" />}

      {!isLoading && items.length === 0 && (
        <EmptyState
          title="No enquiries here"
          body="Nothing matches this filter. Enquiries arrive from the contact form on the public site."
        />
      )}

      {items.length > 0 && (
        <Table>
          <thead>
            <tr>
              <Th>From</Th>
              <Th>Company</Th>
              <Th>Email</Th>
              <Th>Status</Th>
              <Th>Received</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.id}>
                <Td>
                  <button
                    type="button"
                    onClick={() => void open(row)}
                    className="text-left text-bone underline-offset-4 hover:underline"
                  >
                    {row.name}
                  </button>
                </Td>
                <Td>{row.company || '—'}</Td>
                <Td>{row.email}</Td>
                <Td>
                  <Badge tone={STATUS_TONE[row.status]}>{row.status}</Badge>
                </Td>
                <Td>{humanDate(row.createdAt)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <Pagination page={page} perPage={PER_PAGE} total={total} onPage={setPage} />
    </>
  );
}
