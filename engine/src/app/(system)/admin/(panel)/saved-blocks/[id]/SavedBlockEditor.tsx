'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { BlockBuilder } from '@/components/admin/BlockBuilder';
import { DuplicateButton } from '@/components/admin/DuplicateButton';
import { PageHeader } from '@/components/admin/PageHeader';
import { RevisionPanel } from '@/components/admin/RevisionPanel';
import { AdminButton, AdminLinkButton, Alert, Field, Input, Panel, Select, Spinner, Textarea } from '@/components/admin/ui';
import { useToast } from '@/components/admin/useToast';
import { api, fetcher } from '@/lib/admin/client';
import type { AnyBlock } from '@/lib/blocks';
import { errorMessage, useUnsavedWarning } from '../../_shared';

type UsedOn = { kind: string; title: string; edit: string; view: string | null };
type Record = {
  id: string;
  name: string;
  description: string;
  category: string;
  mode: 'synced' | 'template';
  tree: AnyBlock[];
  usedOn: UsedOn[];
};
type Form = Omit<Record, 'id' | 'usedOn'>;

/**
 * One saved block: its blocks in a full builder, where it is used, its
 * history, and a delete that will not strand the pages using it.
 */
export function SavedBlockEditor({ id }: { id: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const { data, isLoading, mutate } = useSWR<Record>(`/api/admin/saved-blocks/${id}`, fetcher);
  const [form, setForm] = useState<Form | null>(null);
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');

  useEffect(() => {
    if (!data) return;
    const next = { name: data.name, description: data.description, category: data.category, mode: data.mode, tree: data.tree };
    setForm(next);
    setSaved(JSON.stringify(next));
  }, [data]);

  const dirty = form !== null && JSON.stringify(form) !== saved;
  useUnsavedWarning(dirty);

  if (isLoading || !form || !data) {
    return (
      <>
        <PageHeader title="Saved block" />
        <Spinner />
      </>
    );
  }

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm({ ...form, [key]: value });

  async function save() {
    if (!form) return;
    setBusy(true);
    setProblem('');
    try {
      const result = await api<Record>(`/api/admin/saved-blocks/${id}`, { method: 'PATCH', json: form });
      await mutate(result, { revalidate: false });
      toast(
        form.mode === 'synced' && result.usedOn.length > 0
          ? `Saved. ${result.usedOn.length} place${result.usedOn.length === 1 ? '' : 's'} using it now show the change.`
          : 'Saved.',
        'success',
      );
    } catch (caught) {
      const message = errorMessage(caught, 'It could not be saved.');
      setProblem(message);
      toast(message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function remove(detach: boolean) {
    const uses = data?.usedOn.length ?? 0;
    const question = detach
      ? `Give each of the ${uses} place${uses === 1 ? '' : 's'} its own copy, then delete “${form?.name}”?`
      : `Delete “${form?.name}”? This cannot be undone.`;
    if (!window.confirm(question)) return;
    try {
      await api(`/api/admin/saved-blocks/${id}${detach ? '?detach=1' : ''}`, { method: 'DELETE' });
      toast('Deleted.', 'success');
      setSaved(JSON.stringify(form));
      router.push('/admin/saved-blocks');
    } catch (caught) {
      toast(errorMessage(caught, 'It could not be deleted.'), 'error');
    }
  }

  const inUse = data.usedOn.length > 0;

  return (
    <>
      <PageHeader
        title={form.name || 'Saved block'}
        description={form.mode === 'synced' ? 'Synced — a change here shows on every page that uses it.' : 'Template — inserting it pastes a copy.'}
        actions={
          <>
            <AdminLinkButton href="/admin/saved-blocks" variant="ghost">
              Back to my blocks
            </AdminLinkButton>
            <DuplicateButton kind="saved-blocks" id={id} dirty={dirty} />
            <AdminButton type="button" disabled={busy || !dirty || !form.name.trim()} onClick={() => void save()}>
              {busy ? 'Saving…' : 'Save'}
            </AdminButton>
          </>
        }
      />
      {problem && (
        <div className="mb-6">
          <Alert tone="error">{problem}</Alert>
        </div>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Panel title="The blocks">
          <BlockBuilder value={form.tree} onChange={(tree) => set('tree', tree)} excludeSavedId={id} />
        </Panel>

        <aside className="flex flex-col gap-6">
          <Panel title="About it">
            <div className="flex flex-col gap-4">
              <Field label="Name" htmlFor="sb-edit-name">
                <Input id="sb-edit-name" value={form.name} maxLength={120} onChange={(e) => set('name', e.target.value)} />
              </Field>
              <Field label="What it is for" htmlFor="sb-edit-desc">
                <Textarea id="sb-edit-desc" rows={2} value={form.description} maxLength={300} onChange={(e) => set('description', e.target.value)} />
              </Field>
              <Field label="Folder" htmlFor="sb-edit-cat">
                <Input id="sb-edit-cat" value={form.category} maxLength={60} onChange={(e) => set('category', e.target.value)} />
              </Field>
              <Field
                label="How it is used"
                htmlFor="sb-edit-mode"
                hint={inUse && form.mode === 'template' ? 'pages already using it stay synced until detached' : undefined}
              >
                <Select id="sb-edit-mode" value={form.mode} onChange={(e) => set('mode', e.target.value as Form['mode'])}>
                  <option value="synced">Synced — the same everywhere</option>
                  <option value="template">Template — insert a copy</option>
                </Select>
              </Field>
            </div>
          </Panel>

          <Panel title="Used on">
            {inUse ? (
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {data.usedOn.map((use) => (
                  <li key={`${use.kind}-${use.edit}`} className="text-[13px]">
                    <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-smoke">{use.kind}</span>{' '}
                    <a href={use.edit} className="text-bone hover:text-flare-soft">
                      {use.title}
                    </a>
                    {use.view && (
                      <a href={use.view} target="_blank" rel="noopener" className="ml-2 text-smoke hover:text-flare-soft">
                        view ↗
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="m-0 text-[13px] text-ash">Nothing uses it yet.</p>
            )}
          </Panel>

          <RevisionPanel entityType="saved_block" entityId={id} onRestored={() => void mutate()} />

          <Panel title="Delete">
            {inUse ? (
              <div className="flex flex-col gap-3">
                <p className="m-0 text-[13px] leading-relaxed text-ash">
                  It is used in {data.usedOn.length} place{data.usedOn.length === 1 ? '' : 's'}. Detaching gives each its own copy
                  first, so no page loses what it shows.
                </p>
                <AdminButton type="button" variant="danger" onClick={() => void remove(true)}>
                  Detach everywhere, then delete
                </AdminButton>
              </div>
            ) : (
              <AdminButton type="button" variant="danger" onClick={() => void remove(false)}>
                Delete this saved block
              </AdminButton>
            )}
          </Panel>
        </aside>
      </div>
    </>
  );
}
