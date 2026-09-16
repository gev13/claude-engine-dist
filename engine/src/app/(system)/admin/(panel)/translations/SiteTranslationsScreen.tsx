'use client';

import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { PageHeader } from '@/components/admin/PageHeader';
import { AdminButton, Alert, EmptyState, Field, Input, Panel, Select, Spinner } from '@/components/admin/ui';
import { ToastProvider, useToast } from '@/components/admin/useToast';
import { api, fetcher } from '@/lib/admin/client';
import { localeName } from '@/lib/locales';
import { errorMessage } from '../_shared';

/* ═══════════════════════════════════════════════════════════════════════════
   Everything that is not page content
   ───────────────────────────────────────────────────────────────────────────
   A site has three things beyond its pages: its own details, its menus, and
   the words the engine itself says. All three are translated here, in the same
   shape as a page — the original on the left, a box on the right, and an empty
   box meaning "keep the original".

   The admin panel is not translated, by decision. It stays English.
   ═══════════════════════════════════════════════════════════════════════════ */

type Loaded = {
  locale: string;
  defaultLocale: string;
  site: { key: string; source: string; target: string }[];
  menus: { path: string; key: string; source: string; target: string }[];
  words: { key: string; source: string; target: string }[];
};

const SITE_LABELS: Record<string, string> = {
  'site.name': 'Site name',
  'site.tagline': 'Tagline',
  'site.description': 'Description',
  'site.contactEmail': 'Contact email',
};

export function SiteTranslationsScreen({
  locales,
  defaultLocale,
}: {
  locales: string[];
  defaultLocale: string;
}) {
  return (
    <ToastProvider>
      <Inner locales={locales} defaultLocale={defaultLocale} />
    </ToastProvider>
  );
}

function Inner({ locales, defaultLocale }: { locales: string[]; defaultLocale: string }) {
  const { toast } = useToast();
  const others = useMemo(() => locales.filter((code) => code !== defaultLocale), [locales, defaultLocale]);
  const [locale, setLocale] = useState(others[0] ?? '');

  const { data, isLoading, mutate } = useSWR<Loaded>(
    locale ? `/api/admin/site-translations?locale=${encodeURIComponent(locale)}` : null,
    fetcher,
  );

  const [site, setSite] = useState<Record<string, string>>({});
  const [menus, setMenus] = useState<Record<string, string>>({});
  const [words, setWords] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!data) return;
    setSite(Object.fromEntries(data.site.map((row) => [row.key, row.target])));
    setMenus(Object.fromEntries(data.menus.map((row) => [row.path, row.target])));
    setWords(Object.fromEntries(data.words.map((row) => [row.key, row.target])));
  }, [data]);

  if (others.length === 0) {
    return (
      <>
        <PageHeader title="Site translations" description="Menus, the site's details, and the engine's own wording." />
        <EmptyState
          title="One language"
          body="This site publishes in a single language, so there is nothing to translate. Add another in Languages."
        />
      </>
    );
  }

  /* Counted per section rather than over one merged list: the three are keyed
     differently — menus by path, the rest by key — and merging them was how the
     count went wrong. */
  const remaining = data
    ? data.site.filter((row) => !(site[row.key] ?? '').trim()).length +
      data.menus.filter((row) => !(menus[row.path] ?? '').trim()).length +
      data.words.filter((row) => !(words[row.key] ?? '').trim()).length
    : 0;

  async function save() {
    setBusy(true);
    try {
      await api('/api/admin/site-translations', { method: 'PUT', json: { locale, site, menus, words } });
      await mutate();
      toast('Saved.', 'success');
    } catch (error) {
      toast(errorMessage(error, 'That could not be saved.'), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Site translations"
        description="Menus, the site's details, and the engine's own wording. Page and post content is translated from each page."
        actions={
          <Field label="" htmlFor="which-language">
            <Select id="which-language" value={locale} onChange={(event) => setLocale(event.target.value)}>
              {others.map((code) => (
                <option key={code} value={code}>
                  {localeName(code)}
                </option>
              ))}
            </Select>
          </Field>
        }
      />

      {isLoading || !data ? (
        <Spinner label="Loading" />
      ) : (
        <div className="flex flex-col gap-6">
          <Alert>
            {remaining === 0
              ? `Everything here is translated into ${localeName(locale)}.`
              : `${remaining} still to translate. Anything left empty keeps the ${localeName(defaultLocale)} wording.`}
          </Alert>

          <Panel title="The site’s details">
            <div className="flex flex-col gap-4">
              {data.site.map((row) => (
                <Pair key={row.key} label={SITE_LABELS[row.key] ?? row.key} source={row.source}>
                  <Input
                    value={site[row.key] ?? ''}
                    placeholder="—"
                    onChange={(event) => setSite({ ...site, [row.key]: event.target.value })}
                  />
                </Pair>
              ))}
            </div>
          </Panel>

          <Panel title={`Menus (${data.menus.length})`}>
            {data.menus.length === 0 ? (
              <EmptyState title="No menus saved yet" body="Build the menus first, in Menus." />
            ) : (
              <>
                <p className="m-0 mb-4 text-[13px] leading-relaxed text-smoke">
                  Labels only — the addresses they point at are shared, so a menu cannot gain or lose an item in one
                  language.
                </p>
                <div className="flex flex-col gap-4">
                  {data.menus.map((row) => (
                    <Pair key={row.path} label={row.key} source={row.source}>
                      <Input
                        value={menus[row.path] ?? ''}
                        placeholder="—"
                        onChange={(event) => setMenus({ ...menus, [row.path]: event.target.value })}
                      />
                    </Pair>
                  ))}
                </div>
              </>
            )}
          </Panel>

          <Panel title={`The engine’s own words (${data.words.length})`}>
            <p className="m-0 mb-4 text-[13px] leading-relaxed text-smoke">
              What the site says that nobody typed — “Skip to content”, “min read”, “Sending…”. The admin panel is not
              translated and stays in English.
            </p>
            <div className="flex flex-col gap-4">
              {data.words.map((row) => (
                <Pair key={row.key} label={row.key} source={row.source}>
                  <Input
                    value={words[row.key] ?? ''}
                    placeholder="—"
                    onChange={(event) => setWords({ ...words, [row.key]: event.target.value })}
                  />
                </Pair>
              ))}
            </div>
          </Panel>

          <div className="sticky bottom-0 flex items-center gap-3 border-t-2 border-hairline bg-ink py-4">
            <AdminButton type="button" disabled={busy} onClick={() => void save()}>
              {busy ? 'Saving…' : `Save ${localeName(locale)}`}
            </AdminButton>
            <span className="text-[13px] text-smoke">
              {remaining === 0 ? 'Nothing left.' : `${remaining} left.`}
            </span>
          </div>
        </div>
      )}
    </>
  );
}

function Pair({ label, source, children }: { label: string; source: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-3 border-b-2 border-hairline pb-4 last:border-b-0 md:grid-cols-2">
      <div>
        <p className="m-0 font-mono text-[10px] uppercase tracking-[0.12em] text-smoke">{label}</p>
        <p className="m-0 mt-1 text-[14px] leading-relaxed text-ash">{source || '—'}</p>
      </div>
      <Field label="">{children}</Field>
    </div>
  );
}
