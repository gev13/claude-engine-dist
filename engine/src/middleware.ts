import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { localeConfig, splitLocale } from '@/lib/locales';

/**
 * Edge middleware. Three jobs only:
 *   1. keep unauthenticated traffic out of /admin before any admin code runs;
 *   2. stamp a request id used by the audit log;
 *   3. put every public request on a locale (package 8).
 *
 * It is a gate, not the authorisation control — every admin route and API
 * handler re-checks the session and the permission server-side.
 *
 * The locale work is deliberately the only routing this file does, and it
 * needs no database: `lib/locales.ts` imports nothing, because the Edge
 * runtime cannot reach Postgres.
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
    await jwtVerify(token, secret, { issuer: 'house-edge', audience: 'house-edge-admin' });
    return true;
  } catch {
    return false;
  }
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

  /* ── Locale ──────────────────────────────────────────────────────────────
     The route tree lives under `[locale]`, so an unprefixed path is rewritten
     rather than redirected: the address bar keeps saying `/about` while the
     router sees `/en/about`. A *prefixed* default locale is the opposite —
     `/en/about` really is a second address for the same page, so it redirects
     away permanently. */
  if (!isReserved(pathname)) {
    /* Read per request: `ENGINE_LOCALES` can change when somebody adds a
       language in Settings, and the Edge runtime genuinely does see the new
       value after a restart — measured rather than assumed. */
    const config = localeConfig();
    const { locale, rest, prefixed } = splitLocale(pathname, config);

    if (prefixed && locale === config.defaultLocale) {
      const url = request.nextUrl.clone();
      url.pathname = rest;
      return NextResponse.redirect(url, 308);
    }

    /* The route tree lives under [locale], so even a single-language site is
       rewritten — it simply never sees a prefix in the address bar. */
    if (!prefixed) {
      const url = request.nextUrl.clone();
      url.pathname = rest === '/' ? `/${config.defaultLocale}` : `/${config.defaultLocale}${rest}`;
      return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
    }
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/api/admin/:path*',
    /* Everything else, so a public request can be put on a locale — except
       Next's internals, the API, uploaded media, and anything with a file
       extension (robots.txt, the sitemaps, images). */
    '/((?!_next/|api/|media/|.*\\.[A-Za-z0-9]+$).*)',
  ],
};
