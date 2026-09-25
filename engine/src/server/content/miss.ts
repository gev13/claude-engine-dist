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
export async function handleMiss(path: string): Promise<never> {
  const target = await findRedirect(path);
  if (target) {
    const to = withSlash(target.to);
    if (target.status === 301) permanentRedirect(to);
    redirect(to);
  }
  await recordNotFound(path);
  notFound();
}
