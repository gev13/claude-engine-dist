'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { PageHeader } from '@/components/admin/PageHeader';
import { AdminButton, Alert, Panel, Spinner, Textarea } from '@/components/admin/ui';
import { useToast } from '@/components/admin/useToast';
import { api, fetcher } from '@/lib/admin/client';
import { CSS_MAX, cssWasChanged, type SiteCode } from '@/lib/customCode';
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

  async function save() {
    if (!form) return;
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
        <PageHeader title="Custom CSS" description="Site-wide CSS, loaded on every page." />
        <Spinner />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Custom CSS"
        description="CSS that loads on every page, after the theme."
        actions={
          canWrite && (
            <AdminButton type="button" onClick={() => void save()} disabled={busy || !dirty}>
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
          CSS cannot execute anything, so it is safe to write here. Tracking tags — Google Analytics, Tag Manager,
          the Meta Pixel and the rest — are under <Link href="/admin/integrations" className="text-flare-soft">Integrations</Link>,
          where you give the engine an id and it writes the vendor&rsquo;s own tag, held back until a visitor
          agrees if the cookie notice asks for consent. Arbitrary script is there too, switched off, for
          administrators only.
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

      </div>
    </>
  );
}
