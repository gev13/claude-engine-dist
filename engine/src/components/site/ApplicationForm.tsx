'use client';

import { useId, useRef, useState } from 'react';
import { useChallenge } from '@/components/site/Captcha';
import { useMessages } from '@/components/site/Messages';
import { cn } from '@/lib/utils';

/* ═══════════════════════════════════════════════════════════════════════════
   Applying for a role
   ───────────────────────────────────────────────────────────────────────────
   Deliberately the form block's own classes (`he-fb__*`) rather than a second
   set: this should look like every other form on the site, and a careers page
   that styles its inputs differently reads as a bolted-on third-party widget.

   It posts `multipart/form-data`, because it carries a file — the only form
   in the engine that does. The size and type are checked here so somebody who
   picks a 40 MB scan is told instantly rather than after uploading it, and
   checked again on the server by the file's actual bytes, because a check in
   the browser is a courtesy and never a control.
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
}: {
  jobId: string;
  jobTitle: string;
  /** A link to the privacy notice, when the site has one. */
  privacyPath?: string | null;
}) {
  const uid = useId();
  const [state, setState] = useState<State>('idle');
  const [error, setError] = useState('');
  const [cvName, setCvName] = useState('');
  const t = useMessages();
  const challenge = useChallenge('careers');
  const formRef = useRef<HTMLFormElement>(null);

  function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setError('');
    if (!file) {
      setCvName('');
      return;
    }

    const extension = (file.name.split('.').pop() ?? '').toLowerCase();
    if (!(EXTENSIONS as readonly string[]).includes(extension)) {
      setError('Please attach a PDF or a Word document (.docx).');
      event.target.value = '';
      setCvName('');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('That file is larger than 8 MB. Try exporting it again at a smaller size.');
      event.target.value = '';
      setCvName('');
      return;
    }

    setCvName(file.name);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === 'sending') return;

    const form = event.currentTarget;
    const data = new FormData(form);
    data.set('jobId', jobId);

    const cv = data.get('cv');
    if (!(cv instanceof File) || cv.size === 0) {
      setError('A CV is needed to apply.');
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
        throw new Error(body.error ?? 'Something went wrong. Please try again.');
      }
      setState('sent');
    } catch (caught) {
      challenge.reset();
      setState('idle');
      setError(caught instanceof Error ? caught.message : 'Something went wrong. Please try again.');
    }
  }

  if (state === 'sent') {
    return (
      <div className="he-fb__done" role="status">
        <p className="he-fb__donetitle">Thank you — your application is with us.</p>
        <p className="he-fb__donetext">
          We have your CV and details for the {jobTitle} role. If it looks like a fit, somebody will be in touch by
          email.
        </p>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      onSubmit={submit}
      noValidate
      className="he-fb__form"
      aria-label={`Apply for ${jobTitle}`}
      encType="multipart/form-data"
    >
      <div className="he-fb__grid">
        <div className="he-fb__field is-half">
          <label className="he-fb__label" htmlFor={`${uid}-name`}>
            Your name
          </label>
          <input id={`${uid}-name`} name="name" required autoComplete="name" className="he-fb__input" />
        </div>

        <div className="he-fb__field is-half">
          <label className="he-fb__label" htmlFor={`${uid}-email`}>
            Email
          </label>
          <input
            id={`${uid}-email`}
            name="email"
            type="email"
            required
            autoComplete="email"
            className="he-fb__input"
          />
        </div>

        <div className="he-fb__field is-half">
          <label className="he-fb__label" htmlFor={`${uid}-phone`}>
            Phone <span className="he-fb__opt">(optional)</span>
          </label>
          <input id={`${uid}-phone`} name="phone" type="tel" autoComplete="tel" className="he-fb__input" />
        </div>

        <div className="he-fb__field is-half">
          <label className="he-fb__label" htmlFor={`${uid}-cv`}>
            Your CV
          </label>
          <input
            id={`${uid}-cv`}
            name="cv"
            type="file"
            required
            accept={ACCEPT}
            onChange={onFile}
            className="he-fb__input he-apply__file"
            aria-describedby={`${uid}-cv-help`}
          />
          <p id={`${uid}-cv-help`} className="he-fb__help">
            {cvName ? `Attached: ${cvName}` : 'PDF or Word (.docx), up to 8 MB.'}
          </p>
        </div>

        <div className="he-fb__field">
          <label className="he-fb__label" htmlFor={`${uid}-letter`}>
            Anything you would like to add <span className="he-fb__opt">(optional)</span>
          </label>
          <textarea
            id={`${uid}-letter`}
            name="coverLetter"
            rows={6}
            maxLength={8000}
            className="he-fb__input"
            placeholder="Why this role, and what you would bring to it."
          />
        </div>
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

      <div className="he-fb__actions">
        <button type="submit" className={cn('he-btn', 'he-btn--primary')} disabled={state === 'sending'}>
          {state === 'sending' ? 'Sending…' : 'Send application'}
        </button>
      </div>

      <p className="he-fb__help he-apply__note">
        Your CV is stored on this site&rsquo;s own server and shared only with the people hiring for this role.
        {privacyPath ? (
          <>
            {' '}
            <a href={privacyPath} className="he-link">
              How we handle your data
            </a>
            .
          </>
        ) : null}
      </p>
    </form>
  );
}
