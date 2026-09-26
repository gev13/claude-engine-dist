'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { z } from 'zod';
import { useChallenge } from '@/components/site/Captcha';
import { useMessages } from '@/components/site/Messages';
import { afterSubmit, hiddenValues, noteFirstTouch } from '@/components/site/formActions';
import type { blockSchemas } from '@/lib/blocks';
import { type FormField, formSteps, validateAnswers, visibleFields } from '@/lib/forms';
import { cn } from '@/lib/utils';
import { ArrowRight } from '@/components/ui/Button';
import { BlockHead } from '../parts';

/* ═══════════════════════════════════════════════════════════════════════════
   P3-E — the form block
   ───────────────────────────────────────────────────────────────────────────
   Fields chosen in the editor, optionally split into steps. Each step is
   checked here before the next one opens, and the whole form again on the
   server against the form saved on this page. Answers are stored and read
   in Form submissions.

   2.16: a question can depend on an earlier answer (`showIf`), hidden fields
   carry the visit's campaign, a CAPTCHA can guard the send, and success can
   fire a conversion and open a thank-you page — each off unless the form's
   settings turn it on.
   ═══════════════════════════════════════════════════════════════════════════ */

type P = z.output<(typeof blockSchemas)['form']> & { blockId?: string };
type Values = Record<string, string | string[] | boolean | File>;

const TONES = { base: '', raised: 'is-raised', flare: 'is-flare' } as const;

/* Mirrors ATTACHMENT_KINDS in server/applications/storage.ts. The server
   checks the bytes; this only spares somebody the upload. */
const FILE_ACCEPT = '.pdf,.docx,.jpg,.jpeg,.png';
const FILE_HINT = 'PDF, Word, JPG or PNG, up to 8 MB.';

