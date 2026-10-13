'use client';

import { createContext, useContext } from 'react';
import { withLocale, type Locale } from '@/lib/locales';

/* ═══════════════════════════════════════════════════════════════════════════
   3.30.1 — the visitor's language, for the links the engine writes
   ───────────────────────────────────────────────────────────────────────────
   A link is drawn by server and client components alike, and neither is told
   which language the page is in. The site layout knows, so it provides it
   once here and `SiteLink` reads it. Outside the provider (the admin, a test,
   a preview) there is no language and links are left as they are.
   ═══════════════════════════════════════════════════════════════════════════ */

export type LocaleLinks = { locale: Locale; defaultLocale: Locale; locales: Locale[] };

const LocaleLinksContext = createContext<LocaleLinks | null>(null);

export function LocaleLinksProvider({ value, children }: { value: LocaleLinks; children: React.ReactNode }) {
  return <LocaleLinksContext.Provider value={value}>{children}</LocaleLinksContext.Provider>;
}

/** A site path in the page's language (see `withLocale`); anything else unchanged. */
export function useLocaleHref(): (href: string) => string {
  const value = useContext(LocaleLinksContext);
  return (href) => (value ? withLocale(href, value.locale, value) : href);
}
