'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { PageHeader } from '@/components/admin/PageHeader';
import { AdminButton, Alert, Field, Input, Panel, Spinner, Textarea } from '@/components/admin/ui';
import { useToast } from '@/components/admin/useToast';
import { api, fetcher } from '@/lib/admin/client';
import { ANALYTICS_PATTERN, CSS_MAX, cssWasChanged, type SiteCode } from '@/lib/customCode';
import { errorMessage, useUnsavedWarning } from '../_shared';

/* ═══════════════════════════════════════════════════════════════════════════
   Custom code
   ───────────────────────────────────────────────────────────────────────────
   Two fields, and the shape of the screen is the argument for why it is two
   fields rather than a snippet box: CSS, which cannot execute anything, and a
   measurement id, which the engine writes the tag around itself.

   Anybody arriving here expecting to paste a `<script>` needs to be told why
   they cannot, once, in plain words — otherwise the screen reads as missing a
   feature rather than declining one.
   ═══════════════════════════════════════════════════════════════════════════ */

type Response = { code: SiteCode };

export function CodeScreen({ canWrite }: { canWrite: boolean }) {
  const { toast } = useToast();
  const { data, isLoading, mutate } = useSWR<Response>('/api/admin/code', fetcher);

  const [form, setForm] = useState<SiteCode | null>(null);
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');

  useEffect(() => {
    if (!data) return;
    setForm(data.code);
    setSaved(JSON.stringify(data.code));
  }, [data]);

  const dirty = form !== null && JSON.stringify(form) !== saved;
  useUnsavedWarning(dirty);

  const set = <K extends keyof SiteCode>(key: K, value: SiteCode[K]) =>
    setForm((current) => (current ? { ...current, [key]: value } : current));

  /* Checked as you type as well as on the server, because a typo here means
     no analytics at all and nothing on the page says so. */
  const idProblem =
    form && form.analyticsId !== '' && !ANALYTICS_PATTERN.test(form.analyticsId)
      ? 'A GA4 measurement id looks like G-XXXXXXXXXX.'
      : '';

  async function save() {
    if (!form || idProblem) return;
    setBusy(true);
    setProblem('');
    try {
      const result = await api<Response>('/api/admin/code', { method: 'PUT', json: { code: form } });
      setForm(result.code);
      setSaved(JSON.stringify(result.code));
      await mutate(result, { revalidate: false });
      toast('Saved. Every page has been revalidated.', 'success');
    } catch (caught) {
      const message = errorMessage(caught, 'The code could not be saved.');
      setProblem(message);
      toast(message, 'error');
    } finally {
      setBusy(false);
    }
  }

  if (isLoading || !form) {
    return (
      <>
        <PageHeader title="Custom code" description="Site-wide CSS, and the analytics tag." />
        <Spinner />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Custom code"
        description="CSS that loads on every page, and the analytics tag."
        actions={
          canWrite && (
            <AdminButton type="button" onClick={() => void save()} disabled={busy || !dirty || Boolean(idProblem)}>
              {busy ? 'Saving…' : 'Save'}
            </AdminButton>
          )
        }
      />

      {problem && (
        <div className="mb-6">
          <Alert tone="error">{problem}</Alert>
        </div>
      )}

      <div className="mb-6">
        <Alert tone="info">
          There is no box here for pasting a <code className="font-mono text-flare-soft">&lt;script&gt;</code>, on
          purpose: a field that accepts JavaScript lets anyone who can sign in run code in every visitor&rsquo;s
          browser. The two things people normally want a snippet for are here instead — <strong>CSS</strong>, which
          cannot execute anything, and <strong>analytics</strong>, where you give the engine a measurement id and it
          writes the tag itself. Anything else needs a change to the code, which is a review.
        </Alert>
      </div>

      <div className="grid items-start gap-6">
        <Panel title="CSS">
          <div className="grid gap-3">
            <Textarea
              value={form.css}
              disabled={!canWrite}
              rows={18}
              spellCheck={false}
              aria-label="Site-wide custom CSS"
              placeholder={':root {\n  --he-accent: #d94f2b;\n}\n\n.my-class {\n  letter-spacing: 0.02em;\n}'}
              className="font-mono text-[12px] leading-relaxed"
              onChange={(e) => set('css', e.target.value.slice(0, CSS_MAX))}
            />
            <p className="m-0 text-[12px] leading-relaxed text-ash">
              Loaded on every page of the site, after the theme — so it overrides Appearance rather than fighting it.
              To aim at one section, give that block a name in its Design tab under{' '}
              <span className="text-smoke">CSS class</span>. For one page only, use the Custom CSS panel in that
              page&rsquo;s own editor.
            </p>
            <p className="m-0 text-[12px] leading-relaxed text-smoke">
              {form.css.length.toLocaleString('en-GB')} of {CSS_MAX.toLocaleString('en-GB')} characters.
            </p>
            {cssWasChanged(form.css) && (
              <Alert tone="info">
                <code className="font-mono">@import</code> and anything that could close the style element are
                removed when this is saved — an import would be refused by the site&rsquo;s content policy anyway.
                The rest of your CSS is kept.
              </Alert>
            )}
          </div>
        </Panel>

        <Panel title="Analytics">
          <div className="grid max-w-md gap-3">
            <Field
              label="Google Analytics 4 measurement id"
              htmlFor="analytics-id"
              hint="leave empty for no analytics at all"
              error={idProblem}
            >
              <Input
                id="analytics-id"
                value={form.analyticsId}
                disabled={!canWrite}
                spellCheck={false}
                placeholder="G-XXXXXXXXXX"
                onChange={(e) => set('analyticsId', e.target.value.trim().toUpperCase())}
              />
            </Field>
            <p className="m-0 text-[12px] leading-relaxed text-ash">
              With an id here the site loads <code className="font-mono">/analytics.js</code> from its own address
              and that starts Google&rsquo;s tag. With the field empty nothing is loaded and nothing is sent to
              Google. The cookie notice records an answer on{' '}
              <code className="font-mono text-flare-soft">data-consent</code> — this tag does not read it yet, so if
              your site needs consent before measuring, say so there.
            </p>
          </div>
        </Panel>
      </div>
    </>
  );
}
