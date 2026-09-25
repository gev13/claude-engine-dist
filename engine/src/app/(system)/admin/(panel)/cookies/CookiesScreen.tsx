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

type Response = { notice: CookieNotice; stats?: Record<'accepted' | 'rejected' | 'custom', number> };

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
          {form.mode === 'consent' ? (
            <>
              This is a <strong>consent manager</strong>: every tag switched on under Integrations waits until its
              category is granted, &ldquo;Reject all&rdquo; is as easy as &ldquo;Accept all&rdquo;, and a visitor can
              change their mind from any link to <code className="font-mono text-flare-soft">#cookie-settings</code>.
              With Google Consent Mode on, Google&rsquo;s tags send only cookieless pings until somebody agrees.
            </>
          ) : (
            <>
              On its own the engine sets no tracking cookies, and its video and map embeds already wait for a click.
              As a <strong>notice</strong> it records the answer — in the visitor&rsquo;s browser and as{' '}
              <code className="font-mono text-flare-soft">data-consent</code> on the page — and switches nothing off.
              If you switch on tags under Integrations, set it to ask for consent below.
            </>
          )}{' '}
          Nothing is stored until somebody answers.
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
        <Panel title="Consent">
          <div className="flex flex-col gap-5">
            <Field
              label="What the notice does"
              htmlFor="cookie-mode"
              hint={
                form.mode === 'consent'
                  ? 'Tags under Integrations wait for their category; Reject all leaves only what is necessary.'
                  : 'The answer is recorded; nothing is switched off by it.'
              }
            >
              <Select id="cookie-mode" value={form.mode} disabled={!canWrite} onChange={(e) => set('mode', e.target.value as CookieNotice['mode'])}>
                <option value="notice">A notice — record the answer</option>
                <option value="consent">Ask for consent — categories, and nothing optional until agreed</option>
              </Select>
            </Field>

            {form.mode === 'consent' && (
              <>
                <div className="grid gap-4 lg:grid-cols-2">
                  <Field label={`“${form.categories.necessary.title}” — always on`} htmlFor="cat-necessary">
                    <Textarea
                      id="cat-necessary"
                      rows={2}
                      value={form.categories.necessary.description}
                      disabled={!canWrite}
                      onChange={(e) => set('categories', { ...form.categories, necessary: { ...form.categories.necessary, description: e.target.value } })}
                    />
                  </Field>
                  {(['analytics', 'marketing', 'preferences'] as const).map((key) => (
                    <div key={key} className="flex flex-col gap-2 border-2 border-hairline p-3">
                      <label className="flex items-center gap-2 text-[14px] text-ash">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-flare"
                          checked={form.categories[key].enabled}
                          disabled={!canWrite}
                          onChange={(e) => set('categories', { ...form.categories, [key]: { ...form.categories[key], enabled: e.target.checked } })}
                        />
                        Offer this category
                      </label>
                      <Input
                        value={form.categories[key].title}
                        disabled={!canWrite}
                        aria-label={`${key} title`}
                        onChange={(e) => set('categories', { ...form.categories, [key]: { ...form.categories[key], title: e.target.value } })}
                      />
                      <Textarea
                        rows={2}
                        value={form.categories[key].description}
                        disabled={!canWrite}
                        aria-label={`${key} description`}
                        onChange={(e) => set('categories', { ...form.categories, [key]: { ...form.categories[key], description: e.target.value } })}
                      />
                    </div>
                  ))}
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Preferences button" htmlFor="cookie-prefs">
                    <Input id="cookie-prefs" value={form.preferencesLabel} disabled={!canWrite} onChange={(e) => set('preferencesLabel', e.target.value)} />
                  </Field>
                  <Field label="Save button" htmlFor="cookie-save">
                    <Input id="cookie-save" value={form.saveLabel} disabled={!canWrite} onChange={(e) => set('saveLabel', e.target.value)} />
                  </Field>
                  <Field label="Keep an answer for" htmlFor="cookie-months" hint="months, then ask again">
                    <Input
                      id="cookie-months"
                      type="number"
                      min={1}
                      max={24}
                      value={form.months}
                      disabled={!canWrite}
                      onChange={(e) => set('months', Math.min(24, Math.max(1, Math.round(Number(e.target.value) || 12))))}
                    />
                  </Field>
                </div>

                <Field
                  label="Who is asked"
                  htmlFor="cookie-region"
                  hint="by the country header a CDN in front of the site sends — without one, everybody is asked"
                >
                  <Select id="cookie-region" value={form.region} disabled={!canWrite} onChange={(e) => set('region', e.target.value as CookieNotice['region'])}>
                    <option value="everyone">Everybody</option>
                    <option value="required">Only where consent is required — the EU, the EEA, the UK and Switzerland</option>
                  </Select>
                </Field>

                <label className="flex items-center gap-2.5 text-[14px] text-ash">
                  <input type="checkbox" className="h-4 w-4 accent-flare" checked={form.log} disabled={!canWrite} onChange={(e) => set('log', e.target.checked)} />
                  Count the answers — accepted, rejected, chosen — per day, with nothing about who
                </label>
                {form.log && data?.stats && (
                  <p className="m-0 font-mono text-[12px] text-smoke">
                    Last 30 days: {data.stats.accepted} accepted · {data.stats.rejected} rejected · {data.stats.custom} chose
                  </p>
                )}

                {canWrite && (
                  <div>
                    <AdminButton
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        if (window.confirm('Ask every visitor again? Their answers stop counting when this is saved.')) set('version', form.version + 1);
                      }}
                    >
                      Ask everyone again
                    </AdminButton>
                    <p className="m-0 mt-2 text-[12px] leading-relaxed text-smoke">
                      For when what the site does with cookies has changed. Offering a different set of categories asks
                      again by itself.
                    </p>
                  </div>
                )}
              </>
            )}
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
