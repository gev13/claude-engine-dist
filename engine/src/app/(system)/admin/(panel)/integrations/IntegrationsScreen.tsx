'use client';

import Link from 'next/link';
import { nanoid } from 'nanoid';
import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { PageHeader } from '@/components/admin/PageHeader';
import { AdminButton, Alert, Field, Input, Panel, Select, Spinner, Textarea } from '@/components/admin/ui';
import { useToast } from '@/components/admin/useToast';
import { api, fetcher } from '@/lib/admin/client';
import { CSP_ORIGIN } from '@/lib/csp';
import { CONSENT_CATEGORIES, PRESETS, PRESET_KEYS, type ConsentCategory, type Integrations, type PresetKey } from '@/lib/integrations';
import { errorMessage, useUnsavedWarning } from '../_shared';

/* ═══════════════════════════════════════════════════════════════════════════
   Settings → Integrations (T10, 2.16)
   ───────────────────────────────────────────────────────────────────────────
   Every tag is an id and a switch: the engine writes the vendor's own loader,
   adds its hosts to the site's content policy, and — when the cookie notice
   asks for consent — holds it back until its category is granted. Custom
   snippets are below, off until an administrator allows them.
   ═══════════════════════════════════════════════════════════════════════════ */

type Response = { integrations: Integrations };

const CATEGORY_LABELS: Record<ConsentCategory, string> = {
  necessary: 'Necessary — loads without asking',
  analytics: 'Analytics',
  marketing: 'Marketing',
  preferences: 'Preferences',
};

const lines = (value: string) => value.split(/[\n,]+/).map((line) => line.trim()).filter(Boolean);

