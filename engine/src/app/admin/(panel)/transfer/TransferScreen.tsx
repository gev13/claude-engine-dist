'use client';

import { useRef, useState } from 'react';
import useSWR from 'swr';
import { PageHeader } from '@/components/admin/PageHeader';
import { AdminButton, Alert, EmptyState, Field, Input, Panel, Spinner, Table, Td, Th } from '@/components/admin/ui';
import { ToastProvider, useToast } from '@/components/admin/useToast';
import { api, fetcher } from '@/lib/admin/client';
import { errorMessage } from '../_shared';

/* ═══════════════════════════════════════════════════════════════════════════
   Export & import (content only)
   ───────────────────────────────────────────────────────────────────────────
   Backups put this site back. This moves a site's content to a different one,
   so it carries no people — not the accounts, and not the visitors either.
   The screen says so plainly, because the difference is the whole point and
   somebody reaching for the wrong one loses either their accounts or their
   enquiries.
   ═══════════════════════════════════════════════════════════════════════════ */

type Archive = { filename: string; bytes: number; createdAt: string };
type Loaded = { items: Archive[]; engineVersion: string; maxImportBytes: number };

type Manifest = {
  engineVersion: string;
  takenAt: string;
  siteName: string;
  includesMedia: boolean;
  includesSettings: boolean;
  tables: Record<string, number>;
};

const IMPORT_CONFIRM = 'replace all content';

