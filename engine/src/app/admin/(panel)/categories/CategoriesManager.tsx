'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { PageHeader } from '@/components/admin/PageHeader';
import { SeoPanel } from '@/components/admin/SeoPanel';
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
  Textarea,
  Th,
} from '@/components/admin/ui';
import { useToast } from '@/components/admin/useToast';
import { api, fetcher } from '@/lib/admin/client';
import { toSlug } from '@/lib/slug';
import { cn } from '@/lib/utils';
import type { SeoFields } from '@/server/db/schema';
import { ConfirmDelete, errorMessage } from '../_shared';

/* ═══════════════════════════════════════════════════════════════════════════
   Categories
   ───────────────────────────────────────────────────────────────────────────
   There are only ever a handful, so the list and the form share one screen:
   selecting a row loads it into the form beside the table rather than pushing
   a separate route.
   ═══════════════════════════════════════════════════════════════════════════ */

type CategoryRow = {
  id: string;
  slug: string;
  name: string;
  description: string;
  seo: SeoFields;
  parentId: string | null;
  sortOrder: number;
  isSystem: boolean;
  postCount: number;
};

type ListResponse = { items: CategoryRow[]; total: number };

type FormValue = {
  name: string;
  slug: string;
  description: string;
  parentId: string;
  sortOrder: number;
  seo: SeoFields;
};

const blankForm: FormValue = { name: '', slug: '', description: '', parentId: '', sortOrder: 0, seo: {} };

function toForm(row: CategoryRow): FormValue {
  return {
    name: row.name,
    slug: row.slug,
    description: row.description,
    parentId: row.parentId ?? '',
    sortOrder: row.sortOrder,
    seo: row.seo ?? {},
  };
}

