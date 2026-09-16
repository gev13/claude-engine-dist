'use client';

import { createContext, useContext } from 'react';
import { MESSAGES, type MessageKey, type Messages } from '@/lib/messages';

/* ═══════════════════════════════════════════════════════════════════════════
   The engine's own words, for client components
   ───────────────────────────────────────────────────────────────────────────
   Server components read them directly with `getMessages(locale)`. Client
   components — carousels, forms, the share button — cannot, so the site layout
   provides them once and they read them from context.

   The default is the English catalogue rather than an empty object, so a
   component rendered outside the provider (a test, a preview) says something
   sensible instead of rendering raw keys.
   ═══════════════════════════════════════════════════════════════════════════ */

const MessagesContext = createContext<Messages>(MESSAGES);

export function MessagesProvider({ value, children }: { value: Messages; children: React.ReactNode }) {
  return <MessagesContext.Provider value={value}>{children}</MessagesContext.Provider>;
}

/** `const t = useMessages(); t('form.sending')` */
export function useMessages(): (key: MessageKey) => string {
  const messages = useContext(MessagesContext);
  return (key: MessageKey) => messages[key] ?? MESSAGES[key] ?? key;
}
