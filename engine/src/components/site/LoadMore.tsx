'use client';

import { useState } from 'react';
import { withSlash } from '@/lib/permalinks';

/**
 * "Load more" over a real link to the next page.
 *
 * Without script it is exactly that link. With script, a click fetches the
 * next page's HTML, finds the same list in it (by `id`), appends its items
 * here and moves the link on — so the server's pages stay the single source
 * and nothing about the list is rendered twice in two ways. Focus goes to the
 * first new item, so a keyboard user is not stranded on a button that moved.
 *
 * Any failure — a network error, a page without the list — falls back to
 * following the link, which is what the button said it would do anyway.
 */
export function LoadMore({
  href,
  listId,
  label,
  loadingLabel,
}: {
  href: string;
  listId?: string;
  label: string;
  loadingLabel: string;
}) {
  // In the site's trailing-slash form, like every other link it sits beside.
  const [next, setNext] = useState<string | null>(withSlash(href));
  const [busy, setBusy] = useState(false);

  if (!next) return null;

  async function load(event: React.MouseEvent<HTMLAnchorElement>) {
    if (!listId || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    const list = document.getElementById(listId);
    if (!list) return;
    event.preventDefault();
    setBusy(true);
    try {
      const response = await fetch(next!, { headers: { accept: 'text/html' } });
      if (!response.ok) throw new Error(String(response.status));
      const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
      const incoming = doc.getElementById(listId);
      if (!incoming) throw new Error('no list');
      const added = Array.from(incoming.children).map((child) => document.importNode(child, true));
      added.forEach((child) => list.appendChild(child));
      const following = doc.querySelector<HTMLAnchorElement>(`[data-load-more="${listId}"]`)?.getAttribute('href');
      setNext(following ?? null);
      const first = added[0] as HTMLElement | undefined;
      // A card may be the link itself, or hold one.
      const target = first?.matches('a, button') ? first : first?.querySelector<HTMLElement>('a, button');
      target?.focus({ preventScroll: true });
    } catch {
      window.location.href = next!;
    } finally {
      setBusy(false);
    }
  }

  return (
    <a
      href={next}
      className="he-cbtn is-outline is-medium"
      data-load-more={listId}
      aria-busy={busy || undefined}
      onClick={load}
    >
      {busy ? loadingLabel : label}
    </a>
  );
}
