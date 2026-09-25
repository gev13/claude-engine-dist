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
import { ProjectsNav } from './ProjectsNav';

type ProjectRow = {
  id: string;
  slug: string;
  title: string;
  client: string;
  year: string;
  status: 'draft' | 'published' | 'archived';
  featured: boolean;
  sortOrder: number;
  publishedAt: string | null;
  updatedAt: string;
  coverUrl: string | null;
};

type Term = { id: string; taxonomy: 'category' | 'tag'; name: string; count: number };
type ListResponse = { items: ProjectRow[]; total: number; page: number; perPage: number };

const PER_PAGE = 20;

export function ProjectsList({ canDesign }: { canDesign: boolean }) {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [term, setTerm] = useState('');
  const [featured, setFeatured] = useState(false);
  const [trashed, setTrashed] = useState(false);
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState<string | null>(null);
  const query = useDebounced(search);

  const params = new URLSearchParams({ page: String(page), perPage: String(PER_PAGE) });
  if (query) params.set('q', query);
  if (status !== 'all') params.set('status', status);
  if (term) params.set('term', term);
  if (featured) params.set('featured', '1');
  if (trashed) params.set('trashed', '1');

  const { data, error, isLoading, mutate } = useSWR<ListResponse>(`/api/admin/projects?${params}`, fetcher, { keepPreviousData: true });
  const { data: terms } = useSWR<{ items: Term[] }>('/api/admin/projects/terms', fetcher);
  const items = data?.items ?? [];
  const filtering = query !== '' || status !== 'all' || term !== '' || featured;
  const refilter = (apply: () => void) => {
    apply();
    setPage(1);
  };

  async function restore(row: ProjectRow) {
    setBusy(row.id);
    try {
      await api(`/api/admin/projects/${row.id}/restore`, { method: 'POST' });
      toast(`Restored "${row.title}" as a draft.`, 'success');
      await mutate();
    } catch (caught) {
      toast(errorMessage(caught, 'The project could not be restored.'), 'error');
    } finally {
      setBusy(null);
    }
  }

  async function remove(row: ProjectRow) {
    setBusy(row.id);
    try {
      await api(`/api/admin/projects/${row.id}${trashed ? '?permanent=true' : ''}`, { method: 'DELETE' });
      toast(trashed ? `Deleted "${row.title}" permanently.` : `Moved "${row.title}" to the trash.`, 'success');
      await mutate();
    } catch (caught) {
      toast(errorMessage(caught, 'The project could not be deleted.'), 'error');
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Projects"
        description="The portfolio: each project is a page of its own, filed under categories and tags."
        actions={<AdminLinkButton href="/admin/projects/new">New project</AdminLinkButton>}
      />
      <ProjectsNav canDesign={canDesign} />

      <Panel>
        <div className="mb-5 flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <Input
              type="search"
              value={search}
              onChange={(e) => refilter(() => setSearch(e.target.value))}
              placeholder="Search title, slug or client…"
              aria-label="Search projects"
            />
          </div>
          <Select value={status} onChange={(e) => refilter(() => setStatus(e.target.value))} aria-label="Filter by status" className="w-[150px]">
            <option value="all">All statuses</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </Select>
          <Select value={term} onChange={(e) => refilter(() => setTerm(e.target.value))} aria-label="Filter by category or tag" className="w-[220px]">
            <option value="">Every category and tag</option>
            {(['category', 'tag'] as const).map((taxonomy) => (
              <optgroup key={taxonomy} label={taxonomy === 'category' ? 'Categories' : 'Tags'}>
                {(terms?.items ?? [])
                  .filter((t) => t.taxonomy === taxonomy)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.count})
                    </option>
                  ))}
              </optgroup>
            ))}
          </Select>
          <label className="flex items-center gap-2 text-[13px] text-ash">
            <input type="checkbox" className="h-4 w-4 accent-flare" checked={featured} onChange={(e) => refilter(() => setFeatured(e.target.checked))} />
            Featured
          </label>
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
          <Alert tone="error">{errorMessage(error, 'The project list could not be loaded.')}</Alert>
        ) : items.length === 0 ? (
          <EmptyState
            title={trashed ? 'The trash is empty.' : filtering ? 'Nothing matches those filters.' : 'No projects yet.'}
            body={
              filtering
                ? 'Try a broader search, or clear the filters.'
                : 'Add a project, file it under a category, and a Projects block set to “From Projects” lists it anywhere on the site.'
            }
            action={!filtering && !trashed && <AdminLinkButton href="/admin/projects/new">New project</AdminLinkButton>}
          />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Project</Th>
                  <Th>Client · year</Th>
                  <Th>Status</Th>
                  <Th>Order</Th>
                  <Th>Updated</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id}>
                    <Td>
                      <div className="flex items-center gap-3">
                        {row.coverUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={row.coverUrl} alt="" className="h-10 w-14 border-2 border-hairline object-cover" />
                        ) : (
                          <span className="h-10 w-14 border-2 border-hairline" aria-hidden="true" />
                        )}
                        <div>
                          <Link href={`/admin/projects/${row.id}`} className="text-bone hover:text-flare-soft">
                            {row.title}
                          </Link>
                          <div className="mt-0.5 font-mono text-[11px] text-smoke">
                            {row.slug}
                            {row.featured && (
                              <>
                                {' '}
                                · <Badge>featured</Badge>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </Td>
                    <Td className="text-ash">{[row.client, row.year].filter(Boolean).join(' · ') || '—'}</Td>
                    <Td>
                      <StatusBadge status={row.status} />
                    </Td>
                    <Td className="font-mono text-[12px] text-smoke">{row.sortOrder}</Td>
                    <Td className="whitespace-nowrap font-mono text-[12px] text-smoke">{formatDate(row.updatedAt)}</Td>
                    <Td className="text-right whitespace-nowrap">
                      {!trashed && <DuplicateButton kind="projects" id={row.id} compact />}
                      {trashed && (
                        <AdminButton variant="ghost" type="button" onClick={() => void restore(row)} disabled={busy === row.id} className="mr-1">
                          Restore
                        </AdminButton>
                      )}
                      <ConfirmDelete onConfirm={() => remove(row)} busy={busy === row.id} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination page={data?.page ?? page} perPage={data?.perPage ?? PER_PAGE} total={data?.total ?? 0} onPage={setPage} />
          </>
        )}
      </Panel>
    </>
  );
}
