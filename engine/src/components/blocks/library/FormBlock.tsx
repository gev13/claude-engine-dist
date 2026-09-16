'use client';

import { usePathname } from 'next/navigation';
import { useId, useMemo, useState } from 'react';
import type { z } from 'zod';
import type { blockSchemas } from '@/lib/blocks';
import { type FormField, formSteps, validateAnswers } from '@/lib/forms';
import { cn } from '@/lib/utils';
import { BlockHead } from '../parts';

/* ═══════════════════════════════════════════════════════════════════════════
   P3-E — the form block
   ───────────────────────────────────────────────────────────────────────────
   Fields chosen in the editor, optionally split into steps. Each step is
   checked here before the next one opens, and the whole form again on the
   server against the form saved on this page. Answers are stored and read
   in Form submissions; nothing is emailed.
   ═══════════════════════════════════════════════════════════════════════════ */

type P = z.output<(typeof blockSchemas)['form']> & { blockId?: string };
type Values = Record<string, string | string[] | boolean | File>;

const TONES = { base: '', raised: 'is-raised', flare: 'is-flare' } as const;

/* Mirrors ATTACHMENT_KINDS in server/applications/storage.ts. The server
   checks the bytes; this only spares somebody the upload. */
const FILE_ACCEPT = '.pdf,.docx,.jpg,.jpeg,.png';
const FILE_HINT = 'PDF, Word, JPG or PNG, up to 8 MB.';

function Field({ field, uid, value, onChange }: { field: FormField; uid: string; value: Values[string] | undefined; onChange: (next: Values[string]) => void }) {
  const id = `${uid}-${field.id}`;
  const hint = field.help ? `${id}-help` : undefined;
  const label = (
    <label className="he-fb__label" htmlFor={id}>
      {field.label}
      {!field.required && <span className="he-fb__opt"> (optional)</span>}
    </label>
  );
  const common = { id, name: field.id, required: field.required, 'aria-describedby': hint, className: 'he-fb__input' };
  const help = field.help && (
    <p id={hint} className="he-fb__help">
      {field.help}
    </p>
  );

  if (field.type === 'radio' || field.type === 'checkboxes') {
    const list = Array.isArray(value) ? value : [];
    return (
      <fieldset className={cn('he-fb__field he-fb__set', `is-${field.width}`)} aria-describedby={hint}>
        <legend className="he-fb__label">
          {field.label}
          {!field.required && <span className="he-fb__opt"> (optional)</span>}
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
          <option value="">{field.placeholder || 'Choose…'}</option>
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

/** What the validator and the envelope see: a File is reduced to "one came". */
function asAnswers(values: Values): Record<string, string | string[] | boolean> {
  const out: Record<string, string | string[] | boolean> = {};
  for (const [id, value] of Object.entries(values)) out[id] = value instanceof File ? true : value;
  return out;
}

export function FormBlock(p: P) {
  const uid = useId();
  const path = usePathname();
  const steps = useMemo(() => formSteps(p.fields), [p.fields]);
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Values>({});
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState('');
  const [trap, setTrap] = useState('');

  const current = steps[step] ?? steps[0]!;
  const last = step >= steps.length - 1;
  const set = (id: string) => (value: Values[string]) => setValues((v) => ({ ...v, [id]: value }));

  async function next(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    /* `validateAnswers` cannot see a File, so a file field is handed `true`
       when one has been chosen — the server does exactly the same with the
       multipart body, so both sides ask the same question. */
    const check = validateAnswers(current.fields, asAnswers(values));
    if (!check.ok) return setError(check.error);
    setError('');
    if (!last) return setStep(step + 1);

    setState('sending');
    try {
      /* Multipart only when there is actually a file: a form of text questions
         keeps the cheaper JSON path it has always used. */
      const files = Object.entries(values).filter((entry): entry is [string, File] => entry[1] instanceof File);

      let res: Response;
      if (files.length > 0) {
        const data = new FormData();
        data.set('formId', p.blockId ?? '');
        data.set('source', path);
        data.set('answers', JSON.stringify(asAnswers(values)));
        data.set('website', trap);
        for (const [id, file] of files) data.set(`file:${id}`, file);
        // No content-type header: only the browser knows the boundary.
        res = await fetch('/api/forms', { method: 'POST', body: data });
      } else {
        res = await fetch('/api/forms', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ formId: p.blockId, source: path, answers: values, website: trap }),
        });
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? 'Something went wrong. Please try again.');
      }
      setState('sent');
    } catch (err) {
      setState('idle');
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    }
  }

  const center = p.align === 'center';
  const body =
    state === 'sent' ? (
      <div className="he-fb__done" role="status">
        <p className="he-fb__donetitle">{p.successTitle || 'Thank you — that is with us.'}</p>
        {p.successText && <p className="he-fb__donetext">{p.successText}</p>}
      </div>
    ) : (
      <form onSubmit={next} noValidate className="he-fb__form" aria-label={p.title || p.formName}>
        {steps.length > 1 && (
          <div className="he-fb__progress">
            <p className="he-fb__stepname" aria-live="polite">
              Step {step + 1} of {steps.length}
              {current.title ? ` — ${current.title}` : ''}
            </p>
            <div className="he-fb__bar" aria-hidden="true">
              <span style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
            </div>
          </div>
        )}
        <div className="he-fb__grid">
          {current.fields.map((field) => (
            <Field key={field.id} field={field} uid={uid} value={values[field.id]} onChange={set(field.id)} />
          ))}
        </div>
        {/* A trap for bots: people never see it, so anything typed here is not from a person. */}
        <div aria-hidden="true" className="hidden">
          <label htmlFor={`${uid}-website`}>Website</label>
          <input id={`${uid}-website`} name="website" tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} />
        </div>
        {error && (
          <p role="alert" className="he-fb__error">
            {error}
          </p>
        )}
        <div className={cn('he-fb__actions', center && 'is-center')}>
          {step > 0 && (
            <button type="button" className="he-cbtn is-medium is-outline" onClick={() => (setError(''), setStep(step - 1))}>
              Back
            </button>
          )}
          <button type="submit" className="he-cbtn is-medium is-primary" disabled={state === 'sending'}>
            {state === 'sending' ? 'Sending…' : last ? p.submitLabel || 'Send' : 'Next'}
          </button>
        </div>
      </form>
    );

  return (
    <section className={cn('he-lsec he-fb', TONES[p.tone ?? 'base'], `is-${p.layout}`, center && 'is-center')}>
      <div className="shell">
        {(p.eyebrow || p.title || p.intro) && <BlockHead eyebrow={p.eyebrow} title={p.title} titleAs={p.titleAs} intro={p.intro} align={p.align} className="mb-9" />}
        <div className="he-fb__box">{body}</div>
      </div>
    </section>
  );
}
