'use client';

import type { MessageKey } from '@/lib/messages';
import { useMessages } from './Messages';

/**
 * One message, in the reader's language, for a server component that has no
 * `t` of its own and must stay synchronous — the Card's "Read more" (2.22.1).
 * Reads the same context every client block does; outside a page it falls
 * back to the default words, like `useMessages`.
 */
export function MessageText({ k }: { k: MessageKey }) {
  const t = useMessages();
  return <>{t(k)}</>;
}
