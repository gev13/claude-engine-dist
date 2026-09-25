'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { PageHeader } from '@/components/admin/PageHeader';
import { AdminButton, Alert, Field, Input, Panel, Spinner, Textarea } from '@/components/admin/ui';
import { useToast } from '@/components/admin/useToast';
import { api, fetcher } from '@/lib/admin/client';
import { SIGNATURE_HEADER, TIMESTAMP_HEADER, WEBHOOK_EVENTS, WEBHOOK_EVENT_LABELS, WEBHOOK_URL, type Webhook } from '@/lib/webhooks';
import { errorMessage, useUnsavedWarning } from '../_shared';

/* ═══════════════════════════════════════════════════════════════════════════
   Enquiries → Webhooks (T13, 2.16)
   ───────────────────────────────────────────────────────────────────────────
   Up to ten receivers, each an https address, the events it wants and an
   optional signing secret. Below them, the last fifty deliveries — what was
   sent where, what came back — with a Resend for anything that failed.
   ═══════════════════════════════════════════════════════════════════════════ */

type Delivery = {
  id: string;
  webhookName: string;
  event: string;
  targetId: string | null;
  status: 'pending' | 'ok' | 'failed';
  attempts: number;
  responseCode: number | null;
  error: string | null;
  createdAt: string;
};

type Loaded = { hooks: Webhook[]; deliveries: Delivery[]; forms: string[] };

const MASK = '••••••••';

