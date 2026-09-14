'use client';

import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AdminButton, Alert, Field, Input } from '@/components/admin/ui';
import { api } from '@/lib/admin/client';

type SetupPayload = { secret: string; uri: string; qrDataUrl: string };

export function TwoFactorFlow() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') ?? '/admin';
  const isSetup = params.get('setup') === '1';

  const [setup, setSetup] = useState<SetupPayload | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [useRecovery, setUseRecovery] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isSetup) return;
    api<SetupPayload>('/api/auth/setup-2fa', { retry: false })
      .then(setSetup)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not start setup.'));
  }, [isSetup]);

  async function confirmSetup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const code = String(new FormData(event.currentTarget).get('code') ?? '');

    try {
      const result = await api<{ recoveryCodes: string[] }>('/api/auth/setup-2fa', {
        json: { code },
        retry: false,
      });
      setRecoveryCodes(result.recoveryCodes);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That code was not accepted.');
    } finally {
      setBusy(false);
    }
  }

  async function verify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const code = String(new FormData(event.currentTarget).get('code') ?? '');

    try {
      await api('/api/auth/verify-2fa', { json: { code, recovery: useRecovery }, retry: false });
      router.push(next);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That code is not correct.');
      setBusy(false);
    }
  }

  /* ── Recovery codes, shown exactly once ───────────────────────────────── */
  if (recoveryCodes) {
    return (
      <div>
        <h1 className="display m-0 text-[28px]">Save your recovery codes</h1>
        <p className="mb-6 mt-2 text-[15px] text-ash">
          Each code works once, and this is the only time they are shown. Store them somewhere you can reach without
          your phone.
        </p>
        <ul className="m-0 grid list-none grid-cols-2 gap-0.5 p-0">
          {recoveryCodes.map((code) => (
            <li key={code} className="bg-surface px-4 py-3 text-center font-mono text-[14px] tracking-[0.08em] text-bone">
              {code}
            </li>
          ))}
        </ul>
        <AdminButton
          className="mt-7 w-full justify-center py-3"
          onClick={() => {
            router.push(next);
            router.refresh();
          }}
        >
          I have saved them — continue
        </AdminButton>
      </div>
    );
  }

  /* ── Enrolment ────────────────────────────────────────────────────────── */
  if (isSetup) {
    return (
      <div>
        <h1 className="display m-0 text-[28px]">Set up two-factor authentication</h1>
        <p className="mb-6 mt-2 text-[15px] text-ash">
          Scan this with your authenticator app, then enter the six-digit code it shows.
        </p>

        {error && <Alert>{error}</Alert>}

        {setup ? (
          <>
            <div className="my-6 inline-block border-2 border-hairline bg-surface p-3">
              <Image src={setup.qrDataUrl} alt="Two-factor setup QR code" width={216} height={216} unoptimized />
            </div>
            <details className="mb-6">
              <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.12em] text-smoke hover:text-bone">
                Can&apos;t scan? Enter the key manually
              </summary>
              <code className="mt-3 block break-all bg-surface px-3 py-2.5 font-mono text-[13px] text-flare-soft">
                {setup.secret}
              </code>
            </details>

            <form onSubmit={confirmSetup} className="flex flex-col gap-5">
              <Field label="Six-digit code" htmlFor="code">
                <Input
                  id="code"
                  name="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  autoFocus
                  className="text-center font-mono text-[20px] tracking-[0.4em]"
                />
              </Field>
              <AdminButton type="submit" disabled={busy} className="justify-center py-3">
                {busy ? 'Confirming…' : 'Confirm and enable'}
              </AdminButton>
            </form>
          </>
        ) : (
          !error && <p className="text-[14px] text-smoke">Preparing your setup key…</p>
        )}
      </div>
    );
  }

  /* ── Verification ─────────────────────────────────────────────────────── */
  return (
    <div>
      <h1 className="display m-0 text-[28px]">Two-factor authentication</h1>
      <p className="mb-6 mt-2 text-[15px] text-ash">
        {useRecovery
          ? 'Enter one of the recovery codes you saved when you enrolled.'
          : 'Enter the six-digit code from your authenticator app.'}
      </p>

      {error && <Alert>{error}</Alert>}

      <form onSubmit={verify} className="mt-5 flex flex-col gap-5">
        <Field label={useRecovery ? 'Recovery code' : 'Six-digit code'} htmlFor="code">
          <Input
            id="code"
            name="code"
            key={useRecovery ? 'recovery' : 'totp'}
            inputMode={useRecovery ? 'text' : 'numeric'}
            autoComplete="one-time-code"
            maxLength={useRecovery ? 12 : 6}
            required
            autoFocus
            className={useRecovery ? 'text-center font-mono text-[17px]' : 'text-center font-mono text-[20px] tracking-[0.4em]'}
          />
        </Field>

        <AdminButton type="submit" disabled={busy} className="justify-center py-3">
          {busy ? 'Checking…' : 'Verify'}
        </AdminButton>

        <button
          type="button"
          onClick={() => {
            setUseRecovery((v) => !v);
            setError('');
          }}
          className="m-0 cursor-pointer bg-transparent p-0 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-smoke hover:text-flare-soft"
        >
          {useRecovery ? 'Use my authenticator app instead' : 'Use a recovery code instead'}
        </button>
      </form>
    </div>
  );
}
