'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { PageHeader } from '@/components/admin/PageHeader';
import { AdminButton, Alert, EmptyState, Field, Input, Panel, Spinner, Table, Td, Textarea, Th } from '@/components/admin/ui';
import { useToast } from '@/components/admin/useToast';
import { api, fetcher } from '@/lib/admin/client';
import { toSlug } from '@/lib/slug';
import { ConfirmDelete, errorMessage } from '../../_shared';
import { ProjectsNav } from '../ProjectsNav';

type Term = {
  id: string;
  taxonomy: 'category' | 'tag';
  slug: string;
  name: string;
  description: string;
  sortOrder: number;
  count: number;
};

type Draft = { id?: string; taxonomy: 'category' | 'tag'; name: string; slug: string; description: string; sortOrder: number };

const empty = (taxonomy: 'category' | 'tag'): Draft => ({ taxonomy, name: '', slug: '', description: '', sortOrder: 0 });

/**
 * A project's categories and tags. A category has an archive with a
 * description — the "Branding" page — and drives "More projects"; a tag is a
 * lighter label with an archive of its own. Both live at addresses set in
 * Permalinks.
 */
export function ProjectTermsScreen({ canWrite, canDesign, bases }: { canWrite: boolean; canDesign: boolean; bases: Record<'category' | 'tag', string> }) {
  const { toast } = useToast();
  const { data, isLoading, error, mutate } = useSWR<{ items: Term[] }>('/api/admin/projects/terms', fetcher);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!draft || !draft.name.trim()) return;
    setBusy(true);
    try {
      const body = { name: draft.name, slug: draft.slug || undefined, description: draft.description, sortOrder: draft.sortOrder };
      if (draft.id) await api(`/api/admin/projects/terms/${draft.id}`, { method: 'PATCH', json: body });
      else await api('/api/admin/projects/terms', { method: 'POST', json: { ...body, taxonomy: draft.taxonomy } });
      toast(`Saved “${draft.name}”.`, 'success');
      setDraft(null);
      await mutate();
    } catch (caught) {
      toast(errorMessage(caught, 'That could not be saved.'), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function remove(term: Term) {
    try {
      await api(`/api/admin/projects/terms/${term.id}`, { method: 'DELETE' });
      toast(`Deleted “${term.name}”. Its projects keep their other categories and tags.`, 'success');
      await mutate();
    } catch (caught) {
      toast(errorMessage(caught, 'That could not be deleted.'), 'error');
    }
  }

  const list = (taxonomy: 'category' | 'tag') => (data?.items ?? []).filter((term) => term.taxonomy === taxonomy);

  return (
    <>
      <PageHeader title="Categories & tags" description="How projects are filed, and the archive pages that list them." />
      <ProjectsNav canDesign={canDesign} />
      {error && <Alert tone="error">{errorMessage(error, 'The list could not be loaded.')}</Alert>}
      {isLoading && <Spinner />}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-6">
          {(['category', 'tag'] as const).map((taxonomy) => (
            <Panel
              key={taxonomy}
              title={taxonomy === 'category' ? 'Categories' : 'Tags'}
              actions={
                canWrite && (
                  <AdminButton type="button" variant="ghost" onClick={() => setDraft(empty(taxonomy))}>
                    + Add
                  </AdminButton>
                )
              }
            >
              {list(taxonomy).length === 0 ? (
                <EmptyState title={taxonomy === 'category' ? 'No categories yet.' : 'No tags yet.'} />
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <Th>Name</Th>
                      <Th>Address</Th>
                      <Th>Projects</Th>
                      <Th className="text-right">Actions</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {list(taxonomy).map((term) => (
                      <tr key={term.id}>
                        <Td>
                          {canWrite ? (
                            <button type="button" className="cursor-pointer bg-transparent p-0 text-left text-bone hover:text-flare-soft" onClick={() => setDraft({ ...term })}>
                              {term.name}
                            </button>
                          ) : (
                            term.name
                          )}
                        </Td>
                        <Td className="font-mono text-[12px] text-smoke">
                          {bases[taxonomy]}/{term.slug}
                        </Td>
                        <Td className="font-mono text-[12px] text-smoke">{term.count}</Td>
                        <Td className="text-right">{canWrite && <ConfirmDelete onConfirm={() => remove(term)} busy={false} />}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Panel>
          ))}
        </div>

        {draft && canWrite && (
          <Panel title={draft.id ? `Edit ${draft.taxonomy}` : `New ${draft.taxonomy}`}>
            <div className="flex flex-col gap-5">
              <Field label="Name" htmlFor="term-name">
                <Input
                  id="term-name"
                  value={draft.name}
                  autoFocus
                  onChange={(e) => setDraft({ ...draft, name: e.target.value, slug: draft.id ? draft.slug : toSlug(e.target.value, '') })}
                />
              </Field>
              <Field label="Slug" htmlFor="term-slug" hint={`${bases[draft.taxonomy]}/${draft.slug || '…'}`}>
                <Input id="term-slug" value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value })} />
              </Field>
              <Field label="Description" htmlFor="term-description" hint="shown at the top of its archive">
                <Textarea id="term-description" rows={4} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
              </Field>
              <Field label="Order" htmlFor="term-order" hint="lower comes first in lists and filters">
                <Input id="term-order" type="number" value={draft.sortOrder} onChange={(e) => setDraft({ ...draft, sortOrder: Math.round(Number(e.target.value) || 0) })} />
              </Field>
              <div className="flex gap-2">
                <AdminButton type="button" disabled={busy || !draft.name.trim()} onClick={() => void save()}>
                  {busy ? 'Saving…' : 'Save'}
                </AdminButton>
                <AdminButton type="button" variant="ghost" onClick={() => setDraft(null)}>
                  Cancel
                </AdminButton>
              </div>
            </div>
          </Panel>
        )}
      </div>
    </>
  );
}
