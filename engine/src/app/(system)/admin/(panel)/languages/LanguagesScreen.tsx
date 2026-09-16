'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { PageHeader } from '@/components/admin/PageHeader';
import { AdminButton, Alert, Badge, EmptyState, Field, Panel, Select, Spinner } from '@/components/admin/ui';
import { ToastProvider, useToast } from '@/components/admin/useToast';
import { api, fetcher } from '@/lib/admin/client';
import { errorMessage } from '../_shared';

/* ═══════════════════════════════════════════════════════════════════════════
   Languages
   ───────────────────────────────────────────────────────────────────────────
   Two things this screen has to make obvious, because both surprise people:

     • the first language is the main one and is served without a prefix, so
       reordering the list rewrites every URL on the site;
     • the list lives in .env, which the routing layer read at boot — so a
       change needs a restart, and saying otherwise would leave somebody
       refreshing a page that is never going to change.
   ═══════════════════════════════════════════════════════════════════════════ */

type Available = { code: string; name: string; english: string; rtl: boolean };
type Loaded = {
  locales: string[];
  defaultLocale: string;
  multilingual: boolean;
  content: Record<string, { pages: number; posts: number }>;
  available: Available[];
};

export function LanguagesScreen() {
  return (
    <ToastProvider>
      <LanguagesScreenInner />
    </ToastProvider>
  );
}

