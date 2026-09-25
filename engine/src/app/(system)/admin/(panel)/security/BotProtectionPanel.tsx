'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { AdminButton, Field, Input, Panel, Select, Spinner } from '@/components/admin/ui';
import { useToast } from '@/components/admin/useToast';
import { api, fetcher } from '@/lib/admin/client';
import {
  CAPTCHA_LABELS,
  CAPTCHA_PROVIDERS,
  CAPTCHA_SURFACES,
  CAPTCHA_SURFACE_LABELS,
  CAPTCHA_TEST_KEYS,
  type CaptchaProvider,
  type CaptchaSettings,
} from '@/lib/captcha';
import { errorMessage } from '../_shared';

/* ═══════════════════════════════════════════════════════════════════════════
   Security → Bot protection (T12, 2.16)
   ───────────────────────────────────────────────────────────────────────────
   The provider, its two keys, and which forms it guards. The secret is typed
   in and never shown again — the field says whether one is held. Below it,
   every third party the public site talks to, because a challenge widget is
   one more of them and the list is the honest place to say so.
   ═══════════════════════════════════════════════════════════════════════════ */

type Loaded = { captcha: CaptchaSettings; secretSet: boolean; secretUnreadable?: boolean; thirdParties: { name: string; hosts: string[] }[] };

const MASK = '••••••••';

