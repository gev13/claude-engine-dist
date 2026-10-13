import 'server-only';
import { notFound, permanentRedirect, redirect } from 'next/navigation';
import { withSlash } from '@/lib/permalinks';
import { findRedirect, recordNotFound } from './redirects';

/**
 * What a route does when a path has no content: follow a managed redirect if
 * one matches, otherwise log the miss and render the 404. One copy, shared by
 * the catch-all and the careers routes, so a rule fires the same way whichever
 * route missed.
 *
 * Next emits 307 for `redirect` and 308 for `permanentRedirect` — the
 * method-preserving equivalents of 302 and 301. Search engines treat 308
 * exactly as they treat 301, so the stored 301/302 is the editor's intent and
 * these are the codes that carry it.
 *
 * No referrer is logged: reading `headers()` here would opt the route out of
 * static rendering entirely, and losing ISR on every page is a far worse trade
 * than losing one field on a 404 log entry.
 */
export async function handleMiss(path: string, mainLanguage?: () => Promise<string | null>): Promise<never> {
  const target = await findRedirect(path);
  if (target) {
    const to = withSlash(target.to);
    if (target.status === 301) permanentRedirect(to);
    redirect(to);
  }
  /* 3.30.1 — a page in another language with no translation goes to the main
     language's page, temporarily (the translation may come), rather than a
     404: the links on a page in that language carry its prefix now, and a
     site translated in part must not turn them into dead ends. */
  const fallback = mainLanguage ? await mainLanguage() : null;
  if (fallback) redirect(withSlash(fallback));
  await recordNotFound(path);
  notFound();
}