function size(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function when(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function TransferScreen({ canWrite }: { canWrite: boolean }) {
  return (
    <ToastProvider>
      <TransferScreenInner canWrite={canWrite} />
    </ToastProvider>
  );
}

function TransferScreenInner({ canWrite }: { canWrite: boolean }) {
  const { toast } = useToast();
  const { data, isLoading, mutate } = useSWR<Loaded>('/api/admin/transfer', fetcher);

  const [busy, setBusy] = useState('');
  const [includeMedia, setIncludeMedia] = useState(true);
  const [includeSettings, setIncludeSettings] = useState(true);

  const fileInput = useRef<HTMLInputElement>(null);
  const [chosen, setChosen] = useState<File | null>(null);
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [typed, setTyped] = useState('');

  async function createExport() {
    setBusy('export');
    try {
      const result = await api<{ export: { filename: string } }>('/api/admin/transfer', {
        method: 'POST',
        json: { action: 'export', includeMedia, includeSettings },
      });
      await mutate();
      toast(`Exported ${result.export.filename}.`, 'success');
    } catch (error) {
      toast(errorMessage(error, 'The export could not be made.'), 'error');
    } finally {
      setBusy('');
    }
  }

  async function remove(filename: string) {
    setBusy(filename);
    try {
      await api('/api/admin/transfer', { method: 'POST', json: { action: 'delete', filename } });
      await mutate();
      toast('Deleted.', 'success');
    } catch (error) {
      toast(errorMessage(error, 'That could not be deleted.'), 'error');
    } finally {
      setBusy('');
    }
  }

  /** Read the manifest without applying anything, so nobody imports blind. */
  async function inspect(file: File) {
    setBusy('inspect');
    setManifest(null);
    try {
      const form = new FormData();
      form.set('file', file);
      form.set('mode', 'inspect');
      const result = await api<{ manifest: Manifest }>('/api/admin/transfer', { method: 'POST', json: form });
      setManifest(result.manifest);
    } catch (error) {
      setChosen(null);
      if (fileInput.current) fileInput.current.value = '';
      toast(errorMessage(error, 'That file could not be read.'), 'error');
    } finally {
      setBusy('');
    }
  }

  async function runImport() {
    if (!chosen) return;
    setBusy('import');
    try {
      const form = new FormData();
      form.set('file', chosen);
      form.set('mode', 'import');
      form.set('confirm', IMPORT_CONFIRM);
      const result = await api<{ applied: Record<string, number>; backupTaken: string }>('/api/admin/transfer', {
        method: 'POST',
        json: form,
      });
      const total = Object.values(result.applied).reduce((sum, n) => sum + n, 0);
      toast(`Imported ${total} rows. The site as it was is kept as ${result.backupTaken}.`, 'success');
      setChosen(null);
      setManifest(null);
      setTyped('');
      if (fileInput.current) fileInput.current.value = '';
      await mutate();
    } catch (error) {
      toast(errorMessage(error, 'The import failed.'), 'error');
    } finally {
      setBusy('');
    }
  }

  if (isLoading) return <Spinner label="Loading exports" />;

  const items = data?.items ?? [];

  return (
    <>
      <PageHeader
        title="Export & import"
        description="Move this site's content to another site — pages, posts, media and the design, without any accounts."
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel title="Export this site's content">
            <p className="m-0 text-[14px] leading-relaxed text-ash">
              Makes one file holding every page, post, category, redirect and — if you want it — the media library and
              the design. No accounts, and no enquiries, sign-ups or form answers: those belong to the site they were
              given to. Use <strong className="text-bone">Backups</strong> if you want a complete copy of this site.
            </p>

            <div className="mt-4 flex flex-col gap-2">
              <label className="flex items-center gap-2 text-[14px] text-ash">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-flare"
                  checked={includeMedia}
                  disabled={!canWrite}
                  onChange={(event) => setIncludeMedia(event.target.checked)}
                />
                Include the media library — the uploaded files themselves
              </label>
              <label className="flex items-center gap-2 text-[14px] text-ash">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-flare"
                  checked={includeSettings}
                  disabled={!canWrite}
                  onChange={(event) => setIncludeSettings(event.target.checked)}
                />
                Include the design, menus, popups and the site&rsquo;s name
              </label>
            </div>

            {canWrite && (
              <div className="mt-4">
                <AdminButton type="button" disabled={busy === 'export'} onClick={() => void createExport()}>
                  {busy === 'export' ? 'Exporting…' : 'Create an export'}
                </AdminButton>
              </div>
            )}
          </Panel>

          <Panel title={`Exports on this server (${items.length})`}>
            {items.length === 0 ? (
              <EmptyState title="Nothing exported yet" body="An export you make appears here to download." />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>File</Th>
                    <Th>Size</Th>
                    <Th>Made</Th>
                    <Th>{''}</Th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.filename}>
                      <Td>
                        <span className="font-mono text-[12px]">{item.filename}</span>
                      </Td>
                      <Td>{size(item.bytes)}</Td>
                      <Td>{when(item.createdAt)}</Td>
                      <Td>
                        <div className="flex gap-3">
                          <a
                            href={`/api/admin/transfer?download=${encodeURIComponent(item.filename)}`}
                            className="text-flare-soft hover:text-bone"
                          >
                            Download
                          </a>
                          {canWrite && (
                            <button
                              type="button"
                              className="text-smoke hover:text-bone"
                              disabled={busy === item.filename}
                              onClick={() => void remove(item.filename)}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Panel>

          {canWrite && (
            <Panel title="Import from another site">
              <p className="m-0 text-[14px] leading-relaxed text-ash">
                Choose an export file. Its contents are read and shown before anything happens — nothing is applied
                until you confirm.
              </p>

              <div className="mt-4">
                <Field label="Export file" hint="a content export, not a backup">
                  <input
                    ref={fileInput}
                    type="file"
                    accept=".gz,.tar.gz,application/gzip"
                    className="block w-full text-[14px] text-ash file:mr-3 file:border-2 file:border-hairline file:bg-surface file:px-3 file:py-1.5 file:text-[13px] file:text-bone"
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      setChosen(file);
                      setManifest(null);
                      setTyped('');
                      if (file) void inspect(file);
                    }}
                  />
                </Field>
              </div>

              {busy === 'inspect' && (
                <div className="mt-4">
                  <Spinner label="Reading the archive" />
                </div>
              )}

              {manifest && (
                <div className="mt-4 border-2 border-hairline bg-surface p-4">
                  <p className="m-0 text-[14px] text-bone">
                    {manifest.siteName ? `From “${manifest.siteName}”` : 'A content export'} — engine{' '}
                    {manifest.engineVersion}, made {when(manifest.takenAt)}.
                  </p>
                  <ul className="m-0 mt-3 flex list-none flex-wrap gap-x-5 gap-y-1 p-0">
                    {Object.entries(manifest.tables).map(([table, count]) => (
                      <li key={table} className="font-mono text-[12px] text-smoke">
                        {table.replace(/_/g, ' ')}: {count}
                      </li>
                    ))}
                  </ul>
                  <p className="m-0 mt-3 text-[13px] text-smoke">
                    {manifest.includesMedia ? 'Includes the media files.' : 'No media files — images may be missing.'}{' '}
                    {manifest.includesSettings ? 'Includes the design and menus.' : 'No design or menus.'}
                  </p>
                </div>
              )}

              {manifest && (
                <div className="mt-4 border-t-2 border-hairline pt-4">
                  <Alert>
                    This replaces every page, post, category, redirect and media record on this site, and clears their
                    revision history. Your accounts, enquiries, sign-ups and form answers are left alone. A backup of
                    the site as it stands is taken first, and everything imported is credited to you.
                  </Alert>

                  <p className="m-0 mt-4 text-[13px] text-smoke">
                    Type <strong className="text-bone">{IMPORT_CONFIRM}</strong> to continue.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Input
                      value={typed}
                      onChange={(event) => setTyped(event.target.value)}
                      className="w-[260px]"
                      aria-label="Confirmation"
                    />
                    <AdminButton
                      type="button"
                      disabled={typed !== IMPORT_CONFIRM || busy === 'import'}
                      onClick={() => void runImport()}
                    >
                      {busy === 'import' ? 'Importing…' : 'Replace this site’s content'}
                    </AdminButton>
                  </div>
                </div>
              )}
            </Panel>
          )}
        </div>

        <aside className="flex flex-col gap-6 lg:sticky lg:top-10">
          <Panel title="What travels">
            <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[13px] leading-relaxed text-ash">
              <li>Pages, posts and categories</li>
              <li>Redirects</li>
              <li>The media library, files included</li>
              <li>The design, menus, popups and the site&rsquo;s name</li>
            </ul>
          </Panel>

          <Panel title="What never travels">
            <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[13px] leading-relaxed text-ash">
              <li>Accounts, sessions and the audit log</li>
              <li>Enquiries, newsletter sign-ups and form answers</li>
              <li>Email settings and the security policy</li>
              <li>Revision history</li>
            </ul>
            <p className="m-0 mt-3 text-[13px] leading-relaxed text-smoke">
              Visitors&rsquo; details belong to the site they were given to. The SMTP password is encrypted with this
              server&rsquo;s key and would be unreadable elsewhere in any case.
            </p>
          </Panel>

          <Panel title="Authorship">
            <p className="m-0 text-[13px] leading-relaxed text-smoke">
              An export carries no accounts, so it cannot carry authors either. Everything imported is credited to
              whoever does the importing.
            </p>
          </Panel>
        </aside>
      </div>
    </>
  );
}
