'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { PageHeader } from '@/components/admin/PageHeader';
import { AdminButton, Alert, Field, Input, Panel, Select, Spinner } from '@/components/admin/ui';
import { ToastProvider, useToast } from '@/components/admin/useToast';
import { api, fetcher } from '@/lib/admin/client';
import { MAIL_DEFAULTS, type MailSettings } from '@/lib/mail';
import { errorMessage } from '../_shared';

/* ═══════════════════════════════════════════════════════════════════════════
   Email settings (package 5)
   ───────────────────────────────────────────────────────────────────────────
   The password is write-only: the server never sends it back, so the field is
   empty with a note when one is stored. Leaving it empty keeps what is there;
   "Forget it" clears it.
   ═══════════════════════════════════════════════════════════════════════════ */

type Editable = Omit<MailSettings, 'password'>;
type Loaded = { mail: Editable & { passwordSet: boolean }; problem: string | null };

const BLANK: Editable = (() => {
  const { password, ...rest } = MAIL_DEFAULTS;
  void password;
  return rest;
})();

export function EmailScreen({ canWrite }: { canWrite: boolean }) {
  return (
    <ToastProvider>
      <EmailScreenInner canWrite={canWrite} />
    </ToastProvider>
  );
}

function EmailScreenInner({ canWrite }: { canWrite: boolean }) {
  const { toast } = useToast();
  const { data, isLoading, mutate } = useSWR<Loaded>('/api/admin/email', fetcher);

  const [form, setForm] = useState<Editable>(BLANK);
  const [passwordSet, setPasswordSet] = useState(false);
  const [password, setPassword] = useState('');
  const [clearPassword, setClearPassword] = useState(false);
  const [recipients, setRecipients] = useState('');
  const [testTo, setTestTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  // Adopt whatever the server holds, once it arrives and after each save.
  useEffect(() => {
    if (!data) return;
    const { passwordSet: held, ...rest } = data.mail;
    setForm(rest);
    setPasswordSet(held);
    setRecipients(rest.notifyEmails.join(', '));
    setProblem(data.problem);
  }, [data]);

  const set = <K extends keyof Editable>(key: K, value: Editable[K]) => setForm((current) => ({ ...current, [key]: value }));
  const setEvent = (key: keyof Editable['events'], value: boolean) =>
    setForm((current) => ({ ...current, events: { ...current.events, [key]: value } }));

  async function save() {
    setBusy(true);
    try {
      const notifyEmails = recipients
        .split(',')
        .map((address) => address.trim())
        .filter(Boolean);
      const mail = {
        ...form,
        notifyEmails,
        ...(clearPassword ? { password: '' } : password ? { password } : {}),
      };
      await api('/api/admin/email', { method: 'PUT', json: { mail } });
      setPassword('');
      setClearPassword(false);
      await mutate();
      toast('Email settings saved.', 'success');
    } catch (error) {
      toast(errorMessage(error, 'Those settings could not be saved.'), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setTesting(true);
    try {
      const result = await api<{ to: string }>('/api/admin/email', { json: testTo.trim() ? { to: testTo.trim() } : {} });
      toast(`Test message sent to ${result.to}.`, 'success');
    } catch (error) {
      toast(errorMessage(error, 'The test message could not be sent.'), 'error');
    } finally {
      setTesting(false);
    }
  }

  if (isLoading) return <Spinner label="Loading email settings" />;

  return (
    <>
      <PageHeader
        title="Email"
        description="The mail server the engine sends through, and which messages it sends. Nothing is sent until this is switched on and a test arrives."
        actions={
          canWrite ? (
            <AdminButton onClick={() => void save()} disabled={busy}>
              {busy ? 'Saving…' : 'Save'}
            </AdminButton>
          ) : null
        }
      />

      {problem && (
        <div className="mb-5">
          <Alert>{problem} Nothing is being sent at the moment.</Alert>
        </div>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel title="Mail server">
            <div className="flex flex-col gap-5">
              <label className="flex items-center gap-2 text-[14px] text-ash">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-flare"
                  checked={form.enabled}
                  disabled={!canWrite}
                  onChange={(e) => set('enabled', e.target.checked)}
                />
                Send email from this site
              </label>

              <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_140px_200px]">
                <Field label="SMTP server" htmlFor="mail-host">
                  <Input id="mail-host" value={form.host} placeholder="smtp.example.com" spellCheck={false} disabled={!canWrite} onChange={(e) => set('host', e.target.value)} />
                </Field>
                <Field label="Port" htmlFor="mail-port">
                  <Input id="mail-port" type="number" min={1} max={65535} value={form.port} disabled={!canWrite} onChange={(e) => set('port', Number(e.target.value) || 587)} />
                </Field>
                <Field label="Security" htmlFor="mail-secure" hint="465 is usually TLS; 587 STARTTLS">
                  <Select id="mail-secure" value={form.secure ? 'tls' : 'starttls'} disabled={!canWrite} onChange={(e) => set('secure', e.target.value === 'tls')}>
                    <option value="starttls">STARTTLS (587)</option>
                    <option value="tls">TLS (465)</option>
                  </Select>
                </Field>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Username" htmlFor="mail-user" hint="leave empty for a relay that needs no sign-in">
                  <Input id="mail-user" value={form.user} autoComplete="off" spellCheck={false} disabled={!canWrite} onChange={(e) => set('user', e.target.value)} />
                </Field>
                <Field
                  label="Password"
                  htmlFor="mail-password"
                  hint={passwordSet ? 'a password is stored — type a new one to replace it' : 'stored encrypted; never shown again'}
                >
                  <Input
                    id="mail-password"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    placeholder={passwordSet ? '••••••••' : ''}
                    disabled={!canWrite || clearPassword}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </Field>
              </div>

              {passwordSet && canWrite && (
                <label className="flex items-center gap-2 text-[13px] text-smoke">
                  <input type="checkbox" className="h-4 w-4 accent-flare" checked={clearPassword} onChange={(e) => setClearPassword(e.target.checked)} />
                  Forget the stored password when I save
                </label>
              )}
            </div>
          </Panel>

          <Panel title="Addresses">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="From name" htmlFor="mail-fromname">
                <Input id="mail-fromname" value={form.fromName} placeholder="Studio North" disabled={!canWrite} onChange={(e) => set('fromName', e.target.value)} />
              </Field>
              <Field label="From address" htmlFor="mail-fromemail" hint="must be one the server may send as">
                <Input id="mail-fromemail" value={form.fromEmail} placeholder="hello@example.com" spellCheck={false} disabled={!canWrite} onChange={(e) => set('fromEmail', e.target.value)} />
              </Field>
              <Field label="Reply-to" htmlFor="mail-replyto" hint="optional">
                <Input id="mail-replyto" value={form.replyTo} spellCheck={false} disabled={!canWrite} onChange={(e) => set('replyTo', e.target.value)} />
              </Field>
              <Field label="Notifications go to" htmlFor="mail-notify" hint="up to five, separated by commas; empty uses the site contact address">
                <Input id="mail-notify" value={recipients} spellCheck={false} disabled={!canWrite} onChange={(e) => setRecipients(e.target.value)} />
              </Field>
            </div>
          </Panel>

          <Panel title="What gets sent">
            <div className="flex flex-col gap-3">
              {(
                [
                  ['enquiry', 'A contact enquiry arrives'],
                  ['formSubmission', 'A form is filled in'],
                  ['newsletter', 'Somebody joins the newsletter'],
                  ['security', 'Security alerts — failed sign-ins, locked accounts, blocked addresses'],
                  ['engineUpdate', 'A newer version of the engine is available'],
                ] as [keyof Editable['events'], string][]
              ).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-[14px] text-ash">
                  <input type="checkbox" className="h-4 w-4 accent-flare" checked={form.events[key]} disabled={!canWrite} onChange={(e) => setEvent(key, e.target.checked)} />
                  {label}
                </label>
              ))}
              <p className="m-0 mt-1 text-[13px] leading-relaxed text-smoke">
                Notifications say what arrived and link to it. Enquiry text is included so you can reply from your inbox; form answers are not — they are personal data and stay in the admin.
              </p>
            </div>
          </Panel>
        </div>

        <aside className="flex flex-col gap-6 lg:sticky lg:top-10">
          <Panel title="Send a test">
            <div className="flex flex-col gap-4">
              <p className="m-0 text-[13px] leading-relaxed text-ash">
                Save first, then send yourself a message. A test goes out even while sending is switched off, so you can check the settings before turning it on.
              </p>
              <Field label="To" htmlFor="mail-test" hint="your own address by default">
                <Input id="mail-test" value={testTo} placeholder="you@example.com" spellCheck={false} disabled={!canWrite} onChange={(e) => setTestTo(e.target.value)} />
              </Field>
              <AdminButton variant="secondary" onClick={() => void sendTest()} disabled={!canWrite || testing}>
                {testing ? 'Sending…' : 'Send a test message'}
              </AdminButton>
            </div>
          </Panel>

          <Panel title="Where this is used">
            <ul className="m-0 flex list-none flex-col gap-2 p-0 text-[13px] leading-relaxed text-ash">
              <li>Welcome messages for new accounts.</li>
              <li>Password reset links.</li>
              <li>Security alerts, also shown on the Security screen.</li>
              <li>Notifications of enquiries and form submissions.</li>
            </ul>
          </Panel>
        </aside>
      </div>
    </>
  );
}
