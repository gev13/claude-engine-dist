'use client';

import { useId, useState } from 'react';
import type { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Section } from '@/components/ui/Section';
import type { blockSchemas } from '@/lib/blocks';
import { cn } from '@/lib/utils';
import { BlockHead } from './parts';

type Props = z.output<(typeof blockSchemas)['contactForm']>;

const businessTypes = ['Operator', 'Sportsbook', 'Game studio', 'Aggregator', 'Platform provider', 'Payments', 'Other'];

const fieldClass =
  'w-full border-2 border-hairline bg-surface px-4 py-3 text-[length:var(--he-block-text,16px)] text-bone transition-colors placeholder:text-smoke focus:border-flare focus:outline-none';

const labelClass = 'mb-2 block font-mono text-[11px] uppercase tracking-[0.12em] text-smoke';

/**
 * The form itself. The service options arrive as a prop because the catalogue
 * now comes from the database and this component is a client component — the
 * server wrapper in `ContactForm.tsx` fetches them.
 */
export function ContactFormClient(p: Props & { serviceOptions: readonly string[] }) {
  // Unique per form, so two forms on one page never share field ids.
  const uid = useId();
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState<string>('');

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState('sending');
    setError('');

    const form = new FormData(e.currentTarget);
    const payload = {
      name: String(form.get('name') ?? ''),
      email: String(form.get('email') ?? ''),
      company: String(form.get('company') ?? ''),
      role: String(form.get('role') ?? ''),
      businessType: String(form.get('businessType') ?? ''),
      services: form.getAll('services').map(String),
      timing: String(form.get('timing') ?? ''),
      message: String(form.get('message') ?? ''),
      // Honeypot — bots fill it, humans never see it.
      website: String(form.get('website') ?? ''),
    };

    try {
      const res = await fetch('/api/enquiries', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
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

  if (state === 'sent') {
    return (
      <Section size="lg">
        <div className="max-w-[52ch] border-l-2 border-flare pl-6">
          <h2 className="display m-0 text-[clamp(24px,3.4vw,32px)]">Thanks — that&apos;s with us.</h2>
          <p className="mt-4 text-[length:var(--he-block-lead,17px)] text-ash">
            We read every enquiry ourselves. Expect a reply from a senior consultant, usually within one working day.
          </p>
        </div>
      </Section>
    );
  }

  const split = p.layout === 'split';
  const centered = p.layout === 'centered';

  const form = (
      <form
        onSubmit={onSubmit}
        noValidate
        className={cn('grid grid-cols-1 gap-6 md:grid-cols-2', split ? 'he-cform__form' : centered ? 'mx-auto max-w-[760px]' : 'max-w-[860px]')}
      >
        <div>
          <label className={labelClass} htmlFor={`${uid}-name`}>Name</label>
          <input id={`${uid}-name`} name="name" required autoComplete="name" className={fieldClass} />
        </div>

        <div>
          <label className={labelClass} htmlFor={`${uid}-email`}>Work email</label>
          <input id={`${uid}-email`} name="email" type="email" required autoComplete="email" className={fieldClass} />
        </div>

        <div>
          <label className={labelClass} htmlFor={`${uid}-company`}>Company</label>
          <input id={`${uid}-company`} name="company" required autoComplete="organization" className={fieldClass} />
        </div>

        <div>
          <label className={labelClass} htmlFor={`${uid}-role`}>Your role (optional)</label>
          <input id={`${uid}-role`} name="role" autoComplete="organization-title" className={fieldClass} />
        </div>

        <fieldset className="col-span-full m-0 border-0 p-0">
          <legend className={labelClass}>What kind of business are you?</legend>
          <div className="flex flex-wrap gap-2">
            {businessTypes.map((t) => (
              <label
                key={t}
                className="cursor-pointer border-2 border-hairline px-4 py-2.5 text-[14px] text-ash transition-colors has-checked:border-flare has-checked:bg-flare has-checked:text-bone hover:border-rule"
              >
                <input type="radio" name="businessType" value={t} className="sr-only" />
                {t}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="col-span-full m-0 border-0 p-0">
          <legend className={labelClass}>What are you interested in?</legend>
          <div className="flex flex-wrap gap-2">
            {[...p.serviceOptions, 'Not sure yet'].map((t) => (
              <label
                key={t}
                className="cursor-pointer border-2 border-hairline px-4 py-2.5 text-[14px] text-ash transition-colors has-checked:border-flare has-checked:bg-flare has-checked:text-bone hover:border-rule"
              >
                <input type="checkbox" name="services" value={t} className="sr-only" />
                {t}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="col-span-full">
          <label className={labelClass} htmlFor={`${uid}-timing`}>Anything driving the timing?</label>
          <input
            id={`${uid}-timing`}
            name="timing"
            className={fieldClass}
            placeholder="Licence deadline, launch date, board request…"
          />
        </div>

        <div className="col-span-full">
          <label className={labelClass} htmlFor={`${uid}-message`}>Message</label>
          <textarea id={`${uid}-message`} name="message" rows={6} required className={`${fieldClass} resize-y`} />
        </div>

        {/* Honeypot */}
        <div aria-hidden="true" className="hidden">
          <label htmlFor={`${uid}-website`}>Website</label>
          <input id={`${uid}-website`} name="website" tabIndex={-1} autoComplete="off" />
        </div>

        {state === 'error' && (
          <p role="alert" className="col-span-full m-0 border-l-2 border-flare pl-4 text-[length:var(--he-block-small,15px)] text-flare-soft">
            {error}
          </p>
        )}

        <div className={cn('col-span-full flex flex-wrap items-center gap-4', centered && 'justify-center')}>
          <Button type="submit" disabled={state === 'sending'} withArrow className={split ? 'w-full' : undefined}>
            {state === 'sending' ? 'Sending…' : 'Send your enquiry'}
          </Button>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-smoke">
            We reply within one working day
          </span>
        </div>
      </form>
  );

  // CF3 — heading, text and a picture beside the form, which sits in a card.
  if (split) {
    return (
      <Section size="lg">
        <div className="he-cform">
          <div className="he-cform__side">
            <BlockHead eyebrow={p.eyebrow} title={p.title} titleAs={p.titleAs} intro={p.intro} />
            {p.body && <p className="he-lbody">{p.body}</p>}
            {p.imageUrl && (
              <div className="he-cform__media">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.imageUrl} alt={p.alt ?? ''} className="he-fill" loading="lazy" />
              </div>
            )}
          </div>
          <div className="he-cform__card">{form}</div>
        </div>
      </Section>
    );
  }

  return (
    <Section size="lg">
      <BlockHead eyebrow={p.eyebrow} title={p.title} titleAs={p.titleAs} intro={p.intro} align={centered ? 'center' : undefined} className="mb-10" />
      {form}
    </Section>
  );
}
