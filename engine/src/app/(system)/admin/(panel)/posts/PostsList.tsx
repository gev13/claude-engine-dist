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
import { ConfirmDelete, Pagination, StatusBadge, errorMessage, useDebounced } from '../_shared';

type PostRow = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  kind: 'article' | 'research';
  status: 'draft' | 'published' | 'archived';
  readingMinutes: number;
  publishedAt: string | null;
  updatedAt: string;
  categoryName: string | null;
  authorFirst: string | null;
  authorLast: string | null;
};

type ListResponse = { items: PostRow[]; total: number; page: number; perPage: number };

const PER_PAGE = 20;

function authorName(row: PostRow): string {
  const name = [row.authorFirst, row.authorLast].filter(Boolean).join(' ').trim();
  return name || '—';
}

export function PostsList() {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [kind, setKind] = useState('all');
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [trashed, setTrashed] = useState(false);

  const query = useDebounced(search);

  const params = new URLSearchParams({ page: String(page), perPage: String(PER_PAGE) });
  if (query) params.set('q', query);
  if (status !== 'all') params.set('status', status);
  if (kind !== 'all') params.set('kind', kind);
  if (trashed) params.set('trashed', '1');

  const { data, error, isLoading, mutate } = useSWR<ListResponse>(
    `/api/admin/posts?${params.toString()}`,
    fetcher,
    { keepPreviousData: true },
  );

  const items = data?.items ?? [];
  const filtering = query !== '' || status !== 'all' || kind !== 'all';

  function refilter(apply: () => void) {
    apply();
    setPage(1);
  }

  async function restore(row: PostRow) {
    setDeleting(row.id);
    try {
      await api(`/api/admin/posts/${row.id}/restore`, { method: 'POST' });
      toast(`Restored "${row.title}" as a draft.`, 'success');
      await mutate();
    } catch (caught) {
      toast(errorMessage(caught, 'The post could not be restored.'), 'error');
    } finally {
      setDeleting(null);
    }
  }

  async function remove(row: PostRow) {
    setDeleting(row.id);
    try {
      // In the trash a delete is permanent; everywhere else it trashes.
      await api(`/api/admin/posts/${row.id}${trashed ? '?permanent=true' : ''}`, { method: 'DELETE' });
      toast(trashed ? `Deleted "${row.title}" permanently.` : `Moved "${row.title}" to the trash.`, 'success');
      await mutate();
    } catch (caught) {
      toast(errorMessage(caught, 'The post could not be deleted.'), 'error');
    } finally {
      setDeleting(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Posts"
        description="Articles and research write-ups for the knowledge base."
        actions={<AdminLinkButton href="/admin/posts/new">New post</AdminLinkButton>}
      />

      <Panel>
        <div className="mb-5 flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <Input
              type="search"
              value={search}
              onChange={(e) => refilter(() => setSearch(e.target.value))}
              placeholder="Search title or slug…"
              aria-label="Search posts"
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
            value={kind}
            onChange={(e) => refilter(() => setKind(e.target.value))}
            aria-label="Filter by kind"
            className="w-[150px]"
          >
            <option value="all">All kinds</option>
            <option value="article">Article</option>
            <option value="research">Research</option>
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
          <Alert tone="error">{errorMessage(error, 'The post list could not be loaded.')}</Alert>
        ) : items.length === 0 ? (
          <EmptyState
            title={trashed ? 'The trash is empty.' : filtering ? 'Nothing matches those filters.' : 'No posts yet.'}
            body={
              filtering
                ? 'Try a broader search, or clear the status and kind filters.'
                : 'Posts are the articles and research pieces behind the knowledge base.'
            }
            action={!filtering && <AdminLinkButton href="/admin/posts/new">New post</AdminLinkButton>}
          />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Title</Th>
                  <Th>Category</Th>
                  <Th>Kind</Th>
                  <Th>Status</Th>
                  <Th>Published</Th>
                  <Th>Author</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id}>
                    <Td>
                      <Link href={`/admin/posts/${row.id}`} className="text-bone hover:text-flare-soft">
                        {row.title}
                      </Link>
                      <div className="mt-0.5 font-mono text-[11px] text-smoke">
                        /blog/{row.slug} · {row.readingMinutes} min
                      </div>
                    </Td>
                    <Td>{row.categoryName ?? <span className="text-smoke">Uncategorised</span>}</Td>
                    <Td>
                      <Badge>{row.kind}</Badge>
                    </Td>
                    <Td>
                      <StatusBadge status={row.status} />
                    </Td>
                    <Td className="whitespace-nowrap font-mono text-[12px] text-smoke">
                      {row.publishedAt ? formatDate(row.publishedAt) : '—'}
                    </Td>
                    <Td className="whitespace-nowrap">{authorName(row)}</Td>
                    <Td className="text-right whitespace-nowrap">
                      <>
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
                        <ConfirmDelete onConfirm={() => remove(row)} busy={deleting === row.id} />
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
