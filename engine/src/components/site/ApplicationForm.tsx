'use client';

import { useId, useRef, useState } from 'react';
import { useChallenge } from '@/components/site/Captcha';
import { FileDrop } from '@/components/site/FileDrop';
import { useMessages } from '@/components/site/Messages';
import Link from '@/components/ui/SiteLink';
import { cn } from '@/lib/utils';

/* ═══════════════════════════════════════════════════════════════════════════
   Applying for a role
   ───────────────────────────────────────────────────────────────────────────
   Deliberately the form block's own classes (`he-fb__*`) rather than a second
   set: this should look like every other form on the site, and a careers page
   that styles its inputs differently reads as a bolted-on third-party widget.

   It posts `multipart/form-data`, because it carries a file. The size and
   type are checked here so somebody who picks a 40 MB scan is told instantly
   rather than after uploading it, and checked again on the server by the
   file's actual bytes, because a check in the browser is a courtesy and never
   a control.

   3.29 — every word is a `careers.*` message, so the form reads in the page's
   language; and Appearance → Careers can put the words inside the fields, the
   CV in a drop zone and two buttons under the thanks.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Mirrors `CV_MAX_BYTES` and `ALLOWED_CV_EXTENSIONS` in server/applications/storage.ts. */
const MAX_BYTES = 8 * 1024 * 1024;
const EXTENSIONS = ['pdf', 'docx'] as const;
const ACCEPT = '.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

type State = 'idle' | 'sending' | 'sent';

