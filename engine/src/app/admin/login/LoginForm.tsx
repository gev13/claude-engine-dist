'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { AdminButton, Alert, Field, Input } from '@/components/admin/ui';
import { api } from '@/lib/admin/client';

type LoginResult = { status: 'ok' | '2fa_required' | '2fa_setup_required' };

/** `requireTwoFactor` is passed in from the server: the flag is not public, so
 *  a client component cannot read it for itself. */
export function LoginForm({ requireTwoFactor }: { requireTwoFactor: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') ?? '/admin';

  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');

    const form = new FormData(event.currentTarget);

    try {
      const result = await api<LoginResult>('/api/auth/login', {
        json: { email: String(form.get('email') ?? ''), password: String(form.get('password') ?? '') },
        retry: false,
      });

      if (result.status === '2fa_required') {
        router.push(`/admin/two-factor?next=${encodeURIComponent(next)}`);
        return;
      }
      if (result.status === '2fa_setup_required') {
        router.push(`/admin/two-factor?setup=1&next=${encodeURIComponent(next)}`);
        return;
      }

      router.push(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      {error && <Alert>{error}</Alert>}

      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" required autoComplete="username" autoFocus />
      </Field>

      <Field label="Password" htmlFor="password">
        <Input id="password" name="password" type="password" required autoComplete="current-password" />
      </Field>

      <AdminButton type="submit" disabled={busy} className="mt-1 justify-center py-3">
        {busy ? 'Signing in…' : 'Sign in'}
      </AdminButton>

      <Link href="/admin/forgot" className="-mt-1 self-center text-[13px] text-smoke hover:text-bone">
        Forgotten your password?
      </Link>

      <p className="m-0 font-mono text-[10px] uppercase leading-relaxed tracking-[0.12em] text-smoke">
        {requireTwoFactor
          ? 'Two-factor authentication is required for every account.'
          : 'Two-factor authentication is currently disabled on this deployment.'}
      </p>
    </form>
  );
}
