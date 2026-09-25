'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from '@/components/ui/SiteLink';
import {
  CONSENT_KEY,
  COOKIE_SETTINGS_HASH,
  type Consent,
  type CookieNotice as Notice,
} from '@/lib/cookies';
import { cn } from '@/lib/utils';

/* ═══════════════════════════════════════════════════════════════════════════
   The cookie notice
   ───────────────────────────────────────────────────────────────────────────
   Three rules, and the first is the one everybody breaks.

   **Nothing is stored until somebody answers.** The banner shows when the key
   is absent, so an unanswered visit writes nothing at all. Asking about
   storage by storing something first is the joke about these banners, and it
   is entirely avoidable.

   **It renders nothing on the server.** The answer lives in `localStorage`,
   which a statically rendered page cannot know — so a prerendered banner
   would flash at somebody who answered months ago. It mounts, reads, and only
   then decides, which is the same reason the countdown prints dashes.

   **It is not a modal, except when it is.** A bar or a corner card is an
   announcement: it must not trap focus, and the page behind it stays usable.
   The centred variant *is* modal, so it gets the dialog treatment.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Stamped on `<html>` so anything a site owner adds can read it before it runs. */
function stamp(value: Consent | null) {
  const root = document.documentElement;
  if (value) root.dataset.consent = value;
  else delete root.dataset.consent;
}

function read(): Consent | null {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    return raw === 'accepted' || raw === 'rejected' ? raw : null;
  } catch {
    /* A private window, or site data blocked entirely. The honest response is
       to behave as though nothing was ever answered — never to crash a page
       over a banner. */
    return null;
  }
}

export function CookieNotice({ notice }: { notice: Notice }) {
  // `null` means "not decided yet in this render" — including before mount,
  // which is why nothing is shown until the effect has run.
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!notice.enabled) return;

    const answered = read();
    stamp(answered);

    /* A browser that asks not to be tracked has answered, if the site says it
       honours that. It is recorded so the two agree from then on. */
    if (!answered && notice.respectDoNotTrack && navigator.doNotTrack === '1') {
      try {
        localStorage.setItem(CONSENT_KEY, 'rejected');
      } catch {
        /* Nothing to do: the choice holds for this page either way. */
      }
      stamp('rejected');
      setReady(true);
      return;
    }

    setOpen(answered === null);
    setReady(true);
  }, [notice.enabled, notice.respectDoNotTrack]);

  /* A link to #cookie-settings anywhere on the site reopens the notice —
     the footer link every site of this kind has. */
  useEffect(() => {
    if (!notice.enabled) return;
    const reopen = () => {
      if (window.location.hash === COOKIE_SETTINGS_HASH) setOpen(true);
    };
    reopen();
    window.addEventListener('hashchange', reopen);
    return () => window.removeEventListener('hashchange', reopen);
  }, [notice.enabled]);

  const answer = useCallback((value: Consent) => {
    try {
      localStorage.setItem(CONSENT_KEY, value);
    } catch {
      /* Blocked storage means it will be asked again next time. That is a
         worse experience and the only honest one — pretending it was saved
         would be worse still. */
    }
    stamp(value);
    setOpen(false);
    if (window.location.hash === COOKIE_SETTINGS_HASH) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }, []);

  if (!notice.enabled || !ready || !open) return null;

  const modal = notice.position === 'centre';

  return (
    <>
      {/* The dim is the modal's own, and only the modal has one. */}
      {modal && <div className="he-cookie__scrim" aria-hidden="true" />}
      <section
        className={cn('he-cookie', `is-${notice.position}`)}
        role={modal ? 'dialog' : 'region'}
        aria-modal={modal ? true : undefined}
        aria-label={notice.title || 'Cookies'}
      >
        <div className="he-cookie__text">
          {notice.title && <p className="he-cookie__title">{notice.title}</p>}
          {notice.body && <p className="he-cookie__body">{notice.body}</p>}
          {notice.policyHref && (
            <Link href={notice.policyHref} className="he-cookie__link">
              {notice.policyLabel || 'Cookie policy'}
            </Link>
          )}
        </div>

        <div className="he-cookie__actions">
          {notice.showReject && (
            <button type="button" className="he-btn he-btn--ghost" onClick={() => answer('rejected')}>
              {notice.rejectLabel || 'Reject'}
            </button>
          )}
          <button type="button" className="he-btn he-btn--primary" onClick={() => answer('accepted')} autoFocus>
            {notice.acceptLabel || 'Accept'}
          </button>
        </div>
      </section>
    </>
  );
}
