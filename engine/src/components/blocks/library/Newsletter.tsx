'use client';

import { useId, useState } from 'react';
import type { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Eyebrow } from '@/components/ui/Eyebrow';
import type { blockSchemas } from '@/lib/blocks';
import { cn } from '@/lib/utils';
import { BlockTitle } from '../parts';

type P = z.output<(typeof blockSchemas)['newsletter']>;

const TONES = { base: '', raised: 'is-raised', flare: 'is-flare' } as const;

/**
 * CF2 — an email sign-up posting to /api/newsletter. (Its old "heading with a
 * button" layout is now the inline call to action.) Addresses are stored and
 * listed in the admin, and the administrators are notified when the newsletter
 * event is enabled on the Email screen.
 *
 * Nothing is ever sent to the person who signed up: this collects addresses,
 * it does not run a mailing list. Whatever sends the actual newsletter reads
 * them from the admin list or its CSV export.
 */
export function NewsletterBlock(p: P) {
  const id = useId();
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');

  const head = (
    <div className="he-nl__head">
      {p.eyebrow && <Eyebrow>{p.eyebrow}</Eyebrow>}
      <BlockTitle as={p.titleAs}>{p.title}</BlockTitle>
      {p.body && <p className="he-lbody">{p.body}</p>}
    </div>
  );

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    if (p.consentText && form.get('consent') !== 'on') {
      setState('error');
      setError('Tick the box to confirm, then try again.');
      return;
    }

    setState('sending');
    setError('');
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: String(form.get('email') ?? ''),
          consent: form.get('consent') === 'on',
          source: window.location.pathname.slice(0, 300),
          website: String(form.get('website') ?? ''),
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? 'Something went wrong. Please try again.');
      }
      setState('sent');
    } catch (err) {
      setState('error');
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    }
  }

  return (
    <section className={cn('he-lsec he-nl', TONES[p.tone ?? 'base'], p.layout === 'centered' && 'is-centered', `is-field-${p.fieldStyle}`)}>
      <div className="shell he-nl__grid">
        {head}
        {state === 'sent' ? (
          <p className="he-nl__done" role="status">
            {p.successText || 'Thanks — you’re on the list.'}
          </p>
        ) : (
          <form className="he-nl__form" onSubmit={onSubmit} noValidate>
            <label htmlFor={`${id}-email`} className="sr-only">
              Email address
            </label>
            <div className="he-nl__row">
              <input
                id={`${id}-email`}
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder={p.placeholder || 'Your email address'}
                className="he-nl__input"
              />
              <Button type="submit" disabled={state === 'sending'} className="he-nl__submit">
                {state === 'sending' ? 'Sending…' : p.buttonLabel}
              </Button>
            </div>
            {p.consentText && (
              <label className="he-nl__consent">
                <input type="checkbox" name="consent" />
                <span>{p.consentText}</span>
              </label>
            )}
            {/* Honeypot */}
            <div aria-hidden="true" className="hidden">
              <label htmlFor={`${id}-website`}>Website</label>
              <input id={`${id}-website`} name="website" tabIndex={-1} autoComplete="off" />
            </div>
            {state === 'error' && (
              <p role="alert" className="he-nl__error">
                {error}
              </p>
            )}
          </form>
        )}
      </div>
    </section>
  );
}
