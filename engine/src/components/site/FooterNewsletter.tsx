'use client';

import { useId, useState } from 'react';
import { useChallenge } from '@/components/site/Captcha';
import { useMessages } from '@/components/site/Messages';

/**
 * 3.29 — the footer's email sign-up: a heading, a line, and the field with
 * a round arrow at its end. It posts to /api/newsletter like the Newsletter
 * block, so addresses land in the same admin list; its words are the
 * engine's own (`footer.newsletter*`, `newsletter.*`), translated per
 * language in Site translations.
 */
export function FooterNewsletter() {
  const id = useId();
  const t = useMessages();
  const challenge = useChallenge('newsletter');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const token = await challenge.token();
    if (token === false) {
      setState('error');
      setError(t('captcha.required'));
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
          source: window.location.pathname.slice(0, 300),
          website: String(form.get('website') ?? ''),
          ...(token ? { captcha: token } : {}),
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? t('form.error'));
      }
      setState('sent');
    } catch (err) {
      challenge.reset();
      setState('error');
      setError(err instanceof Error ? err.message : t('form.error'));
    }
  }

  return (
    <div className="he-ftr__nl">
      <p className="he-ftr__nltitle">{t('footer.newsletterTitle')}</p>
      <p className="he-ftr__nltext">{t('footer.newsletterText')}</p>
      {state === 'sent' ? (
        <p className="he-ftr__nldone" role="status">
          {t('newsletter.thanks')}
        </p>
      ) : (
        <form className="he-ftr__nlform" onSubmit={onSubmit} noValidate>
          <label htmlFor={`${id}-email`} className="sr-only">
            {t('newsletter.placeholder')}
          </label>
          <div className="he-ftr__nlrow">
            <input id={`${id}-email`} name="email" type="email" required autoComplete="email" placeholder={t('newsletter.placeholder')} className="he-nl__input he-ftr__nlinput" />
            <button type="submit" className="he-ftr__nlsend" disabled={state === 'sending'} aria-label={t('newsletter.subscribe')}>
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                <path d="M3 9l6-6M4 3h5v5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
          <div aria-hidden="true" className="hidden">
            <label htmlFor={`${id}-website`}>Website</label>
            <input id={`${id}-website`} name="website" tabIndex={-1} autoComplete="off" />
          </div>
          {challenge.field}
          {state === 'error' && (
            <p role="alert" className="he-ftr__nlerror">
              {error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
