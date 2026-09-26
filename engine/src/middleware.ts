import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { ACCESS_AUDIENCE, ACCESS_ISSUER } from '@/lib/accessToken';
import { localeConfig, splitLocale } from '@/lib/locales';
import { withSlash, feedTarget } from '@/lib/permalinks';
import { pickRule } from '@/lib/redirectRules';
import { routingConfig } from '@/server/routing/config';
import { countHit } from '@/server/routing/hits';
import { CONSENT_COUNTRIES, REGION_COOKIE } from '@/lib/cookies';

/**
 * Middleware. Five jobs:
 *   1. keep unauthenticated traffic out of /admin before any admin code runs;
 *   2. stamp a request id used by the audit log;
 *   3. put every public request on a locale (package 8);
 *   4. put every public address in the site's trailing-slash form (2.13);
 *   5. apply the redirect rules that match a query, `/?s=*` (2.13).
 *
 * It is a gate, not the authorisation control — every admin route and API
 * handler re-checks the session and the permission server-side.
 *
 * **It runs on Node, not the Edge runtime, since 2.13.** The trailing-slash
 * mode and the query rules are settings, and the Edge runtime cannot reach
 * Postgres; `routingConfig()` reads them once per fifteen seconds and never
 * throws. The locale list still comes from the environment, as before.
 */

const ACCESS_COOKIE = 'he_at';
const PUBLIC_ADMIN_PATHS = ['/admin/login', '/admin/two-factor', '/admin/forgot', '/admin/reset'];

/**
 * Paths that are not site content and must never gain a locale prefix.
 *
 * Getting this list wrong is how `/robots.txt` becomes `/en/robots.txt` and
 * quietly stops existing, so it is written out rather than inferred.
 */
const RESERVED_PREFIXES = ['/admin', '/api', '/install', '/preview', '/media', '/_next', '/sitemaps'];
const RESERVED_FILES = ['/robots.txt', '/sitemap.xml', '/llms.txt', '/manifest.webmanifest', '/favicon.ico'];