function Field({ field, uid, value, onChange, mark }: { field: FormField; uid: string; value: Values[string] | undefined; onChange: (next: Values[string]) => void; mark: boolean }) {
  const t = useMessages();
  // One text node, as the markup always was.
  const optional = mark && <span className="he-fb__opt">{` (${t('form.optional')})`}</span>;
  const id = `${uid}-${field.id}`;
  const hint = field.help ? `${id}-help` : undefined;
  const label = (
    <label className="he-fb__label" htmlFor={id}>
      {field.label}
      {!field.required && optional}
    </label>
  );
  const common = { id, name: field.id, required: field.required, 'aria-describedby': hint, className: 'he-fb__input' };
  const help = field.help && (
    <p id={hint} className="he-fb__help">
      {field.help}
    </p>
  );

  // 3.7 — several choices in a drop-down: a button naming what is chosen, over a list of tick boxes.
  if (field.type === 'multiselect') {
    return (
      <div className={cn('he-fb__field', `is-${field.width}`)}>
        {label}
        <MultiSelect
          id={id}
          options={field.options}
          value={Array.isArray(value) ? value : []}
          placeholder={field.placeholder || t('form.choose')}
          describedBy={hint}
          onChange={onChange}
        />
        {help}
      </div>
    );
  }

  if (field.type === 'radio' || field.type === 'checkboxes') {
    const list = Array.isArray(value) ? value : [];
    return (
      <fieldset className={cn('he-fb__field he-fb__set', `is-${field.width}`)} aria-describedby={hint}>
        <legend className="he-fb__label">
          {field.label}
          {!field.required && optional}
        </legend>
        <div className="he-fb__choices">
          {field.options.map((option) => (
            <label key={option} className="he-fb__choice">
              <input
                type={field.type === 'radio' ? 'radio' : 'checkbox'}
                name={field.id}
                value={option}
                checked={field.type === 'radio' ? value === option : list.includes(option)}
                onChange={(e) => onChange(field.type === 'radio' ? option : e.target.checked ? [...list, option] : list.filter((v) => v !== option))}
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
        {help}
      </fieldset>
    );
  }

  if (field.type === 'consent') {
    return (
      <div className={cn('he-fb__field', 'is-full')}>
        <label className="he-fb__consent">
          <input type="checkbox" name={field.id} required={field.required} checked={value === true} aria-describedby={hint} onChange={(e) => onChange(e.target.checked)} />
          <span>{field.label}</span>
        </label>
        {help}
      </div>
    );
  }

  if (field.type === 'file') {
    const chosen = value instanceof File ? value : null;
    return (
      <div className={cn('he-fb__field', `is-${field.width}`)}>
        {label}
        <input
          {...common}
          type="file"
          accept={FILE_ACCEPT}
          className="he-fb__input he-apply__file"
          onChange={(e) => onChange(e.target.files?.[0] ?? '')}
        />
        <p className="he-fb__help">{chosen ? `Attached: ${chosen.name}` : FILE_HINT}</p>
        {field.help && <p className="he-fb__help">{field.help}</p>}
      </div>
    );
  }

  return (
    <div className={cn('he-fb__field', `is-${field.width}`)}>
      {label}
      {field.type === 'textarea' ? (
        <textarea {...common} rows={5} placeholder={field.placeholder} value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value)} />
      ) : field.type === 'select' ? (
        <select {...common} value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value)}>
          <option value="">{field.placeholder || t('form.choose')}</option>
          {field.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : (
        <input
          {...common}
          type={field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : field.type === 'date' ? 'date' : 'text'}
          inputMode={field.type === 'number' ? 'decimal' : undefined}
          autoComplete={field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : undefined}
          placeholder={field.placeholder}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {help}
    </div>
  );
}

function MultiSelect({
  id,
  options,
  value,
  placeholder,
  describedBy,
  onChange,
}: {
  id: string;
  options: string[];
  value: string[];
  placeholder: string;
  describedBy?: string;
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  // Closes on a click anywhere else, or Escape (which hands focus back to the button).
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      document.getElementById(id)?.focus();
    };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', escape);
    };
  }, [open, id]);

  return (
    <div ref={box} className={cn('he-fb__multi', open && 'is-open')}>
      <button
        type="button"
        id={id}
        className="he-fb__input he-fb__multibtn"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-describedby={describedBy}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={cn('he-fb__multival', value.length === 0 && 'is-empty')}>{value.length ? value.join(', ') : placeholder}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true" className="he-fb__multichev">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div id={`${id}-list`} className="he-fb__multilist" role="group" aria-labelledby={id}>
          {options.map((option) => (
            <label key={option} className="he-fb__multiopt">
              <input
                type="checkbox"
                checked={value.includes(option)}
                onChange={(e) => onChange(e.target.checked ? [...value, option] : value.filter((v) => v !== option))}
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

/** What the validator and the envelope see: a File is reduced to "one came". */
function asAnswers(values: Values): Record<string, string | string[] | boolean> {
  const out: Record<string, string | string[] | boolean> = {};
  for (const [id, value] of Object.entries(values)) out[id] = value instanceof File ? true : value;
  return out;
}

export function FormBlock(p: P) {
  const t = useMessages();
  const uid = useId();
  const path = usePathname();
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Values>({});
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState('');
  const [trap, setTrap] = useState('');
  const challenge = useChallenge('form', p.captcha);

  /* A question whose condition does not hold is left out, and so is a step
     left with nothing to ask. Worked out from the whole form, since a
     condition can point at an earlier step. */
  const answers = useMemo(() => asAnswers(values), [values]);
  const steps = useMemo(() => {
    const shown = new Set(visibleFields(p.fields, answers).map((field) => field.id));
    const all = formSteps(p.fields);
    const kept = all.map((s) => ({ ...s, fields: s.fields.filter((field) => shown.has(field.id)) })).filter((s) => s.fields.length > 0);
    return kept.length > 0 ? kept : all.slice(0, 1);
  }, [p.fields, answers]);

  // The landing page is the visit's first page, so it is noted when a form with hidden fields is seen.
  const hasHidden = p.hidden.length > 0;
  useEffect(() => {
    if (hasHidden) noteFirstTouch();
  }, [hasHidden]);

  const at = Math.min(step, steps.length - 1);
  const current = steps[at] ?? { fields: [] };
  const last = at >= steps.length - 1;
  const set = (id: string) => (value: Values[string]) => setValues((v) => ({ ...v, [id]: value }));

  async function next(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    /* `validateAnswers` cannot see a File, so a file field is handed `true`
       when one has been chosen — the server does exactly the same with the
       multipart body, so both sides ask the same question. */
    const check = validateAnswers(current.fields, answers, p.fields);
    if (!check.ok) return setError(check.error);
    setError('');
    if (!last) return setStep(at + 1);

    const token = await challenge.token();
    if (token === false) return setError(t('captcha.required'));

    setState('sending');
    try {
      /* Multipart only when there is actually a file: a form of text questions
         keeps the cheaper JSON path it has always used. */
      const files = Object.entries(values).filter((entry): entry is [string, File] => entry[1] instanceof File);
      const hidden = hiddenValues(p.hidden);

      let res: Response;
      if (files.length > 0) {
        const data = new FormData();
        data.set('formId', p.blockId ?? '');
        data.set('source', path);
        data.set('answers', JSON.stringify(answers));
        data.set('website', trap);
        data.set('hidden', JSON.stringify(hidden));
        if (token) data.set('captcha', token);
        for (const [id, file] of files) data.set(`file:${id}`, file);
        // No content-type header: only the browser knows the boundary.
        res = await fetch('/api/forms', { method: 'POST', body: data });
      } else {
        res = await fetch('/api/forms', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ formId: p.blockId, source: path, answers: values, website: trap, hidden, ...(token ? { captcha: token } : {}) }),
        });
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? t('form.error'));
      }
      setState('sent');
      afterSubmit(p.after, p.formName);
    } catch (err) {
      setState('idle');
      // A token is spent once, so a refused send needs a fresh one.
      challenge.reset();
      setError(err instanceof Error ? err.message : t('form.error'));
    }
  }

  const center = p.align === 'center';
  const body =
    state === 'sent' ? (
      <div className="he-fb__done" role="status">
        <p className="he-fb__donetitle">{p.successTitle || t('form.thanks')}</p>
        {p.successText && <p className="he-fb__donetext">{p.successText}</p>}
      </div>
    ) : (
      <form onSubmit={next} noValidate className="he-fb__form" aria-label={p.title || p.formName}>
        {steps.length > 1 && (
          <div className="he-fb__progress">
            <p className="he-fb__stepname" aria-live="polite">
              {t('form.step', { n: at + 1, total: steps.length })}
              {current.title ? ` — ${current.title}` : ''}
            </p>
            <div className="he-fb__bar" aria-hidden="true">
              <span style={{ width: `${((at + 1) / steps.length) * 100}%` }} />
            </div>
          </div>
        )}
        <div className="he-fb__grid">
          {current.fields.map((field) => (
            <Field key={field.id} field={field} uid={uid} value={values[field.id]} onChange={set(field.id)} mark={p.optionalMark !== false} />
          ))}
        </div>
        {/* A trap for bots: people never see it, so anything typed here is not from a person. */}
        <div aria-hidden="true" className="hidden">
          <label htmlFor={`${uid}-website`}>Website</label>
          <input id={`${uid}-website`} name="website" tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} />
        </div>
        {last && challenge.field}
        {error && (
          <p role="alert" className="he-fb__error">
            {error}
          </p>
        )}
        <div className={cn('he-fb__actions', center && 'is-center')}>
          {at > 0 && (
            <button type="button" className="he-cbtn is-medium is-outline" onClick={() => (setError(''), setStep(at - 1))}>
              {t('form.back')}
            </button>
          )}
          <button type="submit" className="he-cbtn is-medium is-primary" disabled={state === 'sending'}>
            {state === 'sending' ? t('form.sending') : last ? p.submitLabel || t('form.submit') : t('form.next')}
            {p.submitArrow && <ArrowRight />}
          </button>
          {/* 2.22 — a line beside the send button, on the last step only. */}
          {last && p.submitNote && <p className="he-fb__note">{p.submitNote}</p>}
        </div>
      </form>
    );

  return (
    <section className={cn('he-lsec he-fb', TONES[p.tone ?? 'base'], `is-${p.layout}`, center && 'is-center', p.wide && 'is-wide', p.compactChoices && 'is-compact')}>
      <div className="shell">
        {(p.eyebrow || p.title || p.intro) && <BlockHead eyebrow={p.eyebrow} title={p.title} titleAs={p.titleAs} intro={p.intro} align={p.align} className="mb-9" />}
        <div className="he-fb__box" style={p.cardPadding ? ({ '--he-fb-pad': p.cardPadding } as React.CSSProperties) : undefined}>
          {body}
        </div>
      </div>
    </section>
  );
}