export function ApplicationForm({
  jobId,
  jobTitle,
  privacyPath,
  placeholders = false,
  dropZone = false,
  doneLinks,
}: {
  jobId: string;
  jobTitle: string;
  /** A link to the privacy notice, when the site has one. */
  privacyPath?: string | null;
  /** 3.29 — the words inside the fields rather than above them. */
  placeholders?: boolean;
  /** 3.29 — the CV as a drop zone. */
  dropZone?: boolean;
  /** 3.29 — "Back to the homepage" and "Explore other jobs" under the thanks. */
  doneLinks?: { home: string; careers: string };
}) {
  const uid = useId();
  const [state, setState] = useState<State>('idle');
  const [error, setError] = useState('');
  const [cvName, setCvName] = useState('');
  const t = useMessages();
  const challenge = useChallenge('careers');
  const formRef = useRef<HTMLFormElement>(null);

  /** The CV's type and size, checked as it is chosen; false refuses it. */
  function checkCv(file: File | null): boolean {
    setError('');
    if (!file) {
      setCvName('');
      return true;
    }
    const extension = (file.name.split('.').pop() ?? '').toLowerCase();
    if (!(EXTENSIONS as readonly string[]).includes(extension)) {
      setError(t('careers.cvType'));
      setCvName('');
      return false;
    }
    if (file.size > MAX_BYTES) {
      setError(t('careers.cvSize'));
      setCvName('');
      return false;
    }
    setCvName(file.name);
    return true;
  }

  function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    if (!checkCv(event.target.files?.[0] ?? null)) event.target.value = '';
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === 'sending') return;

    const form = event.currentTarget;
    const data = new FormData(form);
    data.set('jobId', jobId);

    const cv = data.get('cv');
    if (!(cv instanceof File) || cv.size === 0) {
      setError(t('careers.cvNeeded'));
      return;
    }

    const token = await challenge.token();
    if (token === false) {
      setError(t('captcha.required'));
      return;
    }
    if (token) data.set('captcha', token);

    setError('');
    setState('sending');

    try {
      /* No `content-type` header: the browser has to set it, because only it
         knows the multipart boundary it generated. */
      const response = await fetch('/api/applications', { method: 'POST', body: data });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? t('form.error'));
      }
      setState('sent');
    } catch (caught) {
      challenge.reset();
      setState('idle');
      setError(caught instanceof Error ? caught.message : t('form.error'));
    }
  }

  if (state === 'sent') {
    return (
      <div className={cn('he-fb__done', doneLinks && 'is-plain')} role="status">
        <p className="he-fb__donetitle">{t('careers.thanksTitle')}</p>
        <p className="he-fb__donetext">{t('careers.thanksText', { title: jobTitle })}</p>
        {doneLinks && (
          <div className="he-fb__donebtns">
            <Link href={doneLinks.home} className="he-cbtn is-medium is-outline">
              {t('careers.backHome')}
            </Link>
            <Link href={doneLinks.careers} className="he-cbtn is-medium is-primary">
              <span>{t('careers.otherJobs')}</span>
            </Link>
          </div>
        )}
      </div>
    );
  }

  /** A field's label: above it (as before), or for screen readers only when its words are inside it. */
  const label = (id: string, text: string, optional = false) => (
    <label className={placeholders ? 'he-fb__label sr-only' : 'he-fb__label'} htmlFor={`${uid}-${id}`}>
      {text}
      {optional && <span className="he-fb__opt">{` (${t('form.optional')})`}</span>}
    </label>
  );
  const hint = (text: string) => (placeholders ? text : undefined);

  return (
    <form
      ref={formRef}
      onSubmit={submit}
      noValidate
      className={cn('he-fb__form', placeholders && 'is-placeholders')}
      aria-label={t('careers.applyFor', { title: jobTitle })}
      encType="multipart/form-data"
    >
      {placeholders && <p className="he-fb__label he-apply__group">{t('careers.contact')}</p>}
      <div className={cn('he-fb__grid', placeholders && 'he-apply__grid')}>
        <div className="he-fb__field is-half">
          {label('name', t('careers.name'))}
          <input id={`${uid}-name`} name="name" required autoComplete="name" className="he-fb__input" placeholder={hint(t('careers.name'))} />
        </div>

        <div className="he-fb__field is-half">
          {label('email', t('careers.email'))}
          <input id={`${uid}-email`} name="email" type="email" required autoComplete="email" className="he-fb__input" placeholder={hint(t('careers.email'))} />
        </div>

        <div className="he-fb__field is-half">
          {label('phone', t('careers.phone'), true)}
          <input id={`${uid}-phone`} name="phone" type="tel" autoComplete="tel" className="he-fb__input" placeholder={hint(t('careers.phone'))} />
        </div>

        {!dropZone && (
          <div className="he-fb__field is-half">
            <label className="he-fb__label" htmlFor={`${uid}-cv`}>
              {t('careers.cv')}
            </label>
            <input id={`${uid}-cv`} name="cv" type="file" required accept={ACCEPT} onChange={onFile} className="he-fb__input he-apply__file" aria-describedby={`${uid}-cv-help`} />
            <p id={`${uid}-cv-help`} className="he-fb__help">
              {cvName ? t('form.attached', { name: cvName }) : t('careers.cvHint')}
            </p>
          </div>
        )}

        <div className="he-fb__field">
          {label('letter', t('careers.letter'), true)}
          <textarea
            id={`${uid}-letter`}
            name="coverLetter"
            rows={placeholders ? 4 : 6}
            maxLength={8000}
            className="he-fb__input"
            placeholder={placeholders ? t('careers.letter') : t('careers.letterPlaceholder')}
          />
        </div>

        {dropZone && (
          <div className="he-fb__field he-apply__cv">
            <label className="he-fb__label" htmlFor={`${uid}-cv`}>
              {t('careers.cv')}
            </label>
            <FileDrop id={`${uid}-cv`} name="cv" required accept={ACCEPT} dropText={t('careers.dropCv')} hint={t('careers.cvHint')} onFile={checkCv} />
          </div>
        )}
      </div>

      {/* The honeypot. Hidden from people and from screen readers; anything
          that fills it in is a script, and the server discards the request
          without saying so. */}
      <div aria-hidden="true" className="he-apply__trap">
        <label htmlFor={`${uid}-website`}>Website</label>
        <input id={`${uid}-website`} name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {challenge.field}

      {error && (
        <p className="he-fb__error" role="alert">
          {error}
        </p>
      )}

      <div className={cn('he-fb__actions', placeholders && 'he-apply__actions')}>
        <button type="submit" className="he-btn he-btn-primary" disabled={state === 'sending'}>
          {state === 'sending' ? t('form.sending') : t('careers.send')}
        </button>
      </div>

      <p className="he-fb__help he-apply__note">
        {t('careers.stored')}
        {privacyPath ? (
          <>
            {' '}
            <a href={privacyPath} className="he-link">
              {t('careers.privacy')}
            </a>
            .
          </>
        ) : null}
      </p>
    </form>
  );
}