export function IntegrationsScreen({ consentMode }: { consentMode: boolean }) {
  const { toast } = useToast();
  const { data, isLoading, mutate } = useSWR<Response>('/api/admin/integrations', fetcher);
  const [form, setForm] = useState<Integrations | null>(null);
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');

  useEffect(() => {
    if (!data) return;
    setForm(data.integrations);
    setSaved(JSON.stringify(data.integrations));
  }, [data]);

  const dirty = form !== null && JSON.stringify(form) !== saved;
  useUnsavedWarning(dirty);

  if (isLoading || !form) {
    return (
      <>
        <PageHeader title="Integrations" description="Tracking and marketing tags, and custom scripts." />
        <Spinner />
      </>
    );
  }

  const setItem = <K extends PresetKey>(key: K, patch: Partial<Integrations[K]>) =>
    setForm({ ...form, [key]: { ...form[key], ...patch } });

  const badIds = PRESET_KEYS.filter((key) => form[key].enabled && !PRESETS[key].id.test(form[key].id));
  const badOrigins = [
    ...PRESET_KEYS.flatMap((key) => form[key].extraOrigins),
    ...form.snippets.flatMap((snippet) => snippet.origins),
  ].filter((origin) => !CSP_ORIGIN.test(origin));

  async function save() {
    if (!form) return;
    setBusy(true);
    setProblem('');
    try {
      const result = await api<Response>('/api/admin/integrations', { method: 'PUT', json: { integrations: form } });
      setForm(result.integrations);
      setSaved(JSON.stringify(result.integrations));
      await mutate(result, { revalidate: false });
      toast('Saved. Every page and the site’s content policy have been updated.', 'success');
    } catch (caught) {
      const message = errorMessage(caught, 'The integrations could not be saved.');
      setProblem(message);
      toast(message, 'error');
    } finally {
      setBusy(false);
    }
  }

  const snippet = (index: number, patch: Partial<Integrations['snippets'][number]>) =>
    setForm({ ...form, snippets: form.snippets.map((item, i) => (i === index ? { ...item, ...patch } : item)) });

  return (
    <>
      <PageHeader
        title="Integrations"
        description="Tracking and marketing tags — an id each, and the engine writes the tag."
        actions={
          <AdminButton type="button" onClick={() => void save()} disabled={busy || !dirty || badIds.length > 0 || badOrigins.length > 0}>
            {busy ? 'Saving…' : 'Save'}
          </AdminButton>
        }
      />
      {problem && (
        <div className="mb-6">
          <Alert tone="error">{problem}</Alert>
        </div>
      )}

      <div className="mb-6">
        <Alert tone="info">
          {consentMode ? (
            <>
              The cookie notice asks for consent, so each tag waits until its category is granted — and a visitor who
              refuses gets none of them.
            </>
          ) : (
            <>
              The cookie notice is not asking for consent, so every tag switched on here loads on every visit. To
              hold them back until a visitor agrees, set the notice to{' '}
              <Link href="/admin/cookies" className="text-flare-soft">
                ask for consent
              </Link>
              .
            </>
          )}{' '}
          Each tag switched on is also added to the site&rsquo;s content policy and listed on the Security screen.
        </Alert>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Panel title="Google Consent Mode">
          <label className="flex items-start gap-2.5 text-[14px] text-ash">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 accent-flare"
              checked={form.consentMode}
              onChange={(e) => setForm({ ...form, consentMode: e.target.checked })}
            />
            <span>
              Use Consent Mode v2 for Google&rsquo;s tags: they load before consent with storage <em>denied</em> and
              send only cookieless pings, then switch to granted when a visitor agrees.
            </span>
          </label>
        </Panel>

        {PRESET_KEYS.map((key) => {
          const preset = PRESETS[key];
          const item = form[key];
          const wrong = item.enabled && !preset.id.test(item.id);
          return (
            <Panel key={key} title={preset.label}>
              <div className="flex flex-col gap-4">
                <label className="flex items-center gap-2.5 text-[14px] text-ash">
                  <input type="checkbox" className="h-4 w-4 accent-flare" checked={item.enabled} onChange={(e) => setItem(key, { enabled: e.target.checked })} />
                  Switched on
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Id" htmlFor={`int-${key}`} hint={`looks like ${preset.idHint}`} error={wrong ? `That does not look like a ${preset.label} id.` : undefined}>
                    <Input
                      id={`int-${key}`}
                      value={item.id}
                      spellCheck={false}
                      placeholder={preset.idHint}
                      onChange={(e) => setItem(key, { id: key === 'clarity' ? e.target.value.trim().toLowerCase() : e.target.value.trim().toUpperCase() })}
                    />
                  </Field>
                  <Field label="Consent category" htmlFor={`int-${key}-cat`}>
                    <Select id={`int-${key}-cat`} value={item.category} onChange={(e) => setItem(key, { category: e.target.value as ConsentCategory })}>
                      {CONSENT_CATEGORIES.map((category) => (
                        <option key={category} value={category}>
                          {CATEGORY_LABELS[category]}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>

                {key === 'gtm' && (
                  <label className="flex items-start gap-2.5 text-[13px] text-ash">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 accent-flare"
                      checked={form.gtm.noscript}
                      onChange={(e) => setItem('gtm', { noscript: e.target.checked })}
                    />
                    <span>Also the &lt;noscript&gt; frame for visitors without script — it cannot ask for consent.</span>
                  </label>
                )}

                {key === 'yandex' && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(['webvisor', 'clickmap', 'trackLinks', 'accurateTrackBounce'] as const).map((option) => (
                      <label key={option} className="flex items-center gap-2 text-[13px] text-ash">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-flare"
                          checked={form.yandex[option]}
                          onChange={(e) => setItem('yandex', { [option]: e.target.checked })}
                        />
                        {{ webvisor: 'Webvisor (session replay)', clickmap: 'Click map', trackLinks: 'Outbound links', accurateTrackBounce: 'Accurate bounce' }[option]}
                      </label>
                    ))}
                  </div>
                )}

                {key === 'googleAds' && (
                  <div className="flex flex-col gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-smoke">Conversions a form can send</span>
                    {form.googleAds.conversions.map((conversion, i) => (
                      <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                        <Input
                          value={conversion.name}
                          placeholder="Name, e.g. Contact form"
                          aria-label="Conversion name"
                          onChange={(e) => setItem('googleAds', { conversions: form.googleAds.conversions.map((c, j) => (j === i ? { ...c, name: e.target.value } : c)) })}
                        />
                        <Input
                          value={conversion.label}
                          placeholder="Conversion label"
                          aria-label="Conversion label"
                          spellCheck={false}
                          onChange={(e) => setItem('googleAds', { conversions: form.googleAds.conversions.map((c, j) => (j === i ? { ...c, label: e.target.value.trim() } : c)) })}
                        />
                        <AdminButton type="button" variant="ghost" onClick={() => setItem('googleAds', { conversions: form.googleAds.conversions.filter((_, j) => j !== i) })}>
                          ×
                        </AdminButton>
                      </div>
                    ))}
                    <div>
                      <AdminButton
                        type="button"
                        variant="ghost"
                        onClick={() => setItem('googleAds', { conversions: [...form.googleAds.conversions, { name: '', label: '' }] })}
                      >
                        + Add a conversion
                      </AdminButton>
                    </div>
                  </div>
                )}

                <Field label="More hosts it loads from" htmlFor={`int-${key}-origins`} hint="one per line, e.g. https://cdn.example.com — mostly for Tag Manager">
                  <Textarea
                    id={`int-${key}-origins`}
                    rows={2}
                    spellCheck={false}
                    value={item.extraOrigins.join('\n')}
                    onChange={(e) => setItem(key, { extraOrigins: lines(e.target.value) })}
                    className="font-mono text-[12px]"
                  />
                </Field>
              </div>
            </Panel>
          );
        })}
      </div>

      <div className="mt-6">
        <Panel title="Custom scripts">
          <div className="flex flex-col gap-4">
            <Alert tone="error">
              A custom script runs in every visitor&rsquo;s browser with the same rights as the site itself. Only paste
              code from a vendor you trust, and list every host it loads from — the content policy blocks anything
              else. These are listed on the Security screen.
            </Alert>
            <label className="flex items-center gap-2.5 text-[14px] text-ash">
              <input
                type="checkbox"
                className="h-4 w-4 accent-flare"
                checked={form.allowCustomScripts}
                onChange={(e) => setForm({ ...form, allowCustomScripts: e.target.checked })}
              />
              Allow custom scripts
            </label>

            {form.allowCustomScripts && (
              <>
                {form.snippets.map((item, index) => (
                  <div key={item.id} className="flex flex-col gap-3 border-2 border-hairline p-4">
                    <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
                      <Field label="Name">
                        <Input value={item.name} maxLength={80} onChange={(e) => snippet(index, { name: e.target.value })} />
                      </Field>
                      <Field label="Where">
                        <Select value={item.location} onChange={(e) => snippet(index, { location: e.target.value as typeof item.location })}>
                          <option value="head">In the head</option>
                          <option value="bodyStart">Start of the body</option>
                          <option value="bodyEnd">End of the body</option>
                        </Select>
                      </Field>
                      <Field label="Consent">
                        <Select value={item.category} onChange={(e) => snippet(index, { category: e.target.value as ConsentCategory })}>
                          {CONSENT_CATEGORIES.map((category) => (
                            <option key={category} value={category}>
                              {CATEGORY_LABELS[category]}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <label className="flex items-center gap-2 pb-2.5 text-[13px] text-ash">
                        <input type="checkbox" className="h-4 w-4 accent-flare" checked={item.enabled} onChange={(e) => snippet(index, { enabled: e.target.checked })} />
                        On
                      </label>
                    </div>
                    <Field label="Code" hint="script tags, a pixel — as the vendor gives it">
                      <Textarea
                        rows={6}
                        spellCheck={false}
                        value={item.code}
                        maxLength={20_000}
                        onChange={(e) => snippet(index, { code: e.target.value })}
                        className="font-mono text-[12px]"
                        aria-label={`Code for ${item.name}`}
                      />
                    </Field>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Pages" hint="empty for every page; /contact, /blog/* — one per line">
                        <Textarea rows={2} spellCheck={false} value={item.pages.join('\n')} onChange={(e) => snippet(index, { pages: lines(e.target.value) })} className="font-mono text-[12px]" />
                      </Field>
                      <Field label="Hosts it loads from" hint="added to the content policy — one per line">
                        <Textarea rows={2} spellCheck={false} value={item.origins.join('\n')} onChange={(e) => snippet(index, { origins: lines(e.target.value) })} className="font-mono text-[12px]" />
                      </Field>
                    </div>
                    <div>
                      <AdminButton type="button" variant="ghost" className="text-flare-soft" onClick={() => setForm({ ...form, snippets: form.snippets.filter((_, i) => i !== index) })}>
                        Remove this script
                      </AdminButton>
                    </div>
                  </div>
                ))}
                {form.snippets.length < 10 && (
                  <div>
                    <AdminButton
                      type="button"
                      variant="secondary"
                      onClick={() =>
                        setForm({
                          ...form,
                          snippets: [
                            ...form.snippets,
                            { id: nanoid(10), name: 'New script', enabled: false, location: 'head', code: '', pages: [], category: 'marketing', origins: [] },
                          ],
                        })
                      }
                    >
                      + Add a script
                    </AdminButton>
                  </div>
                )}
              </>
            )}
          </div>
        </Panel>
      </div>
    </>
  );
}
