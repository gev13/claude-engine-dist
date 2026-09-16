'use client';

import Link from 'next/link';
import nextDynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { PageHeader } from '@/components/admin/PageHeader';
import { AdminButton, Alert, Badge, Field, Input, Panel, Spinner } from '@/components/admin/ui';
import { ToastProvider, useToast } from '@/components/admin/useToast';
import { api, fetcher } from '@/lib/admin/client';
import { localeName } from '@/lib/locales';
import { errorMessage } from '../../../../_shared';

/* ═══════════════════════════════════════════════════════════════════════════
   Translating a page, side by side
   ───────────────────────────────────────────────────────────────────────────
   The original on the left, a box to type into on the right, one row per piece
   of text — in the order they appear on the page, so a translator reads down
   the page rather than hunting through a form.

   Structure is not editable here on purpose: the translation follows the
   original's layout, pictures and block order, so those can never drift apart.
   The screen says so rather than leaving somebody looking for the controls.
   ═══════════════════════════════════════════════════════════════════════════ */

/** The same editor the original was written in — a translator should not be
 *  handed raw HTML in a textarea. */
const RichTextEditor = nextDynamic(() => import('@/components/admin/RichTextEditor'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[320px] items-center justify-center border-2 border-hairline bg-ink font-mono text-[10px] uppercase tracking-[0.12em] text-smoke">
      Loading the editor
    </div>
  ),
});

type StringRow = { path: string; key: string; source: string; target: string };
type LanguageRow = {
  locale: string;
  id: string | null;
  title: string | null;
  status: string | null;
  progress: { total: number; translated: number; remaining: number };
};

type Loaded = {
  kind: 'page' | 'post' | 'category';
  source: {
    id: string;
    locale: string;
    title: string;
    slug: string;
    path: string;
    excerpt: string;
    summary: string;
    body: string;
  };
  target: {
    id: string;
    locale: string;
    title: string;
    slug: string;
    path: string;
    excerpt: string;
    summary: string;
    body: string;
    status: string;
  } | null;
  strings: StringRow[];
  languages: LanguageRow[];
};

/** Long prose gets a textarea; a heading gets a single line. */
const LONG_KEYS = new Set(['body', 'intro', 'text', 'answer', 'quote', 'description', 'footnote', 'successText']);
const isLong = (row: StringRow) => LONG_KEYS.has(row.key) || row.source.length > 110;

export function TranslateScreen({
  sourceId,
  locale,
  kind = 'page',
}: {
  sourceId: string;
  locale: string;
  kind?: 'page' | 'post' | 'category';
}) {
  return (
    <ToastProvider>
      <TranslateScreenInner sourceId={sourceId} locale={locale} kind={kind} />
    </ToastProvider>
  );
}