function LanguagesScreenInner() {
  const { toast } = useToast();
  const { data, isLoading, mutate } = useSWR<Loaded>('/api/admin/languages', fetcher);

  const [draft, setDraft] = useState<string[] | null>(null);
  const [adding, setAdding] = useState('');
  const [busy, setBusy] = useState(false);
  const [restart, setRestart] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);

  if (isLoading) return <Spinner label="Loading languages" />;
  if (!data) return <Alert>The languages could not be loaded.</Alert>;

  const locales = draft ?? data.locales;
  const dirty = draft !== null && draft.join(',') !== data.locales.join(',');
  const byCode = new Map(data.available.map((a) => [a.code, a]));
  const label = (code: string) => byCode.get(code)?.name ?? code.toUpperCase();
  const english = (code: string) => byCode.get(code)?.english ?? code.toUpperCase();

  const move = (from: number, to: number) => {
    if (to < 0 || to >= locales.length) return;
    const next = [...locales];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item!);
    setDraft(next);
    setConfirming(null);
  };

  const remove = (code: string) => {
    if (locales.length === 1) return;
    setDraft(locales.filter((l) => l !== code));
    setConfirming(null);
  };

  const add = () => {
    if (!adding || locales.includes(adding)) return;
    setDraft([...locales, adding]);
    setAdding('');
    setConfirming(null);
  };

  async function save(force: boolean) {
    setBusy(true);
    try {
      const result = await api<{ restartRequired: boolean }>('/api/admin/languages', {
        method: 'PUT',
        json: { locales, force },
      });
      setRestart(result.restartRequired);
      setDraft(null);
      setConfirming(null);
      await mutate();
      toast('Languages saved.', 'success');
    } catch (error) {
      const message = errorMessage(error, 'That could not be saved.');
      // The API refuses to strand content unless it is asked twice.
      if (/confirm to continue/i.test(message)) setConfirming(message);
      else toast(message, 'error');
    } finally {
      setBusy(false);
    }
  }

  const unused = data.available.filter((a) => !locales.includes(a.code));

  return (
    <>
      <PageHeader
        title="Languages"
        description="Which languages this site publishes in. The first is the main one and is served without a prefix in the address."
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-6">
          {restart && (
            <Alert tone="info">
              Saved. <strong className="text-bone">Restart the site to apply it.</strong> The part of the engine that
              decides which language a URL is in reads this when it starts, and cannot pick it up while running — under
              pm2 that is <code className="font-mono">pm2 restart engine</code>. Pages already published were built
              with the old list, so they are cleared here and rebuild themselves after the restart.
            </Alert>
          )}

          {confirming && (
            <Alert tone="error">
              {confirming}
              <span className="mt-3 flex gap-2">
                <AdminButton type="button" disabled={busy} onClick={() => void save(true)}>
                  Remove it anyway
                </AdminButton>
                <AdminButton type="button" variant="ghost" onClick={() => setConfirming(null)}>
                  Keep it
                </AdminButton>
              </span>
            </Alert>
          )}

          <Panel title={`In use (${locales.length})`}>
            <div className="flex flex-col">
              {locales.map((code, i) => {
                const counts = data.content[code];
                const isMain = i === 0;
                return (
                  <div
                    key={code}
                    className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b-2 border-hairline py-3 last:border-b-0"
                  >
                    <div className="min-w-[160px] flex-1">
                      <p className="m-0 text-[15px] text-bone">
                        {label(code)} <span className="text-[13px] text-smoke">{english(code)}</span>
                      </p>
                      <p className="m-0 mt-1 font-mono text-[11px] text-smoke">
                        {isMain ? '/about' : `/${code}/about`}
                        {byCode.get(code)?.rtl ? ' · right to left' : ''}
                      </p>
                    </div>

                    {isMain ? <Badge tone="live">main</Badge> : <Badge tone="neutral">{code}</Badge>}

                    <span className="font-mono text-[11px] text-smoke">
                      {counts ? `${counts.pages} pages · ${counts.posts} posts` : 'no content yet'}
                    </span>

                    <span className="flex gap-2">
                      <button
                        type="button"
                        className="font-mono text-[11px] uppercase tracking-[0.12em] text-smoke hover:text-bone disabled:opacity-40"
                        disabled={i === 0}
                        onClick={() => move(i, i - 1)}
                      >
                        Up
                      </button>
                      <button
                        type="button"
                        className="font-mono text-[11px] uppercase tracking-[0.12em] text-smoke hover:text-bone disabled:opacity-40"
                        disabled={i === locales.length - 1}
                        onClick={() => move(i, i + 1)}
                      >
                        Down
                      </button>
                      <button
                        type="button"
                        className="font-mono text-[11px] uppercase tracking-[0.12em] text-smoke hover:text-bone disabled:opacity-40"
                        disabled={locales.length === 1}
                        onClick={() => remove(code)}
                      >
                        Remove
                      </button>
                    </span>
                  </div>
                );
              })}
            </div>

            {locales.length === 1 && (
              <p className="m-0 mt-4 text-[13px] leading-relaxed text-smoke">
                One language: no prefixes anywhere, no switcher, and no hreflang tags. Add a second to turn all of that
                on.
              </p>
            )}
          </Panel>

          <Panel title="Add a language">
            {unused.length === 0 ? (
              <EmptyState title="All of them" body="Every language the engine knows is already in use." />
            ) : (
              <div className="flex flex-wrap items-end gap-3">
                <Field label="Language" htmlFor="add-language">
                  <Select id="add-language" value={adding} onChange={(event) => setAdding(event.target.value)}>
                    <option value="">Choose…</option>
                    {unused.map((a) => (
                      <option key={a.code} value={a.code}>
                        {a.english} — {a.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <AdminButton type="button" variant="ghost" disabled={!adding} onClick={add}>
                  Add
                </AdminButton>
              </div>
            )}
          </Panel>

          <div className="flex items-center gap-3">
            <AdminButton type="button" disabled={!dirty || busy} onClick={() => void save(false)}>
              {busy ? 'Saving…' : 'Save languages'}
            </AdminButton>
            {dirty && (
              <AdminButton type="button" variant="ghost" onClick={() => { setDraft(null); setConfirming(null); }}>
                Discard
              </AdminButton>
            )}
          </div>
        </div>

        <aside className="flex flex-col gap-6 lg:sticky lg:top-10">
          <Panel title="What the order does">
            <p className="m-0 text-[13px] leading-relaxed text-smoke">
              The first language is the main one. Its pages sit at the top level — <code className="font-mono">/about</code>{' '}
              — and every other language is prefixed with its code. Moving a language to the top moves its pages to the
              top level and pushes the old main language down into a prefix.
            </p>
            <p className="m-0 mt-3 text-[13px] leading-relaxed text-smoke">
              That rewrites addresses people may have linked to, so it is worth doing once, early.
            </p>
          </Panel>

          <Panel title="Removing a language">
            <p className="m-0 text-[13px] leading-relaxed text-smoke">
              Nothing is deleted. The pages stay exactly where they are — they simply stop being reachable, because the
              site no longer answers on that prefix. Add the language back and they return.
            </p>
          </Panel>

          <Panel title="Why a restart">
            <p className="m-0 text-[13px] leading-relaxed text-smoke">
              Deciding whether <code className="font-mono">/hy</code> is a language or a page happens before the
              database is reachable, so the list is kept in the site&rsquo;s configuration file rather than in the
              database. That file is read once, when the site starts.
            </p>
          </Panel>
        </aside>
      </div>
    </>
  );
}
