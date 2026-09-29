/* ═══════════════════════════════════════════════════════════════════════════
   www → the bare domain (3.21)
   ───────────────────────────────────────────────────────────────────────────
   Settings → "Redirect www to the bare domain". The middleware asks this for
   every request that arrives on a www host; it answers with the address to
   send the visitor to, or null.

   Only the www form of the site's *own* domain is ever redirected, and only
   to the site's own address (NEXT_PUBLIC_SITE_URL): the Host header is
   whatever the client typed, so it must never choose where a redirect goes.
   A site whose own address is the www form is left alone — sending www to
   the bare domain there would loop against its canonical links.

   Pure, so it can be tested without a request.
   ═══════════════════════════════════════════════════════════════════════════ */

/** The host a request was made to: the proxy's forwarded host first, lower-cased, without a port. */
export function requestHost(headers: { get(name: string): string | null }): string {
  const raw = headers.get('x-forwarded-host') || headers.get('host') || '';
  return raw.split(',')[0]!.trim().toLowerCase().replace(/:\d+$/, '');
}

/**
 * Where a request on `host` should go instead, when the switch is on; null to
 * serve it. `path` and `search` are carried over exactly as they arrived.
 */
export function wwwRedirectTarget(opts: { enabled: boolean; host: string; siteUrl: string; path: string; search: string }): string | null {
  if (!opts.enabled || !opts.host.startsWith('www.')) return null;
  let site: URL;
  try {
    site = new URL(opts.siteUrl);
  } catch {
    return null;
  }
  const own = site.hostname.toLowerCase();
  if (own.startsWith('www.')) return null;
  if (opts.host !== `www.${own}`) return null;
  const path = opts.path.startsWith('/') && !opts.path.startsWith('//') ? opts.path : '/';
  return `${site.protocol}//${site.host}${path}${opts.search}`;
}