export function BotProtectionPanel() {
  const { toast } = useToast();
  const { data, isLoading, mutate } = useSWR<Loaded>('/api/admin/captcha', fetcher);
  const [form, setForm] = useState<CaptchaSettings | null>(null);
  const [secret, setSecret] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data) setForm(data.captcha);
  }, [data]);

  if (isLoading || !form || !data) return <Spinner label="Loading bot protection" />;

  const on = form.provider !== 'none';
  const testKeys = on ? CAPTCHA_TEST_KEYS[form.provider as Exclude<CaptchaProvider, 'none'>] : undefined;
  const missing = on && (!form.siteKey || (!data.secretSet && !secret));

  async function save() {
    if (!form) return;
    setBusy(true);
    try {
      const result = await api<Loaded>('/api/admin/captcha', { method: 'PUT', json: { captcha: form, ...(secret !== undefined ? { secret } : {}) } });
      setSecret(undefined);
      await mutate(result, { revalidate: false });
      toast('Bot protection saved. Every page has been updated.', 'success');
    } catch (error) {
      toast(errorMessage(error, 'Bot protection could not be saved.'), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Panel
        title="Bot protection"
        actions={
          <AdminButton variant="ghost" disabled={busy} onClick={() => void save()}>
            {busy ? 'Saving…' : 'Save'}
          </AdminButton>
        }
      >
        <div className="flex flex-col gap-5">
          <p className="m-0 text-[13px] leading-relaxed text-smoke">
            Every public form already has a hidden trap for bots and a rate limit. A challenge adds a check in front of them — and loads the provider’s script on
            pages with a form, which is one more third party.
          </p>
          <Field label="Provider" htmlFor="captcha-provider">
            <Select id="captcha-provider" value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value as CaptchaProvider })}>
              {CAPTCHA_PROVIDERS.map((provider) => (
                <option key={provider} value={provider}>
                  {CAPTCHA_LABELS[provider]}
                </option>
              ))}
            </Select>
          </Field>
          {on && (
            <>
              <Field label="Site key" htmlFor="captcha-site" hint="public — it is written into the page">
                <Input id="captcha-site" value={form.siteKey} autoComplete="off" onChange={(e) => setForm({ ...form, siteKey: e.target.value.trim() })} />
              </Field>
              <Field label="Secret key" htmlFor="captcha-secret" hint={data.secretSet ? 'one is saved; type a new one to replace it, or clear the field to remove it' : 'kept encrypted on the server, never shown again'}>
                <Input
                  id="captcha-secret"
                  type="password"
                  autoComplete="new-password"
                  value={secret ?? (data.secretSet ? MASK : '')}
                  onFocus={() => secret === undefined && data.secretSet && setSecret('')}
                  onChange={(e) => setSecret(e.target.value)}
                />
              </Field>
              {testKeys && (
                <p className="m-0 text-[13px] leading-relaxed text-smoke">
                  Trying it before the real keys arrive?{' '}
                  <button
                    type="button"
                    className="text-flare-soft underline hover:text-bone"
                    onClick={() => {
                      setForm({ ...form, siteKey: testKeys.siteKey });
                      setSecret(testKeys.secret);
                    }}
                  >
                    Use the provider’s test keys
                  </button>{' '}
                  — they always pass, so switch to real ones before relying on it.
                </p>
              )}
              {form.provider === 'recaptchaV3' && (
                <Field label="Refuse a score below" htmlFor="captcha-threshold" hint="0.1 lets nearly everything through, 0.9 refuses anything doubtful">
                  <Input
                    id="captcha-threshold"
                    type="number"
                    min={0.1}
                    max={0.9}
                    step={0.1}
                    value={form.threshold}
                    onChange={(e) => setForm({ ...form, threshold: Math.min(0.9, Math.max(0.1, Number(e.target.value) || 0.5)) })}
                  />
                </Field>
              )}
              <fieldset className="m-0 border-0 p-0">
                <legend className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-smoke">Protect</legend>
                <div className="flex flex-col gap-2">
                  {CAPTCHA_SURFACES.map((surface) => (
                    <label key={surface} className="flex items-center gap-2 text-[14px] text-ash">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-flare"
                        checked={form.surfaces[surface]}
                        disabled={surface === 'login' || surface === 'reset'}
                        onChange={(e) => setForm({ ...form, surfaces: { ...form.surfaces, [surface]: e.target.checked } })}
                      />
                      {CAPTCHA_SURFACE_LABELS[surface]}
                      {(surface === 'login' || surface === 'reset') && <span className="text-smoke">— not yet</span>}
                    </label>
                  ))}
                </div>
                <p className="mt-2 mb-0 text-[13px] text-smoke">A form block can override this in its own settings.</p>
              </fieldset>
              <label className="flex items-start gap-2 text-[14px] text-ash">
                <input type="checkbox" className="mt-1 h-4 w-4 accent-flare" checked={form.failClosed} onChange={(e) => setForm({ ...form, failClosed: e.target.checked })} />
                <span>
                  Refuse submissions when the provider cannot be reached
                  <span className="block text-[13px] text-smoke">Off: an outage at the provider lets forms through on the trap and rate limit alone, rather than silencing every form.</span>
                </span>
              </label>
              {missing && <p className="m-0 text-[13px] text-flare-soft">Both keys are needed before anything is protected.</p>}
              {data.secretUnreadable && !secret && (
                <p className="m-0 text-[13px] text-flare-soft">
                  The saved secret key can no longer be read — the server’s encryption key has changed. Enter it again; until then submissions are not checked.
                </p>
              )}
            </>
          )}
        </div>
      </Panel>

      <Panel title="Third parties on the public site">
        {data.thirdParties.length === 0 ? (
          <p className="m-0 text-[13px] leading-relaxed text-smoke">
            None. Pages load nothing from another company’s servers until somebody presses play on a video or opens a map.
          </p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {data.thirdParties.map((party) => (
              <li key={party.name}>
                <p className="m-0 text-[14px] text-bone">{party.name}</p>
                <p className="m-0 break-all font-mono text-[11px] text-smoke">{party.hosts.join(' · ') || '—'}</p>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 mb-0 text-[13px] text-smoke">
          The site’s content policy allows exactly these hosts. Tags are managed under <Link href="/admin/integrations" className="text-flare-soft underline">Integrations</Link>.
        </p>
      </Panel>
    </>
  );
}
