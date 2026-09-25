'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from '@/components/ui/SiteLink';
import {
  CONSENT_COOKIE,
  CONSENT_KEY,
  COOKIE_SETTINGS_HASH,
  OPTIONAL_CATEGORIES,
  REGION_COOKIE,
  type Consent,
  type ConsentChoice,
  type CookieNotice as Notice,
  type OptionalCategory,
  choiceKind,
  consentVersion,
  decodeConsent,
  encodeConsent,
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

function NoticeBanner({ notice }: { notice: Notice }) {
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

/* ═══════════════════════════════════════════════════════════════════════════
   The consent manager (T11, 2.16)
   ───────────────────────────────────────────────────────────────────────────
   The same three rules as the notice, and three more:

   **Reject is as easy as accept.** Both on the banner, the same size and
   the same style; "Preferences" beside them, for the categories one by one.

   **The answer is a first-party cookie**, `he_consent`, for the months set
   in the admin, carrying the version it was given to — a changed set of
   categories, or "Ask everyone again", and it no longer counts. The tag
   loader reads the same cookie; the `he:consent` event tells it now.

   **Nothing optional runs before an answer.** That is the loader's half:
   this component only records and announces.
   ═══════════════════════════════════════════════════════════════════════════ */

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? match[1]! : null;
}

function ConsentBanner({ notice }: { notice: Notice }) {
  const version = consentVersion(notice);
  const offered = OPTIONAL_CATEGORIES.filter((key) => notice.categories[key].enabled);
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState(false);
  const [ready, setReady] = useState(false);
  const [choice, setChoice] = useState<ConsentChoice>({ analytics: false, marketing: false, preferences: false });

  useEffect(() => {
    const stored = decodeConsent(readCookie(CONSENT_COOKIE), version);
    const outside = notice.region === 'required' && readCookie(REGION_COOKIE) === 'other';
    if (stored) {
      setChoice(stored);
      document.documentElement.dataset.consent = choiceKind(stored, offered);
    } else if (outside) {
      document.documentElement.dataset.consent = 'accepted';
    }
    setOpen(!stored && !outside);
    setReady(true);
    // `offered` is derived from `notice`, which is the real dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, notice.region]);

  useEffect(() => {
    const reopen = () => {
      if (window.location.hash === COOKIE_SETTINGS_HASH) {
        setOpen(true);
        setDetails(true);
      }
    };
    reopen();
    window.addEventListener('hashchange', reopen);
    return () => window.removeEventListener('hashchange', reopen);
  }, []);

  const save = useCallback(
    (next: ConsentChoice) => {
      const secure = window.location.protocol === 'https:' ? '; Secure' : '';
      document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(encodeConsent(next, version))}; Max-Age=${notice.months * 30 * 86_400}; Path=/; SameSite=Lax${secure}`;
      const kind = choiceKind(next, offered);
      document.documentElement.dataset.consent = kind;
      try {
        // The notice's key too, so anything a site added for the notice keeps reading an answer.
        localStorage.setItem(CONSENT_KEY, kind === 'rejected' ? 'rejected' : 'accepted');
      } catch {
        /* The cookie is what counts. */
      }
      window.dispatchEvent(new CustomEvent('he:consent', { detail: next }));
      if (notice.log) void fetch('/api/consent', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ choice: kind }), keepalive: true }).catch(() => {});
      setChoice(next);
      setOpen(false);
      setDetails(false);
      if (window.location.hash === COOKIE_SETTINGS_HASH) history.replaceState(null, '', window.location.pathname + window.location.search);
    },
    [version, notice.months, notice.log, offered],
  );

  const all = (value: boolean): ConsentChoice => ({
    analytics: value && notice.categories.analytics.enabled,
    marketing: value && notice.categories.marketing.enabled,
    preferences: value && notice.categories.preferences.enabled,
  });

  if (!notice.enabled || !ready || !open) return null;
  const modal = details || notice.position === 'centre';

  return (
    <>
      {modal && <div className="he-cookie__scrim" aria-hidden="true" />}
      <section
        className={cn('he-cookie', details ? 'is-centre is-details' : `is-${notice.position}`)}
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

        {details && (
          <ul className="he-cookie__cats">
            <li>
              <label>
                <input type="checkbox" checked disabled />
                <span>
                  <strong>{notice.categories.necessary.title}</strong>
                  <span>{notice.categories.necessary.description}</span>
                </span>
              </label>
            </li>
            {offered.map((key: OptionalCategory) => (
              <li key={key}>
                <label>
                  <input
                    type="checkbox"
                    checked={choice[key]}
                    onChange={(e) => setChoice((current) => ({ ...current, [key]: e.target.checked }))}
                  />
                  <span>
                    <strong>{notice.categories[key].title}</strong>
                    <span>{notice.categories[key].description}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}

        <div className="he-cookie__actions">
          {details ? (
            <button type="button" className="he-btn he-btn--ghost" onClick={() => save(choice)}>
              {notice.saveLabel || 'Save choices'}
            </button>
          ) : (
            <button type="button" className="he-btn he-btn--ghost" onClick={() => setDetails(true)}>
              {notice.preferencesLabel || 'Preferences'}
            </button>
          )}
          {/* Equally easy: the same size and the same style, side by side. */}
          <button type="button" className="he-btn he-btn--primary" onClick={() => save(all(false))}>
            {notice.rejectLabel || 'Reject all'}
          </button>
          <button type="button" className="he-btn he-btn--primary" onClick={() => save(all(true))} autoFocus>
            {notice.acceptLabel || 'Accept all'}
          </button>
        </div>
      </section>
    </>
  );
}

export function CookieNotice({ notice }: { notice: Notice }) {
  return notice.mode === 'consent' ? <ConsentBanner notice={notice} /> : <NoticeBanner notice={notice} />;
}