export function CategoriesManager() {
  const { toast } = useToast();
  const { data, error, isLoading, mutate } = useSWR<ListResponse>('/api/admin/categories', fetcher);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<FormValue>(blankForm);
  const [slugLocked, setSlugLocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [problem, setProblem] = useState('');

  const items = data?.items ?? [];
  const selected = selectedId ? (items.find((row) => row.id === selectedId) ?? null) : null;

  const set = <K extends keyof FormValue>(key: K, next: FormValue[K]) =>
    setForm((current) => ({ ...current, [key]: next }));

  function startCreate() {
    setSelectedId(null);
    setForm(blankForm);
    setSlugLocked(false);
    setProblem('');
  }

  function startEdit(row: CategoryRow) {
    setSelectedId(row.id);
    setForm(toForm(row));
    setSlugLocked(true);
    setProblem('');
  }

  async function save() {
    if (!form.name.trim()) {
      setProblem('A category needs a name.');
      return;
    }
    setProblem('');
    setBusy(true);

    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim() || undefined,
      description: form.description,
      parentId: form.parentId || null,
      sortOrder: Number.isFinite(form.sortOrder) ? form.sortOrder : 0,
      seo: form.seo,
    };

    try {
      if (selectedId) {
        const row = await api<CategoryRow>(`/api/admin/categories/${selectedId}`, { method: 'PATCH', json: payload });
        toast(`Saved "${row.name}".`, 'success');
        setForm(toForm({ ...row, postCount: selected?.postCount ?? 0 }));
      } else {
        const row = await api<CategoryRow>('/api/admin/categories', { json: payload });
        toast(`Created "${row.name}".`, 'success');
        setSelectedId(row.id);
        setForm(toForm({ ...row, postCount: 0 }));
        setSlugLocked(true);
      }
      await mutate();
    } catch (caught) {
      const message = errorMessage(caught, 'The category could not be saved.');
      setProblem(message);
      toast(message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: CategoryRow) {
    setDeleting(row.id);
    try {
      await api(`/api/admin/categories/${row.id}`, { method: 'DELETE' });
      toast(`Deleted "${row.name}".`, 'success');
      if (selectedId === row.id) startCreate();
      await mutate();
    } catch (caught) {
      toast(errorMessage(caught, 'The category could not be deleted.'), 'error');
    } finally {
      setDeleting(null);
    }
  }

  const parentOptions = items.filter((row) => row.id !== selectedId);
  const previewPath = `/blog/category/${form.slug || toSlug(form.name, 'category')}`;

  return (
    <>
      <PageHeader
        title="Categories"
        description="How the knowledge base is filed. Posts carry one primary category and any number of secondary ones."
        actions={
          <AdminButton type="button" onClick={startCreate} disabled={selectedId === null}>
            New category
          </AdminButton>
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <Panel title={`All categories${data ? ` (${items.length})` : ''}`}>
          {isLoading && !data ? (
            <Spinner />
          ) : error ? (
            <Alert tone="error">{errorMessage(error, 'The category list could not be loaded.')}</Alert>
          ) : items.length === 0 ? (
            <EmptyState
              title="No categories yet."
              body="Add one on the right — a category needs only a name to exist."
            />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Name</Th>
                  <Th>Slug</Th>
                  <Th>Posts</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id} className={cn(row.id === selectedId && 'bg-ink')}>
                    <Td>
                      <button
                        type="button"
                        onClick={() => startEdit(row)}
                        className={cn(
                          'cursor-pointer bg-transparent p-0 text-left text-[14px] transition-colors hover:text-flare-soft',
                          row.id === selectedId ? 'text-flare-soft' : 'text-bone',
                        )}
                      >
                        {row.name}
                      </button>
                      {row.description && (
                        <div className="mt-0.5 line-clamp-1 text-[12px] text-smoke">{row.description}</div>
                      )}
                    </Td>
                    <Td className="font-mono text-[12px] text-smoke">{row.slug}</Td>
                    <Td className="font-mono text-[12px]">{row.postCount}</Td>
                    <Td className="text-right whitespace-nowrap">
                      <AdminButton type="button" variant="ghost" onClick={() => startEdit(row)}>
                        Edit
                      </AdminButton>
                      <ConfirmDelete
                        className="ml-1"
                        onConfirm={() => remove(row)}
                        busy={deleting === row.id}
                        locked={row.isSystem}
                        lockedReason="This category is part of the site structure and cannot be deleted."
                        warning={
                          row.postCount > 0
                            ? `${row.postCount} post(s) will lose their primary category.`
                            : 'This cannot be undone.'
                        }
                      />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Panel>

        <div className="flex flex-col gap-6">
          <Panel
            title={selected ? `Edit — ${selected.name}` : 'New category'}
            actions={
              selected && (
                <button
                  type="button"
                  onClick={startCreate}
                  className="cursor-pointer bg-transparent p-0 font-mono text-[10px] uppercase tracking-[0.12em] text-smoke hover:text-flare-soft"
                >
                  Cancel
                </button>
              )
            }
          >
            <div className="flex flex-col gap-5">
              {problem && <Alert tone="error">{problem}</Alert>}

              <Field label="Name" htmlFor="category-name">
                <Input
                  id="category-name"
                  value={form.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setForm((current) => ({
                      ...current,
                      name,
                      slug: slugLocked ? current.slug : toSlug(name, ''),
                    }));
                  }}
                  placeholder="Threat research"
                />
              </Field>

              <Field label="Slug" htmlFor="category-slug" hint="/blog/category/…">
                <Input
                  id="category-slug"
                  value={form.slug}
                  onChange={(e) => {
                    setSlugLocked(true);
                    set('slug', e.target.value);
                  }}
                  onBlur={(e) => set('slug', toSlug(e.target.value, ''))}
                  placeholder="threat-research"
                />
              </Field>

              <Field label="Description" htmlFor="category-description" hint="shown on the category page">
                <Textarea
                  id="category-description"
                  rows={3}
                  value={form.description}
                  onChange={(e) => set('description', e.target.value)}
                />
              </Field>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Parent" htmlFor="category-parent">
                  <Select
                    id="category-parent"
                    value={form.parentId}
                    onChange={(e) => set('parentId', e.target.value)}
                  >
                    <option value="">None</option>
                    {parentOptions.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Sort order" htmlFor="category-sort" hint="lower first">
                  <Input
                    id="category-sort"
                    type="number"
                    value={form.sortOrder}
                    onChange={(e) => set('sortOrder', Number.parseInt(e.target.value, 10) || 0)}
                  />
                </Field>
              </div>

              <div className="flex items-center gap-2">
                <AdminButton type="button" disabled={busy} onClick={() => void save()}>
                  {busy ? 'Saving…' : selected ? 'Save changes' : 'Create category'}
                </AdminButton>
                {selected && (
                  <ConfirmDelete
                    onConfirm={() => remove(selected)}
                    busy={deleting === selected.id}
                    locked={selected.isSystem}
                    lockedReason="This category is part of the site structure and cannot be deleted."
                    label="Delete"
                    warning={
                      selected.postCount > 0
                        ? `${selected.postCount} post(s) will lose their primary category — the posts themselves are kept.`
                        : 'This cannot be undone.'
                    }
                  />
                )}
              </div>
            </div>
          </Panel>

          <Panel title="SEO">
            <SeoPanel
              value={form.seo}
              onChange={(next) => set('seo', next)}
              fallbackTitle={form.name || 'Category'}
              fallbackDescription={form.description}
              path={previewPath}
            />
          </Panel>
        </div>
      </div>
    </>
  );
}