function TranslateScreenInner({
  sourceId,
  locale,
  kind,
}: {
  sourceId: string;
  locale: string;
  kind: 'page' | 'post' | 'category';
}) {
  const { toast } = useToast();
  const { data, isLoading, mutate } = useSWR<Loaded>(
    `/api/admin/translations?id=${encodeURIComponent(sourceId)}&locale=${encodeURIComponent(locale)}&kind=${kind}`,
    fetcher,
  );

  const [fields, setFields] = useState({ title: '', slug: '', excerpt: '', summary: '', body: '' });
  const [strings, setStrings] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [started, setStarted] = useState(false);

  // Fill the form once the page arrives, and again after a save.
  useEffect(() => {
    if (!data?.target) return;
    setFields({
      title: data.target.title,
      slug: data.target.slug,
      excerpt: data.target.excerpt,
      summary: data.target.summary,
      body: data.target.body,
    });
    setStrings(Object.fromEntries(data.strings.map((row) => [row.path, row.target])));
  }, [data]);

  const remaining = useMemo(() => {
    if (!data) return 0;
    return data.strings.filter((row) => !(strings[row.path] ?? '').trim()).length;
  }, [data, strings]);

  if (isLoading) return <Spinner label="Loading the page" />;
  if (!data) return <Alert>That page could not be loaded.</Alert>;

  async function start() {
    setBusy(true);
    try {
      await api('/api/admin/translations', { method: 'POST', json: { id: sourceId, locale, kind } });
      setStarted(true);
      await mutate();
      toast('Translation started — a draft copy of the original.', 'success');
    } catch (error) {
      toast(errorMessage(error, 'That could not be started.'), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!data?.target) return;
    setBusy(true);
    try {
      const result = await api<{ progress: { remaining: number } }>('/api/admin/translations', {
        method: 'PUT',
        json: { sourceId, kind, id: data.target.id, ...fields, strings },
      });
      await mutate();
      toast(
        result.progress.remaining === 0
          ? 'Saved. Everything on this page is translated.'
          : `Saved. ${result.progress.remaining} left to translate.`,
        'success',
      );
    } catch (error) {
      toast(errorMessage(error, 'That could not be saved.'), 'error');
    } finally {
      setBusy(false);
    }
  }

  const language = localeName(locale);
  /* "categorys" is not a word, and a category has no per-id screen — the
     manager is one page. */
  const section = kind === 'category' ? 'categories' : `${kind}s`;
  const backHref = kind === 'category' ? '/admin/categories' : `/admin/${section}/${sourceId}`;

  return (
    <>
      <PageHeader
        title={`Translate into ${language}`}
        description={`“${data.source.title}” — the original is on the left, the translation on the right.`}
        actions={
          <Link href={backHref} className="text-[13px] text-flare-soft hover:text-bone">
            Back to the original
          </Link>
        }
      />

      {/* Which languages this page exists in, and how far each has got. */}
      <div className="mb-6 flex flex-wrap gap-2">
        {data.languages.map((row) => (
          <Link
            key={row.locale}
            href={`/admin///translate/`}
            className={`border-2 px-3 py-2 text-[13px] ${
              row.locale === locale ? 'border-flare text-bone' : 'border-hairline text-smoke hover:text-bone'
            }`}
          >
            {localeName(row.locale)}{' '}
            <span className="font-mono text-[11px]">
              {row.id ? `${row.progress.translated}/${row.progress.total}` : 'not started'}
            </span>
          </Link>
        ))}
      </div>

      {!data.target ? (
        <Panel title={`No ${language} version yet`}>
          <p className="m-0 text-[14px] leading-relaxed text-ash">
            Starting one makes a draft copy of this page in {language} — the same layout, the same pictures, the same
            blocks — with the original&rsquo;s words in place, ready to be replaced. Nothing is published until you
            publish it.
          </p>
          <div className="mt-4">
            <AdminButton type="button" disabled={busy || started} onClick={() => void start()}>
              {busy ? 'Starting…' : `Start the ${language} translation`}
            </AdminButton>
          </div>
        </Panel>
      ) : (
        <div className="flex flex-col gap-6">
          <Alert tone={remaining === 0 ? 'info' : undefined}>
            {remaining === 0
              ? 'Everything on this page has been translated.'
              : `${remaining} of ${data.strings.length} pieces of text still to translate.`}{' '}
            <Badge tone={data.target.status === 'published' ? 'live' : 'draft'}>{data.target.status}</Badge>
          </Alert>

          <Panel title={kind === 'post' ? 'The post itself' : 'The page itself'}>
            <div className="flex flex-col gap-4">
              <Pair label="Title" source={data.source.title}>
                <Input value={fields.title} onChange={(e) => setFields({ ...fields, title: e.target.value })} />
              </Pair>
              <Pair label="Address" source={data.source.path} hint="the last part of the address, in this language">
                <Input value={fields.slug} onChange={(e) => setFields({ ...fields, slug: e.target.value })} />
              </Pair>
              {kind === 'page' && (
                <Pair label="Summary" source={data.source.summary}>
                  <Input value={fields.summary} onChange={(e) => setFields({ ...fields, summary: e.target.value })} />
                </Pair>
              )}
              <Pair label="Search description" source={data.source.excerpt}>
                <textarea
                  className="min-h-[72px] w-full border-2 border-hairline bg-surface p-3 text-[14px] text-bone"
                  value={fields.excerpt}
                  onChange={(e) => setFields({ ...fields, excerpt: e.target.value })}
                />
              </Pair>
            </div>
          </Panel>

          {kind === 'post' && (
            <Panel title="The article">
              <p className="m-0 mb-4 text-[13px] leading-relaxed text-smoke">
                Written in the same editor as the original. Leave it empty and the post keeps the
                original&rsquo;s text.
              </p>
              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <p className="m-0 mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-smoke">Original</p>
                  {/* Already sanitised on write, by the same function this screen's
                      own save runs the translation through. */}
                  <div
                    className="he-prose max-h-[320px] overflow-auto border-2 border-hairline bg-surface p-4 text-[14px] leading-relaxed text-ash"
                    dangerouslySetInnerHTML={{ __html: data.source.body }}
                  />
                </div>
                <div>
                  <p className="m-0 mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-smoke">
                    {language}
                  </p>
                  <RichTextEditor
                    value={fields.body}
                    onChange={(html) => setFields({ ...fields, body: html })}
                    height={320}
                  />
                </div>
              </div>
            </Panel>
          )}

          <Panel title={`The page’s words (${data.strings.length})`}>
            <p className="m-0 mb-4 text-[13px] leading-relaxed text-smoke">
              In the order they appear on the page. Anything left empty keeps the original&rsquo;s wording, so a
              half-finished translation still reads.
            </p>

            <div className="flex flex-col gap-4">
              {data.strings.map((row) => (
                <Pair key={row.path} label={row.key} source={row.source}>
                  {isLong(row) ? (
                    <textarea
                      className="min-h-[96px] w-full border-2 border-hairline bg-surface p-3 text-[14px] text-bone"
                      value={strings[row.path] ?? ''}
                      placeholder="—"
                      onChange={(e) => setStrings({ ...strings, [row.path]: e.target.value })}
                    />
                  ) : (
                    <Input
                      value={strings[row.path] ?? ''}
                      placeholder="—"
                      onChange={(e) => setStrings({ ...strings, [row.path]: e.target.value })}
                    />
                  )}
                </Pair>
              ))}
            </div>
          </Panel>

          <div className="sticky bottom-0 flex items-center gap-3 border-t-2 border-hairline bg-ink py-4">
            <AdminButton type="button" disabled={busy} onClick={() => void save()}>
              {busy ? 'Saving…' : 'Save translation'}
            </AdminButton>
            <span className="text-[13px] text-smoke">
              {remaining === 0 ? 'Nothing left to translate.' : `${remaining} left.`}
            </span>
          </div>
        </div>
      )}
    </>
  );
}

/** One row: the original on the left, the box to type in on the right. */
function Pair({
  label,
  source,
  hint,
  children,
}: {
  label: string;
  source: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-3 border-b-2 border-hairline pb-4 last:border-b-0 md:grid-cols-2">
      <div>
        <p className="m-0 font-mono text-[10px] uppercase tracking-[0.12em] text-smoke">{label}</p>
        <p className="m-0 mt-1 whitespace-pre-wrap text-[14px] leading-relaxed text-ash">{source || '—'}</p>
      </div>
      <Field label="" hint={hint}>
        {children}
      </Field>
    </div>
  );
}
