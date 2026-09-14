'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { AdminButton, Alert, Field, Input } from '@/components/admin/ui';
import { api } from '@/lib/admin/client';

/**
 * Setting a new password from an emailed link.
 *
 * The token travels in the query string and goes no further than this request.
 * A successful reset signs the account out everywhere, so whoever changed it
 * signs in again — and anybody else already signed in as them does not.
 */
export function ResetForm() {
  const token = useSearchParams().get('token') ?? '';
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get('password') ?? '');
    const confirm = String(form.get('confirm') ?? '');

    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      await api('/api/auth/reset-password', { json: { token, password }, retry: false });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That password could not be set.');
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <div className="flex flex-col gap-5">
        <Alert>This link is missing its token. Ask for a new one.</Alert>
        <Link href="/admin/forgot" className="text-[14px] text-flare-soft hover:text-bone">
          Send me another link
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex flex-col gap-5">
        <p className="m-0 text-[15px] leading-relaxed text-ash">
          Your password is set, and every session for this account has been signed out.
        </p>
        <Link href="/admin/login" className="text-[14px] text-flare-soft hover:text-bone">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      {error && <Alert>{error}</Alert>}

      <p className="m-0 text-[14px] leading-relaxed text-ash">
        Choose a new password. At least twelve characters, and not something containing your name or address.
      </p>

      <Field label="New password" htmlFor="password">
        <Input id="password" name="password" type="password" required autoComplete="new-password" autoFocus minLength={12} />
      </Field>

      <Field label="Confirm password" htmlFor="confirm">
        <Input id="confirm" name="confirm" type="password" required autoComplete="new-password" minLength={12} />
      </Field>

      <AdminButton type="submit" disabled={busy} className="mt-1 justify-center py-3">
        {busy ? 'Saving…' : 'Set my password'}
      </AdminButton>

      <Link href="/admin/login" className="-mt-1 self-center text-[13px] text-smoke hover:text-bone">
        Back to sign in
      </Link>
    </form>
  );
}
