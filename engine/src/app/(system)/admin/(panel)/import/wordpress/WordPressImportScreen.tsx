'use client';

import { useId, useState } from 'react';
import { ImportReportView } from '@/components/admin/ImportReportView';
import { PageHeader } from '@/components/admin/PageHeader';
import { AdminButton, Alert, Field, Input, Panel, Select, Spinner } from '@/components/admin/ui';
import { ToastProvider, useToast } from '@/components/admin/useToast';
import { ApiError, api } from '@/lib/admin/client';
import { type CheckReport, reportTotals } from '@/lib/importReport';
import type { WpAnalysis } from '@/lib/wordpress/model';
import { errorMessage } from '../../_shared';

/* ═══════════════════════════════════════════════════════════════════════════
   Import from WordPress (T37, 2.20)
   ───────────────────────────────────────────────────────────────────────────
   Read a site, say where each kind of thing goes, see what that would do,
   then do it. Nothing is written until the last step, and the last step is
   a merge through the content import — checked, backed up first, and safe
   to run again.
   ═══════════════════════════════════════════════════════════════════════════ */

type Target = 'posts' | 'pages' | 'projects' | 'skip';
type TaxTarget = 'categories' | 'projectCategories' | 'projectTags' | 'skip';
type Mapping = {
  types: Record<string, Target>;
  taxonomies: Record<string, TaxTarget>;
  drafts: boolean;
  media: 'used' | 'all' | 'none';
  faq: boolean;
  seo: boolean;
  redirects: boolean;
  existing: 'update' | 'skip';
};
type Read = { token: string; analysis: WpAnalysis; mapping: Mapping };
type Preview = { report: CheckReport; media: { files: number; strays: number }; redirects: number };
type Done = { report: CheckReport; backupTaken: string; media: { stored: number; reused: number; failures: { url: string; reason: string }[] }; search: string | null };

const TARGETS: [Target, string][] = [
  ['posts', 'Blog posts'],
  ['pages', 'Pages'],
  ['projects', 'Projects'],
  ['skip', 'Leave out'],
];
const TAX_TARGETS: [TaxTarget, string][] = [
  ['categories', 'Blog categories'],
  ['projectCategories', 'Project categories'],
  ['projectTags', 'Project tags'],
  ['skip', 'Leave out'],
];

export function WordPressImportScreen() {
  return (
    <ToastProvider>
      <Inner />
    </ToastProvider>
  );
}