/** A random secret, made in the browser and shown once so it can be copied to the receiver. */
function newSecret(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return `whsec_${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}

const blank = (): Webhook => ({ id: crypto.randomUUID(), name: '', enabled: true, url: '', events: ['form.submitted'], forms: [], secret: '' });

const when = (value: string) => new Date(value).toLocaleString();

export function WebhooksScreen() {
  const { toast } = useToast();
  const { data, isLoading, mutate } = useSWR<Loaded>('/api/admin/webhooks', fetcher);
  const [hooks, setHooks] = useState<Webhook[] | null>(null);
  const [saved, setSaved] = useState('');
  const [shown, setShown] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState('');

  useEffect(() => {
    if (!data) return;
    setHooks(data.hooks);
    setSaved(JSON.stringify(data.hooks));
  }, [data]);

  const dirty = hooks !== null && JSON.stringify(hooks) !== saved;
  useUnsavedWarning(dirty);

  if (isLoading || !hooks || !data) {
    return (
      <>
        <PageHeader title="Webhooks" description="Send submissions on to a CRM, Zapier or Make." />
        <Spinner />
      </>
    );
  }

  const update = (index: number, patch: Partial<Webhook>) => setHooks(hooks.map((hook, i) => (i === index ? { ...hook, ...patch } : hook)));
  const invalid = hooks.some((hook) => !hook.name.trim() || !WEBHOOK_URL.test(hook.url) || hook.events.length === 0);
  const savedIds = new Set((JSON.parse(saved || '[]') as Webhook[]).map((hook) => hook.id));

  async function save() {
    if (!hooks) return;
    setBusy('save');
    try {
      const result = await api<{ hooks: Webhook[] }>('/api/admin/webhooks', { method: 'PUT', json: { hooks } });
      setHooks(result.hooks);
      setSaved(JSON.stringify(result.hooks));
      await mutate();
      toast('Webhooks saved.', 'success');
    } catch (error) {
      toast(errorMessage(error, 'The webhooks could not be saved.'), 'error');
    } finally {
      setBusy('');
    }
  }

  async function test(hook: Webhook) {
    setBusy(`test:${hook.id}`);
    try {
      const result = await api<{ ok: boolean; status?: number; error?: string }>('/api/admin/webhooks/test', { json: { id: hook.id } });
      toast(result.ok ? `Delivered — the receiver answered ${result.status}.` : `Not delivered: ${result.error}`, result.ok ? 'success' : 'error');
      await mutate();
    } catch (error) {
      toast(errorMessage(error, 'The test could not be sent.'), 'error');
    } finally {
      setBusy('');
    }
  }

  async function resend(id: string) {
    setBusy(`resend:${id}`);
    try {
      await api('/api/admin/webhooks/deliveries', { json: { id } });
      toast('Sending again. The log updates as it goes.', 'success');
      window.setTimeout(() => void mutate(), 1500);
    } catch (error) {
      toast(errorMessage(error, 'That could not be resent.'), 'error');
    } finally {
      setBusy('');
    }
  }

  return (
    <>
      <PageHeader
        title="Webhooks"
        description="Send each submission on to another system — a CRM, Zapier, Make — as signed JSON."
        actions={
          <AdminButton type="button" onClick={() => void save()} disabled={busy === 'save' || !dirty || invalid}>
            {busy === 'save' ? 'Saving…' : 'Save'}
          </AdminButton>
        }
      />

      <div className="mb-6">
        <Alert tone="info">
          Everything a visitor typed leaves the site through a webhook, so list only receivers you trust with it. Addresses must be https and on the public
          internet; the server refuses private and local ones, and does not follow redirects. Each delivery is tried three times — at once, after ten seconds
          and after a minute.
        </Alert>
      </div>

      <div className="flex flex-col gap-6">
        {hooks.map((hook, index) => {
          const badUrl = hook.url !== '' && !WEBHOOK_URL.test(hook.url);
          const secretShown = shown[hook.id];
          return (
            <Panel
              key={hook.id}
              title={hook.name || 'New webhook'}
              actions={
                <div className="flex gap-2">
                  <AdminButton
                    variant="ghost"
                    type="button"
                    disabled={!savedIds.has(hook.id) || dirty || busy !== ''}
                    title={dirty ? 'Save first' : undefined}
                    onClick={() => void test(hook)}
                  >
                    {busy === `test:${hook.id}` ? 'Sending…' : 'Send a test'}
                  </AdminButton>
                  <AdminButton variant="ghost" type="button" onClick={() => setHooks(hooks.filter((_, i) => i !== index))}>
                    Remove
                  </AdminButton>
                </div>
              }
            >
              <div className="flex flex-col gap-4">
                <label className="flex items-center gap-2.5 text-[14px] text-ash">
                  <input type="checkbox" className="h-4 w-4 accent-flare" checked={hook.enabled} onChange={(e) => update(index, { enabled: e.target.checked })} />
                  Switched on
                </label>
                <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
                  <Field label="Name" htmlFor={`wh-name-${hook.id}`}>
                    <Input id={`wh-name-${hook.id}`} value={hook.name} maxLength={80} placeholder="CRM" onChange={(e) => update(index, { name: e.target.value })} />
                  </Field>
                  <Field label="Address" htmlFor={`wh-url-${hook.id}`} error={badUrl ? 'An https:// address' : undefined}>
                    <Input
                      id={`wh-url-${hook.id}`}
                      value={hook.url}
                      maxLength={500}
                      spellCheck={false}
                      placeholder="https://hooks.zapier.com/…"
                      onChange={(e) => update(index, { url: e.target.value.trim() })}
                    />
                  </Field>
                </div>
                <fieldset className="m-0 border-0 p-0">
                  <legend className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-smoke">Send when</legend>
                  <div className="flex flex-wrap gap-4">
                    {WEBHOOK_EVENTS.map((event) => (
                      <label key={event} className="flex items-center gap-2 text-[14px] text-ash">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-flare"
                          checked={hook.events.includes(event)}
                          onChange={(e) => update(index, { events: e.target.checked ? [...hook.events, event] : hook.events.filter((x) => x !== event) })}
                        />
                        {WEBHOOK_EVENT_LABELS[event]}
                      </label>
                    ))}
                  </div>
                </fieldset>
                {hook.events.includes('form.submitted') && (
                  <Field label="Only these forms" hint={`form names, one per line; empty sends every form${data.forms.length ? ` — forms with submissions: ${data.forms.join(', ')}` : ''}`}>
                    <Textarea
                      rows={2}
                      value={hook.forms.join('\n')}
                      onChange={(e) => update(index, { forms: e.target.value.split('\n').map((line) => line.trim()).filter(Boolean).slice(0, 50) })}
                    />
                  </Field>
                )}
                <Field
                  label="Signing secret"
                  htmlFor={`wh-secret-${hook.id}`}
                  hint={`optional — signs each request (${SIGNATURE_HEADER}); kept encrypted and never shown again once saved`}
                >
                  <div className="flex gap-2">
                    <Input
                      id={`wh-secret-${hook.id}`}
                      type={secretShown ? 'text' : 'password'}
                      autoComplete="new-password"
                      spellCheck={false}
                      value={hook.secret}
                      onFocus={() => hook.secret === MASK && update(index, { secret: '' })}
                      onChange={(e) => update(index, { secret: e.target.value })}
                    />
                    <AdminButton
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        const secret = newSecret();
                        update(index, { secret });
                        setShown({ ...shown, [hook.id]: secret });
                      }}
                    >
                      Generate
                    </AdminButton>
                  </div>
                </Field>
                {secretShown && hook.secret === secretShown && (
                  <p className="m-0 text-[13px] text-smoke">Copy it into the receiver now — after saving it is kept encrypted and not shown again.</p>
                )}
              </div>
            </Panel>
          );
        })}

        {hooks.length < 10 && (
          <div>
            <AdminButton type="button" variant="secondary" onClick={() => setHooks([...hooks, blank()])}>
              Add a webhook
            </AdminButton>
          </div>
        )}

        <Panel title="Checking the signature">
          <p className="m-0 text-[13px] leading-relaxed text-ash">
            Each request carries <code>{TIMESTAMP_HEADER}</code> (seconds) and, when a secret is set, <code>{SIGNATURE_HEADER}</code>:{' '}
            <code>sha256=</code> and the hex HMAC-SHA256 of the timestamp, a full stop and the raw body, keyed with the secret. Compare in constant time, and
            refuse a timestamp more than five minutes old so a captured request cannot be replayed.
          </p>
        </Panel>

        <Panel title="Recent deliveries" actions={<span className="font-mono text-[10px] uppercase tracking-[0.12em] text-smoke">last 50 · kept 30 days</span>}>
          {data.deliveries.length === 0 ? (
            <p className="m-0 text-[13px] text-smoke">Nothing has been sent yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left text-[13px]">
                <thead>
                  <tr className="font-mono text-[10px] uppercase tracking-[0.12em] text-smoke">
                    <th className="py-2 pr-3 font-normal">When</th>
                    <th className="py-2 pr-3 font-normal">Webhook</th>
                    <th className="py-2 pr-3 font-normal">Event</th>
                    <th className="py-2 pr-3 font-normal">Result</th>
                    <th className="py-2 font-normal" />
                  </tr>
                </thead>
                <tbody>
                  {data.deliveries.map((delivery) => (
                    <tr key={delivery.id} className="border-t border-hairline align-top">
                      <td className="py-2 pr-3 whitespace-nowrap text-ash">{when(delivery.createdAt)}</td>
                      <td className="py-2 pr-3 text-bone">{delivery.webhookName}</td>
                      <td className="py-2 pr-3 font-mono text-[12px] text-ash">{delivery.event}</td>
                      <td className="py-2 pr-3">
                        <span className={delivery.status === 'ok' ? 'text-bone' : delivery.status === 'failed' ? 'text-flare-soft' : 'text-smoke'}>
                          {delivery.status === 'ok' ? `Delivered (${delivery.responseCode})` : delivery.status === 'failed' ? 'Failed' : 'Trying…'}
                        </span>
                        <span className="text-smoke"> · {delivery.attempts} attempt{delivery.attempts === 1 ? '' : 's'}</span>
                        {delivery.error && <span className="block text-smoke">{delivery.error}</span>}
                      </td>
                      <td className="py-2 text-right">
                        {delivery.status !== 'ok' && delivery.targetId && (
                          <AdminButton variant="ghost" type="button" disabled={busy !== ''} onClick={() => void resend(delivery.id)}>
                            {busy === `resend:${delivery.id}` ? 'Sending…' : 'Resend'}
                          </AdminButton>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
