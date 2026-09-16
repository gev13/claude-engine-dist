'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { PageHeader } from '@/components/admin/PageHeader';
import { AdminButton, Alert, Field, Input, Panel, Select, Spinner, Textarea } from '@/components/admin/ui';
import { useToast } from '@/components/admin/useToast';
import { api, fetcher } from '@/lib/admin/client';
import { COOKIE_POSITIONS, COOKIE_POSITION_LABELS, type CookieNotice } from '@/lib/cookies';
import { errorMessage, useUnsavedWarning } from '../_shared';

/* ═══════════════════════════════════════════════════════════════════════════
   The cookie notice screen
   ───────────────────────────────────────────────────────────────────────────
   The hard part of this screen is not the fields, it is telling the truth
   about what they do. This engine sets no tracking cookies and loads no
   third-party scripts, so "Reject" cannot switch anything off here — it
   records an answer that a site owner's own code can read.

   An editor who is not told that will assume the banner is doing compliance
   work it is not doing. So the screen says it, once, in plain words, at the
   top.
   ═══════════════════════════════════════════════════════════════════════════ */

type Response = { notice: CookieNotice };

export function CookiesScreen({ canWrite }: { canWrite: boolean }) {
  const { toast } = useToast();
  const { data, isLoading, mutate } = useSWR<Response>('/api/admin/cookies', fetcher);

  const [form, setForm] = useState<CookieNotice | null>(null);
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');

  useEffect(() => {
    if (!data) return;
    setForm(data.notice);
    setSaved(JSON.stringify(data.notice));
  }, [data]);

  const dirty = form !== null && JSON.stringify(form) !== saved;
  useUnsavedWarning(dirty);

  const set = <K extends keyof CookieNotice>(key: K, value: CookieNotice[K]) =>
    setForm((current) => (current ? { ...current, [key]: value } : current));

  async function save() {
    if (!form) return;
    setBusy(true);
    setProblem('');
    try {
      const result = await api<Response>('/api/admin/cookies', { method: 'PUT', json: { notice: form } });
      setForm(result.notice);
      setSaved(JSON.stringify(result.notice));
      await mutate(result, { revalidate: false });
      toast('Saved. Every page has been revalidated.', 'success');
    } catch (caught) {
      const message = errorMessage(caught, 'The notice could not be saved.');
      setProblem(message);
      toast(message, 'error');
    } finally {
      setBusy(false);
    }
  }

  if (isLoading || !form) {
    return (
      <>
        <PageHeader title="Cookie notice" description="The banner visitors see on their first visit." />
        <Spinner />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Cookie notice"
        description="The banner visitors see on their first visit, and the answer it records."
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
          This engine sets no tracking cookies and loads no third-party scripts, and its video and map embeds
          already wait for a click — so there is nothing here for &ldquo;Reject&rdquo; to switch off. What the
          notice does is <strong>record the answer</strong>: it is written to the visitor&rsquo;s browser and
          stamped on the page as <code className="font-mono text-flare-soft">data-consent</code>, so anything you
          add later — an analytics tag, a pixel — can read it before it runs. Nothing is stored until somebody
          answers.
        </Alert>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Panel title="What it says">
          <div className="flex flex-col gap-5">
            <label className="flex items-center gap-2.5 text-[14px] text-ash">
              <input
                type="checkbox"
                className="h-4 w-4 accent-flare"
                checked={form.enabled}
                disabled={!canWrite}
                onChange={(e) => set('enabled', e.target.checked)}
              />
              Show the notice
            </label>

            <Field label="Heading" htmlFor="cookie-title">
              <Input
                id="cookie-title"
                value={form.title}
                disabled={!canWrite}
                onChange={(e) => set('title', e.target.value)}
              />
            </Field>

            <Field
              label="Wording"
              htmlFor="cookie-body"
              hint="what this site actually stores — a legal statement, so it is yours to write"
            >
              <Textarea
                id="cookie-body"
                rows={4}
                value={form.body}
                disabled={!canWrite}
                onChange={(e) => set('body', e.target.value)}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Policy link" htmlFor="cookie-href" hint="a site path, e.g. /privacy">
                <Input
                  id="cookie-href"
                  value={form.policyHref}
                  placeholder="/privacy"
                  disabled={!canWrite}
                  onChange={(e) => set('policyHref', e.target.value)}
                />
              </Field>
              <Field label="Link text" htmlFor="cookie-label">
                <Input
                  id="cookie-label"
                  value={form.policyLabel}
                  disabled={!canWrite}
                  onChange={(e) => set('policyLabel', e.target.value)}
                />
              </Field>
            </div>
          </div>
        </Panel>

        <Panel title="The buttons, and where it sits">
          <div className="flex flex-col gap-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Accept button" htmlFor="cookie-accept">
                <Input
                  id="cookie-accept"
                  value={form.acceptLabel}
                  disabled={!canWrite}
                  onChange={(e) => set('acceptLabel', e.target.value)}
                />
              </Field>
              <Field label="Reject button" htmlFor="cookie-reject">
                <Input
                  id="cookie-reject"
                  value={form.rejectLabel}
                  disabled={!canWrite || !form.showReject}
                  onChange={(e) => set('rejectLabel', e.target.value)}
                />
              </Field>
            </div>

            <div>
              <label className="flex items-center gap-2.5 text-[14px] text-ash">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-flare"
                  checked={form.showReject}
                  disabled={!canWrite}
                  onChange={(e) => set('showReject', e.target.checked)}
                />
                Offer a Reject button
              </label>
              <p className="m-0 mt-2 text-[12px] leading-relaxed text-smoke">
                {form.showReject
                  ? 'Both answers are recorded, and either one closes the notice for good.'
                  : 'One button only. Reasonable for a site that genuinely sets nothing optional — then the notice is an acknowledgement, and a Reject that changed nothing would be dishonest.'}
              </p>
            </div>

            <Field label="Position" htmlFor="cookie-position">
              <Select
                id="cookie-position"
                value={form.position}
                disabled={!canWrite}
                onChange={(e) => set('position', e.target.value as CookieNotice['position'])}
              >
                {COOKIE_POSITIONS.map((position) => (
                  <option key={position} value={position}>
                    {COOKIE_POSITION_LABELS[position]}
                  </option>
                ))}
              </Select>
              <p className="m-0 mt-2 text-[12px] leading-relaxed text-smoke">
                {form.position === 'centre'
                  ? 'Centred dims the page and has to be answered before anything else can be clicked.'
                  : 'A bar or a corner card leaves the page usable behind it.'}
              </p>
            </Field>

            <div>
              <label className="flex items-center gap-2.5 text-[14px] text-ash">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-flare"
                  checked={form.respectDoNotTrack}
                  disabled={!canWrite}
                  onChange={(e) => set('respectDoNotTrack', e.target.checked)}
                />
                Treat &ldquo;Do Not Track&rdquo; as a rejection
              </label>
              <p className="m-0 mt-2 text-[12px] leading-relaxed text-smoke">
                A browser that sends the header is never asked. Off by default because the signal is unreliable and
                widely ignored — but a site that means it should be able to honour it.
              </p>
            </div>
          </div>
        </Panel>
      </div>

      <div className="mt-6">
        <Panel title="Letting somebody change their mind">
          <p className="m-0 max-w-[70ch] text-[14px] leading-relaxed text-ash">
            A link to <code className="font-mono text-flare-soft">#cookie-settings</code> anywhere on the site
            reopens the notice — add one to the footer menu under Menus, labelled &ldquo;Cookie settings&rdquo;.
            Somebody who answered a year ago can then answer differently, which is the part most sites forget.
          </p>
        </Panel>
      </div>
    </>
  );
}
