'use client';

import { Fragment, useEffect, useState } from 'react';
import useSWR from 'swr';
import { PageHeader } from '@/components/admin/PageHeader';
import { EmptyState, Field, Select, Spinner } from '@/components/admin/ui';
import { ToastProvider, useToast } from '@/components/admin/useToast';
import { RetentionPanel, type RetentionState } from '@/components/admin/RetentionPanel';
import { api, fetcher } from '@/lib/admin/client';
import { type Answer, answerText } from '@/lib/forms';
import { ConfirmDelete, Pagination, errorMessage } from '../_shared';

type Submission = { id: string; formName: string; source: string; answers: Answer[]; createdAt: string };
type ListResponse = {
  items: Submission[];
  total: number;
  page: number;
  perPage: number;
  forms: { name: string; n: number }[];
  retention: RetentionState;
};

const PER_PAGE = 20;

function humanDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** `canManage` shows export and delete; the API enforces both regardless. */
export function SubmissionsScreen({ canManage }: { canManage: boolean }) {
  return (
    <ToastProvider>
      <SubmissionsScreenInner canManage={canManage} />
    </ToastProvider>
  );
}

function SubmissionsScreenInner({ canManage }: { canManage: boolean }) {
  const { toast } = useToast();
  const [form, setForm] = useState('');
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState<string | null>(null);

  // Another form always restarts at the first page.
  useEffect(() => {
    setPage(1);
  }, [form]);

  const params = new URLSearchParams({ page: String(page), perPage: String(PER_PAGE) });
  if (form) params.set('form', form);

  const { data, isLoading, mutate } = useSWR<ListResponse>(`/api/admin/submissions?${params.toString()}`, fetcher);
  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  async function remove(row: Submission) {
    setBusy(row.id);
    try {
      await api(`/api/admin/submissions/${row.id}`, { method: 'DELETE' });
      toast('Deleted the submission.', 'success');
      await mutate();
    } catch (error) {
      toast(errorMessage(error, 'Could not delete that submission.'), 'error');
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Form submissions"
        description="Answers sent through form blocks on the site. Nothing is emailed yet — read them here, or export one form's answers as a spreadsheet."
      />

      <div className="mb-5 flex flex-wrap items-end gap-3">
        <Field label="Form" htmlFor="submissions-form" className="w-[280px]">
          <Select id="submissions-form" value={form} onChange={(e) => setForm(e.target.value)}>
            <option value="">All forms</option>
            {(data?.forms ?? []).map((f) => (
              <option key={f.name} value={f.name}>
                {f.name} ({f.n})
              </option>
            ))}
          </Select>
        </Field>
        <p className="m-0 pb-3 font-mono text-[10px] uppercase tracking-[0.12em] text-smoke">
          {total} submission{total === 1 ? '' : 's'}
        </p>
        <span className="flex-1" />
        {canManage && form && total > 0 && (
          // A file download from an API route, not a page, so not a <Link>.
          <a
            href={`/api/admin/submissions?format=csv&form=${encodeURIComponent(form)}`}
            download
            className="mb-1 inline-flex items-center border-2 border-hairline px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.12em] text-bone transition-colors hover:border-flare"
          >
            Export CSV
          </a>
        )}
      </div>
      {canManage && !form && total > 0 && <p className="-mt-2 mb-5 text-[13px] text-smoke">Choose one form to export its answers.</p>}

      {isLoading && <Spinner label="Loading submissions" />}

      {!isLoading && items.length === 0 && (
        <EmptyState title="No submissions yet" body="Add a form block to a page; what people send through it appears here." />
      )}

      <div className="flex flex-col gap-4">
        {items.map((row) => (
          <article key={row.id} className="border-2 border-hairline p-4">
            <header className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
              <p className="m-0">
                <span className="text-[15px] text-bone">{row.formName}</span>{' '}
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-smoke">
                  {humanDate(row.createdAt)} · {row.source || '—'}
                </span>
              </p>
              {canManage && (
                <ConfirmDelete onConfirm={() => remove(row)} busy={busy === row.id} label="Delete" confirmLabel="Delete for good" />
              )}
            </header>
            <dl className="m-0 grid gap-x-6 gap-y-2 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
              {row.answers.map((answer) => (
                <Fragment key={answer.id}>
                  <dt className="text-[13px] text-smoke">{answer.label}</dt>
                  <dd className="m-0 whitespace-pre-wrap text-[14px] text-ash">
                    {answer.file ? (
                      /* The visitor's own filename, linking to the admin route
                         that checks the permission and logs the download —
                         never a path anybody could reach without one. */
                      <a
                        href={`/api/admin/submissions/${row.id}/file/${encodeURIComponent(answer.id)}`}
                        className="text-bone hover:text-flare-soft"
                        title="Downloads are logged"
                      >
                        {answer.file.originalName} ({Math.max(1, Math.round(answer.file.bytes / 1024))} KB)
                      </a>
                    ) : (
                      answerText(answer.value) || '—'
                    )}
                  </dd>
                </Fragment>
              ))}
            </dl>
          </article>
        ))}
      </div>

      <Pagination page={page} perPage={PER_PAGE} total={total} onPage={setPage} />

      {/* A submission can carry a file now, so the period deletes those too. */}
      <div className="mt-6">
        <RetentionPanel
          endpoint="/api/admin/submissions"
          retention={data?.retention}
          canChange={canManage}
          noun="form submissions"
          alsoDeletes="and any file sent with it"
          onSaved={() => mutate()}
        />
      </div>
    </>
  );
}
