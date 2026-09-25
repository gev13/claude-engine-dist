'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { BlockBuilder } from '@/components/admin/BlockBuilder';
import { PageHeader } from '@/components/admin/PageHeader';
import { AdminButton, Alert, Field, Input, Panel, Select, Spinner } from '@/components/admin/ui';
import { useToast } from '@/components/admin/useToast';
import { api, fetcher } from '@/lib/admin/client';
import type { AnyBlock } from '@/lib/blocks';
import { PROJECT_HEADERS, PROJECT_HEADER_LABELS, type ProjectTemplate } from '@/lib/projects';
import { errorMessage, useUnsavedWarning } from '../../_shared';
import { ProjectsNav } from '../ProjectsNav';

type Response = { template: ProjectTemplate };

/**
 * Projects → Page template: the layout every project page shares. The
 * content — pictures, story, credits — is each project's own; this decides
 * where it goes, what follows it, and what an archive looks like.
 */
export function ProjectTemplateScreen() {
  const { toast } = useToast();
  const { data, isLoading, mutate } = useSWR<Response>('/api/admin/projects/settings', fetcher);
  const [form, setForm] = useState<ProjectTemplate | null>(null);
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
        <PageHeader title="Page template" description="How every project page is laid out." />
        <ProjectsNav />
        <Spinner />
      </>
    );
  }

  const set = <K extends keyof ProjectTemplate>(key: K, value: ProjectTemplate[K]) => setForm({ ...form, [key]: value });
  const setMore = <K extends keyof ProjectTemplate['more']>(key: K, value: ProjectTemplate['more'][K]) =>
    setForm({ ...form, more: { ...form.more, [key]: value } });
  const setArchive = <K extends keyof ProjectTemplate['archive']>(key: K, value: ProjectTemplate['archive'][K]) =>
    setForm({ ...form, archive: { ...form.archive, [key]: value } });

  async function save() {
    if (!form) return;
    setBusy(true);
    setProblem('');
    try {
      const result = await api<Response>('/api/admin/projects/settings', { method: 'PUT', json: { template: form } });
      setForm(result.template);
      setSaved(JSON.stringify(result.template));
      await mutate(result, { revalidate: false });
      toast('Saved. Every project page has been revalidated.', 'success');
    } catch (caught) {
      const message = errorMessage(caught, 'The template could not be saved.');
      setProblem(message);
      toast(message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Page template"
        description="How every project page is laid out, what follows it, and how archives list projects."
        actions={
          <AdminButton type="button" onClick={() => void save()} disabled={busy || !dirty}>
            {busy ? 'Saving…' : 'Save'}
          </AdminButton>
        }
      />
      <ProjectsNav />
      {problem && (
        <div className="mb-6">
          <Alert tone="error">{problem}</Alert>
        </div>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Panel title="The header">
          <div className="flex flex-col gap-5">
            <Field label="Style" htmlFor="tpl-header" hint={PROJECT_HEADER_LABELS[form.header].hint}>
              <Select id="tpl-header" value={form.header} onChange={(e) => set('header', e.target.value as ProjectTemplate['header'])}>
                {PROJECT_HEADERS.map((header) => (
                  <option key={header} value={header}>
                    {PROJECT_HEADER_LABELS[header].label}
                  </option>
                ))}
              </Select>
            </Field>
            <label className="flex items-center gap-2 text-[13px] text-ash">
              <input type="checkbox" className="h-4 w-4 accent-flare" checked={form.showCategories} onChange={(e) => set('showCategories', e.target.checked)} />
              Category chips above the title, each linking to its archive
            </label>
            <label className="flex items-center gap-2 text-[13px] text-ash">
              <input type="checkbox" className="h-4 w-4 accent-flare" checked={form.showDetails} onChange={(e) => set('showDetails', e.target.checked)} />
              Client, year and the live link under the intro
            </label>
          </div>
        </Panel>

        <Panel title="More projects">
          <div className="flex flex-col gap-5">
            <label className="flex items-center gap-2 text-[13px] text-ash">
              <input type="checkbox" className="h-4 w-4 accent-flare" checked={form.more.enabled} onChange={(e) => setMore('enabled', e.target.checked)} />
              After each project, list others — a project can switch this off for itself
            </label>
            <Field label="Heading" htmlFor="tpl-more-title" hint="above the list">
              <Input id="tpl-more-title" value={form.more.title} maxLength={120} onChange={(e) => setMore('title', e.target.value)} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Which" htmlFor="tpl-more-source">
                <Select id="tpl-more-source" value={form.more.source} onChange={(e) => setMore('source', e.target.value as 'category' | 'latest')}>
                  <option value="category">Same primary category</option>
                  <option value="latest">The newest</option>
                </Select>
              </Field>
              <Field label="How many" htmlFor="tpl-more-count">
                <Input
                  id="tpl-more-count"
                  type="number"
                  min={1}
                  max={6}
                  value={form.more.count}
                  onChange={(e) => setMore('count', Math.min(6, Math.max(1, Math.round(Number(e.target.value) || 1))))}
                />
              </Field>
              <Field label="As" htmlFor="tpl-more-layout">
                <Select id="tpl-more-layout" value={form.more.layout} onChange={(e) => setMore('layout', e.target.value as 'grid' | 'carousel')}>
                  <option value="grid">A grid</option>
                  <option value="carousel">A carousel</option>
                </Select>
              </Field>
            </div>
            <p className="m-0 text-[12px] text-smoke">A category with too few projects is topped up with the newest.</p>
          </div>
        </Panel>

        <Panel title="Archives">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Cards" htmlFor="tpl-archive-layout">
              <Select id="tpl-archive-layout" value={form.archive.layout} onChange={(e) => setArchive('layout', e.target.value as ProjectTemplate['archive']['layout'])}>
                <option value="classic">Picture, then text</option>
                <option value="overlay">Text over the picture</option>
                <option value="minimal">Minimal</option>
                <option value="metro">Metro grid</option>
                <option value="list">A list</option>
              </Select>
            </Field>
            <Field label="Per row" htmlFor="tpl-archive-cols">
              <Select id="tpl-archive-cols" value={String(form.archive.columns)} onChange={(e) => setArchive('columns', Number(e.target.value) as 2 | 3 | 4)}>
                <option value="2">Two</option>
                <option value="3">Three</option>
                <option value="4">Four</option>
              </Select>
            </Field>
            <Field label="Per page" htmlFor="tpl-archive-per">
              <Input
                id="tpl-archive-per"
                type="number"
                min={1}
                max={48}
                value={form.archive.perPage}
                onChange={(e) => setArchive('perPage', Math.min(48, Math.max(1, Math.round(Number(e.target.value) || 1))))}
              />
            </Field>
          </div>
          <p className="m-0 mt-3 text-[12px] text-smoke">
            Category and tag archives page on the server — /portfolio-category/branding/page/2.
          </p>
        </Panel>

        <Panel title="Search">
          <label className="flex items-center gap-2 text-[13px] text-ash">
            <input type="checkbox" className="h-4 w-4 accent-flare" checked={form.inSearch} onChange={(e) => set('inSearch', e.target.checked)} />
            Show matching projects above the posts in the site&rsquo;s search results
          </label>
        </Panel>
      </div>

      <div className="mt-6">
        <Panel title="After every project">
          <p className="m-0 mb-4 text-[13px] text-ash">
            Blocks shown at the end of every project page — usually a call to action.
          </p>
          <BlockBuilder value={form.cta as AnyBlock[]} onChange={(next) => set('cta', next)} exclude={['hero']} />
        </Panel>
      </div>
    </>
  );
}
