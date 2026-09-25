'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { BlockBuilder } from '@/components/admin/BlockBuilder';
import { PageHeader } from '@/components/admin/PageHeader';
import { AdminButton, Alert, Panel, Spinner } from '@/components/admin/ui';
import { useToast } from '@/components/admin/useToast';
import { api, fetcher } from '@/lib/admin/client';
import type { AnyBlock } from '@/lib/blocks';
import { errorMessage, useUnsavedWarning } from '../../_shared';

type Template = { before: AnyBlock[]; after: AnyBlock[] };
type Response = { template: Template };

/**
 * Posts → Category pages (2.18): blocks shown on every category's archive,
 * above and below its posts. A category's own name, description and picture
 * are edited with the category; how its heading looks is Appearance → Blog.
 */
export function BlogArchiveScreen() {
  const { toast } = useToast();
  const { data, isLoading, mutate } = useSWR<Response>('/api/admin/posts/archive', fetcher);
  const [form, setForm] = useState<Template | null>(null);
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');

  useEffect(() => {
    if (!data) return;
    setForm(data.template);
    setSaved(JSON.stringify(data.template));
  }, [data]);

  const dirty = form !== null && JSON.stringify(form) !== saved;
  useUnsavedWarning(dirty);

  if (isLoading || !form) {
    return (
      <>
        <PageHeader title="Category pages" description="Blocks around the posts on every category page." />
        <Spinner />
      </>
    );
  }

  async function save() {
    if (!form) return;
    setBusy(true);
    setProblem('');
    try {
      const result = await api<Response>('/api/admin/posts/archive', { method: 'PUT', json: { template: form } });
      setForm(result.template);
      setSaved(JSON.stringify(result.template));
      await mutate(result, { revalidate: false });
      toast('Saved. Every category page has been updated.', 'success');
    } catch (error) {
      const message = errorMessage(error, 'The category pages could not be saved.');
      setProblem(message);
      toast(message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Category pages"
        description="Blocks shown on every category page — an introduction above the posts, a sign-up or a call to action below."
        actions={
          <AdminButton type="button" onClick={() => void save()} disabled={busy || !dirty}>
            {busy ? 'Saving…' : 'Save'}
          </AdminButton>
        }
      />
      {problem && (
        <div className="mb-6">
          <Alert tone="error">{problem}</Alert>
        </div>
      )}
      <div className="mb-6">
        <Alert tone="info">
          How a category’s own heading looks — its name alone, or with its description and picture — is set in{' '}
          <Link href="/admin/appearance" className="text-flare-soft">
            Appearance → Blog
          </Link>
          .
        </Alert>
      </div>
      <div className="flex flex-col gap-6">
        <Panel title="Above the posts">
          <BlockBuilder value={form.before} onChange={(before) => setForm({ ...form, before })} exclude={['hero']} />
        </Panel>
        <Panel title="Below the posts">
          <BlockBuilder value={form.after} onChange={(after) => setForm({ ...form, after })} exclude={['hero']} />
        </Panel>
      </div>
    </>
  );
}