function isReserved(pathname: string): boolean {
  if (RESERVED_FILES.includes(pathname)) return true;
  return RESERVED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

const secret = new TextEncoder().encode(
  process.env.AUTH_ACCESS_SECRET ?? 'dev-only-access-secret-change-me-32-chars-min',
);

async function hasValidAccess(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    await jwtVerify(token, secret, { issuer: ACCESS_ISSUER, audience: ACCESS_AUDIENCE });
    return true;
  } catch {
    return false;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   What a browser is allowed to reuse
   ───────────────────────────────────────────────────────────────────────────
   Next's own default for a revalidating page is `s-maxage=<n>,
   stale-while-revalidate=31536000` — a year of serving a stale copy at any
   cache that honours it, and nothing at all addressed to the browser. So an
   editor changed a page, the server rebuilt it correctly, and their own
   browser went on showing yesterday's copy with no way to say otherwise.

   This says the two things separately, because they are two different
   audiences:

     • `max-age=0, must-revalidate` — the *browser* may keep the copy but must
       ask before reusing it. A 304 costs one round trip and nothing else, and
       it means "save" and "refresh" mean what everybody assumes they mean.
     • `s-maxage`/`stale-while-revalidate` — a CDN in front of the site may
       serve for five minutes, and may serve a stale copy for one more minute
       while it fetches. A minute, not a year: the point of a short window is
       that a purge is the exception, not the mechanism.
   ═══════════════════════════════════════════════════════════════════════════ */
const PAGE_CACHE = 'public, max-age=0, must-revalidate, s-maxage=300, stale-while-revalidate=60';

/**
 * Where the visitor is, as far as the consent manager needs to know: in a
 * country that requires consent, or not. Only from a header a CDN in front of
 * the site sets (Cloudflare, Vercel) — never guessed — and only when it
 * changed, so a visitor without one gets no cookie at all.
 */
function markRegion(request: NextRequest, response: NextResponse) {
  const country = (request.headers.get('cf-ipcountry') ?? request.headers.get('x-vercel-ip-country') ?? '').toUpperCase();
  if (!/^[A-Z]{2}$/.test(country) || country === 'XX' || country === 'T1') return;
  const region = CONSENT_COUNTRIES.has(country) ? 'required' : 'other';
  if (request.cookies.get(REGION_COOKIE)?.value === region) return;
  response.cookies.set(REGION_COOKIE, region, { path: '/', sameSite: 'lax', maxAge: 60 * 60 * 24 * 30, secure: request.nextUrl.protocol === 'https:' });
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-request-id', crypto.randomUUID());

  if (pathname.startsWith('/admin') && !PUBLIC_ADMIN_PATHS.some((p) => pathname.startsWith(p))) {
    const authed = await hasValidAccess(request.cookies.get(ACCESS_COOKIE)?.value);
    if (!authed) {
      const url = request.nextUrl.clone();
      url.pathname = '/admin/login';
      url.search = `?next=${encodeURIComponent(pathname + search)}`;
      return NextResponse.redirect(url);
    }
  }

  // A signed-in user landing on the login page goes to the dashboard.
  if (pathname === '/admin/login') {
    if (await hasValidAccess(request.cookies.get(ACCESS_COOKIE)?.value)) {
      const url = request.nextUrl.clone();
      url.pathname = '/admin';
      url.search = '';
      return NextResponse.redirect(url);
    }
  }

  /* ── Locale, slash, query rules ──────────────────────────────────────────
     The route tree lives under `[locale]`, so an unprefixed path is rewritten
     rather than redirected: the address bar keeps saying `/about` while the
     router sees `/en/about`. A *prefixed* default locale is the opposite —
     `/en/about` really is a second address for the same page, so it redirects
     away permanently. */
  if (!isReserved(pathname)) {
    /* Read per request: `ENGINE_LOCALES` can change when somebody adds a
       language in Settings, and the runtime genuinely does see the new value
       after a restart — measured rather than assumed. */
    const config = localeConfig();
    const { locale, rest, prefixed } = splitLocale(pathname, config);
    const routing = await routingConfig();
    const mode = routing.permalinks.trailingSlash;

    /* One public spelling per address. `next.config.ts` turns Next's own
       slash redirect off (`skipTrailingSlashRedirect`), because it is decided
       at build time and this is a setting; so it is done here, in one hop
       with the locale redirect. `never` is what Next used to do (a 308 to the
       bare path), `always` is a 301 to the slashed one. */
    const publicPath = prefixed && locale !== config.defaultLocale ? `/${locale}${rest === '/' ? '' : rest}` : rest;
    const canonical = mode === 'always' ? withSlash(publicPath, 'always') : publicPath;
    const wrongLocale = prefixed && locale === config.defaultLocale;
    if (wrongLocale || (pathname !== canonical && pathname !== '/')) {
      /* Built from scratch, not `nextUrl.clone()`: a NextURL remembers the
         trailing slash it was parsed with and writes it back, which turned
         `/blog/` → `/blog` into a redirect to itself. */
      return NextResponse.redirect(new URL(`${canonical}${search}`, request.url), wrongLocale || mode === 'never' ? 308 : 301);
    }

    /* Redirect rules that match a query run before any route, because the
       path they sit on — `/` for `/?s=term` — is usually live content that
       would otherwise answer. Path-only rules wait for a 404 instead. */
    if (search && routing.queryRules.length > 0) {
      const found = pickRule(routing.queryRules, rest, request.nextUrl.searchParams);
      if (found) {
        countHit(found.rule.id);
        const target = /^https?:/i.test(found.to) ? found.to : new URL(withSlash(found.to, mode), request.url);
        return NextResponse.redirect(target, found.rule.status);
      }
    }

    /* A search of the blog is the one dynamic view of it. Everything else
       under the blog index is resolved by the catch-all route and cached; a
       query goes to a route of its own, so reading it does not make every
       article dynamic. */
    // A feed (2.18) goes to the one feed route, a category's with its slug as the last segment.
    const feed = feedTarget(routing.permalinks, rest);
    const target = feed
      ? feed.category
        ? `/_feed/${feed.category}`
        : '/_feed'
      : rest === routing.permalinks.blogIndex && request.nextUrl.searchParams.has('q')
        ? '/_search'
        : rest;
    const query = feed ? '' : search;

    const internal = target === '/' ? `/${locale}` : `/${locale}${target}`;
    const rewritten = NextResponse.rewrite(new URL(`${internal}${query}`, request.url), {
      request: { headers: requestHeaders },
    });
    rewritten.headers.set('cache-control', PAGE_CACHE);
    /* The public policy is built from what an administrator switched on — a
       tag manager, a pixel, a CAPTCHA — so it is set here, per request,
       rather than fixed in next.config.ts, which sets none for public pages:
       two policies on one response are enforced as their intersection. */
    rewritten.headers.set('content-security-policy', routing.csp);
    markRegion(request, rewritten);
    return rewritten;
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  runtime: 'nodejs',
  /* 3.4.2 — not `/api/admin`: the admin API checks its own session, and the
     middleware had nothing to add there but a request id nobody read. Running
     it cost more than that: Next copies the request body for a middleware,
     and on a live server behind nginx that copy handed an import route an
     upload without its file part (the head of the body, where the file sits,
     never reached the parser). A route no middleware sees reads the body
     exactly as it arrived. */
  matcher: [
    '/admin/:path*',
    /* Everything else, so a public request can be put on a locale — except
       Next's internals, the API, uploaded media, and anything with a file
       extension (robots.txt, the sitemaps, images). */
    '/((?!_next/|api/|media/|.*\\.[A-Za-z0-9]+$).*)',
  ],
};
