'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AdminButton, Alert, Field, Input } from '@/components/admin/ui';
import { api } from '@/lib/admin/client';

/**
 * Asking for a reset link.
 *
 * The answer never says whether the address has an account — the endpoint is
 * open to anybody, and a different message for a known address would turn this
 * form into a way to discover who has one.
 */
export function ForgotForm() {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      await api('/api/auth/forgot-password', { json: { email: String(form.get('email') ?? '') }, retry: false });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That could not be sent. Try again shortly.');
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-5">
        <p className="m-0 text-[15px] leading-relaxed text-ash">
          If that address belongs to an account, a link is on its way. It works once and expires in thirty minutes.
        </p>
        <p className="m-0 text-[13px] leading-relaxed text-smoke">
          Nothing arrived? Check the spam folder. If the site has no mail server set up yet, ask an administrator to
          set your password from the Users screen.
        </p>
        <Link href="/admin/login" className="text-[14px] text-flare-soft hover:text-bone">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      {error && <Alert>{error}</Alert>}

      <p className="m-0 text-[14px] leading-relaxed text-ash">
        Enter the address you sign in with and we will send you a link to set a new password.
      </p>

      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" required autoComplete="username" autoFocus />
      </Field>

      <AdminButton type="submit" disabled={busy} className="mt-1 justify-center py-3">
        {busy ? 'Sending…' : 'Send me a link'}
      </AdminButton>

      <Link href="/admin/login" className="-mt-1 self-center text-[13px] text-smoke hover:text-bone">
        Back to sign in
      </Link>
    </form>
  );
}