function Inner() {
  const { toast } = useToast();
  const id = useId();
  const [source, setSource] = useState<'file' | 'site'>('file');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState('');
  const [read, setRead] = useState<Read | null>(null);
  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [onInvalid, setOnInvalid] = useState<'abort' | 'skip'>('abort');
  const [done, setDone] = useState<Done | null>(null);

  const reset = () => {
    setRead(null);
    setMapping(null);
    setPreview(null);
    setDone(null);
  };

  async function readFile(file: File) {
    reset();
    setBusy('read');
    try {
      const form = new FormData();
      form.set('file', file);
      const result = await api<Read>('/api/admin/import/wordpress', { method: 'POST', json: form });
      setRead(result);
      setMapping(result.mapping);
    } catch (error) {
      toast(errorMessage(error, 'That file could not be read.'), 'error');
    } finally {
      setBusy('');
    }
  }

  async function readSite() {
    reset();
    setBusy('read');
    try {
      const result = await api<Read>('/api/admin/import/wordpress', { method: 'POST', json: { action: 'read', url } });
      setRead(result);
      setMapping(result.mapping);
    } catch (error) {
      toast(errorMessage(error, 'That site could not be read.'), 'error');
    } finally {
      setBusy('');
    }
  }

  async function check() {
    if (!read || !mapping) return;
    setBusy('preview');
    setDone(null);
    try {
      setPreview(await api<Preview>('/api/admin/import/wordpress', { method: 'POST', json: { action: 'preview', token: read.token, mapping } }));
    } catch (error) {
      toast(errorMessage(error, 'The check failed.'), 'error');
    } finally {
      setBusy('');
    }
  }

  async function runImport() {
    if (!read || !mapping) return;
    setBusy('import');
    try {
      const result = await api<Done>('/api/admin/import/wordpress', { method: 'POST', json: { action: 'import', token: read.token, mapping, onInvalid } });
      const sum = reportTotals(result.report);
      toast(`Imported: ${sum.create} created, ${sum.update} updated, ${result.media.stored} files stored. The site as it was is kept as ${result.backupTaken}.`, 'success');
      if (result.search) toast(result.search, 'error');
      setDone(result);
      setPreview(null);
      setRead(null);
    } catch (error) {
      const details = error instanceof ApiError ? (error.details as { report?: CheckReport } | undefined) : undefined;
      if (details?.report) setPreview((p) => (p ? { ...p, report: details.report! } : p));
      toast(errorMessage(error, 'The import failed.'), 'error');
    } finally {
      setBusy('');
    }
  }

  const change = (patch: Partial<Mapping>) => {
    setMapping((m) => (m ? { ...m, ...patch } : m));
    setPreview(null);
  };

  return (
    <>
      <PageHeader
        title="Import from WordPress"
        description="Bring posts, pages, portfolio items, their categories and pictures across from a WordPress site — checked like anything saved here, and safe to run again."
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel title="1 — Read the site">
            <div className="mb-4 flex gap-4" role="radiogroup" aria-label="Source">
              {(
                [
                  ['file', 'An export file'],
                  ['site', 'A live site'],
                ] as const
              ).map(([value, label]) => (
                <label key={value} className="flex items-center gap-2 text-[14px] text-ash">
                  <input type="radio" name="source" className="h-4 w-4 accent-flare" checked={source === value} onChange={() => setSource(value)} />
                  {label}
                </label>
              ))}
            </div>
            {source === 'file' ? (
              <Field label="WordPress export (.xml)" hint="Tools → Export → All content, in WordPress" htmlFor={`${id}-file`}>
                <input
                  id={`${id}-file`}
                  type="file"
                  accept=".xml,text/xml,application/xml"
                  className="block w-full text-[14px] text-ash file:mr-3 file:border-2 file:border-hairline file:bg-surface file:px-3 file:py-1.5 file:text-[13px] file:text-bone"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void readFile(file);
                  }}
                />
              </Field>
            ) : (
              <div className="flex flex-wrap items-end gap-2">
                <Field label="Site address" hint="read through its REST API — public content only" htmlFor={`${id}-url`}>
                  <Input id={`${id}-url`} value={url} placeholder="https://example.com" className="w-[340px]" spellCheck={false} onChange={(e) => setUrl(e.target.value)} />
                </Field>
                <AdminButton type="button" disabled={busy !== '' || url.trim().length < 3} onClick={() => void readSite()}>
                  {busy === 'read' ? 'Reading…' : 'Read the site'}
                </AdminButton>
              </div>
            )}
            {busy === 'read' && (
              <div className="mt-4">
                <Spinner label="Reading the site" />
              </div>
            )}
          </Panel>

          {read && mapping && (
            <Panel title="2 — Where everything goes">
              <p className="m-0 mb-4 text-[14px] text-bone">
                {read.analysis.title || 'A WordPress site'} <span className="font-mono text-[12px] text-smoke">{read.analysis.url}</span> —{' '}
                {read.analysis.attachments} files in its library.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {read.analysis.types.map((t) => (
                  <Field key={t.type} label={`${t.type} (${t.count})`} hint={t.sample.join(' · ')} htmlFor={`${id}-t-${t.type}`}>
                    <Select id={`${id}-t-${t.type}`} value={mapping.types[t.type] ?? 'skip'} onChange={(e) => change({ types: { ...mapping.types, [t.type]: e.target.value as Target } })}>
                      {TARGETS.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                ))}
              </div>
              {read.analysis.taxonomies.length > 0 && (
                <div className="mt-4 grid gap-3 border-t-2 border-hairline pt-4 sm:grid-cols-2">
                  {read.analysis.taxonomies.map((t) => (
                    <Field key={t.taxonomy} label={`${t.taxonomy} (${t.count})`} hint={t.sample.join(' · ')} htmlFor={`${id}-x-${t.taxonomy}`}>
                      <Select
                        id={`${id}-x-${t.taxonomy}`}
                        value={mapping.taxonomies[t.taxonomy] ?? 'skip'}
                        onChange={(e) => change({ taxonomies: { ...mapping.taxonomies, [t.taxonomy]: e.target.value as TaxTarget } })}
                      >
                        {TAX_TARGETS.map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  ))}
                </div>
              )}
              <div className="mt-4 grid gap-3 border-t-2 border-hairline pt-4 sm:grid-cols-2">
                <Field label="Files" htmlFor={`${id}-media`}>
                  <Select id={`${id}-media`} value={mapping.media} onChange={(e) => change({ media: e.target.value as Mapping['media'] })}>
                    <option value="used">Download the ones the imported content uses</option>
                    <option value="all">Download the whole library</option>
                    <option value="none">Download nothing (pictures keep pointing at the old site)</option>
                  </Select>
                </Field>
                <Field label="An address this site already has" htmlFor={`${id}-existing`}>
                  <Select id={`${id}-existing`} value={mapping.existing} onChange={(e) => change({ existing: e.target.value as Mapping['existing'] })}>
                    <option value="skip">Leave ours as it is</option>
                    <option value="update">Update it from WordPress</option>
                  </Select>
                </Field>
                {(
                  [
                    ['drafts', 'Drafts, pending and private items too, as drafts'],
                    ['faq', 'Accordions and toggles become an FAQ block'],
                    ['seo', 'Yoast’s titles and descriptions become the SEO fields'],
                    ['redirects', 'A 301 from every old address that changes'],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 text-[14px] text-ash">
                    <input type="checkbox" className="h-4 w-4 accent-flare" checked={mapping[key]} onChange={(e) => change({ [key]: e.target.checked })} />
                    {label}
                  </label>
                ))}
              </div>
              <div className="mt-4">
                <AdminButton type="button" disabled={busy !== ''} onClick={() => void check()}>
                  {busy === 'preview' ? 'Checking…' : 'Check what this would do'}
                </AdminButton>
              </div>
            </Panel>
          )}

          {preview && read && (
            <Panel title="3 — Import">
              <p className="m-0 text-[14px] text-ash">
                {preview.media.files + preview.media.strays} file(s) to fetch{preview.redirects ? `, ${preview.redirects} redirect(s)` : ''}. Files are fetched
                during the import, so their own problems show up there.
              </p>
              <ImportReportView report={preview.report} title="What this import would do" />
              {preview.report.rejected.length > 0 && (
                <fieldset className="m-0 mt-4 flex flex-col gap-2 border-0 p-0">
                  <legend className="mb-2 text-[14px] text-bone">{preview.report.rejected.length} item(s) did not pass the checks the editor applies.</legend>
                  <label className="flex items-center gap-2 text-[14px] text-ash">
                    <input type="radio" name="onInvalid" className="h-4 w-4 accent-flare" checked={onInvalid === 'abort'} onChange={() => setOnInvalid('abort')} />
                    Stop — import nothing
                  </label>
                  <label className="flex items-center gap-2 text-[14px] text-ash">
                    <input type="radio" name="onInvalid" className="h-4 w-4 accent-flare" checked={onInvalid === 'skip'} onChange={() => setOnInvalid('skip')} />
                    Import the rest, and leave those out
                  </label>
                </fieldset>
              )}
              <div className="mt-4">
                <Alert tone="info">
                  Nothing on this site is deleted. A backup is taken first, and everything imported is credited to you. Running
                  the import again later updates what this one made.
                </Alert>
              </div>
              <div className="mt-3">
                <AdminButton type="button" disabled={busy !== '' || (preview.report.rejected.length > 0 && onInvalid === 'abort')} onClick={() => void runImport()}>
                  {busy === 'import' ? 'Importing — fetching files…' : 'Import into this site'}
                </AdminButton>
              </div>
            </Panel>
          )}

          {done && (
            <Panel title="Imported">
              <p className="m-0 text-[14px] text-ash">
                {done.media.stored} file(s) stored, {done.media.reused} already here. The site as it was is kept as{' '}
                <span className="font-mono text-[12px]">{done.backupTaken}</span>.
              </p>
              {done.media.failures.length > 0 && (
                <div className="mt-3">
                  <p className="m-0 mb-1 text-[13px] text-flare-soft">{done.media.failures.length} file(s) could not be brought across:</p>
                  <ul className="m-0 max-h-[200px] list-none overflow-y-auto p-0 text-[12px] text-ash">
                    {done.media.failures.map((f) => (
                      <li key={f.url}>
                        <span className="font-mono">{f.url}</span> — {f.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <ImportReportView report={done.report} title="What the import did" />
            </Panel>
          )}
        </div>

        <aside className="flex flex-col gap-6 lg:sticky lg:top-10">
          <Panel title="Which source">
            <p className="m-0 text-[13px] leading-relaxed text-ash">
              <strong className="text-bone">An export file</strong> carries everything, drafts and private posts included, and
              the page builders’ shortcodes — which are cleaned into ordinary HTML here. <strong className="text-bone">A live site</strong>{' '}
              is read through its REST API, which shows only what is public, already rendered.
            </p>
          </Panel>
          <Panel title="What comes across">
            <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[13px] leading-relaxed text-ash">
              <li>Posts, pages and a portfolio type</li>
              <li>Categories and tags, as you map them</li>
              <li>Featured images, and the files the content uses</li>
              <li>Yoast titles and descriptions</li>
              <li>A redirect from each old address</li>
            </ul>
            <p className="m-0 mt-3 text-[13px] leading-relaxed text-smoke">Not users, comments, menus or plugin settings.</p>
          </Panel>
        </aside>
      </div>
    </>
  );
}
