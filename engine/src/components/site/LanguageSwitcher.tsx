'use client';

import { useEffect, useRef, useState } from 'react';
import { localeName } from '@/lib/locales';

/* ═══════════════════════════════════════════════════════════════════════════
   Language switcher
   ───────────────────────────────────────────────────────────────────────────
   Where each language's version of *this page* lives is already in the
   document: the `<link rel="alternate" hreflang>` tags the SEO layer emits.
   So the switcher reads them rather than asking the server again — no extra
   request per page view, and it cannot drift out of step with the hreflang
   tags, because it is the same data.

   A language with no translation of this page still appears, pointing at that
   language's home page. Hiding it would leave a reader who wants Armenian with
   nothing to press; sending them to an Armenian page they did not ask for
   would be a lie about what they clicked.
   ═══════════════════════════════════════════════════════════════════════════ */

export function LanguageSwitcher({
  locales,
  current,
  defaultLocale,
}: {
  locales: string[];
  current: string;
  defaultLocale: string;
}) {
  const [open, setOpen] = useState(false);
  const [alternates, setAlternates] = useState<Record<string, string>>({});
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const found: Record<string, string> = {};
    for (const link of document.querySelectorAll<HTMLLinkElement>('link[rel="alternate"][hreflang]')) {
      const code = link.getAttribute('hreflang');
      if (code && code !== 'x-default' && link.href) found[code] = link.href;
    }
    setAlternates(found);
  }, []);

  useEffect(() => {
    if (!open) return;
    const away = (event: MouseEvent) => {
      if (box.current && !box.current.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  if (locales.length < 2) return null;

  /** This page in that language if it exists; that language's home if not. */
  const hrefFor = (code: string) => alternates[code] ?? (code === defaultLocale ? '/' : `/${code}`);

  return (
    // `he-keep` survives the breakpoint that collapses the header's actions.
    <div className="he-lang he-keep" ref={box}>
      <button
        type="button"
        className="he-lang__button"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`Language: ${localeName(current)}`}
        onClick={() => setOpen((was) => !was)}
      >
        <span aria-hidden="true">{current.toUpperCase()}</span>
        <svg className="he-lang__chev" width="10" height="6" viewBox="0 0 10 6" aria-hidden="true">
          <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>

      {open && (
        <ul className="he-lang__list">
          {locales.map((code) => (
            <li key={code}>
              <a
                href={hrefFor(code)}
                className="he-lang__item"
                lang={code}
                hrefLang={code}
                aria-current={code === current ? 'true' : undefined}
              >
                {localeName(code)}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
