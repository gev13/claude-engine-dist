import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

/**
 * Edge middleware. Two jobs only:
 *   1. keep unauthenticated traffic out of /admin before any admin code runs;
 *   2. stamp a request id used by the audit log.
 *
 * It is a gate, not the authorisation control — every admin route and API
 * handler re-checks the session and the permission server-side.
 */

const ACCESS_COOKIE = 'he_at';
const PUBLIC_ADMIN_PATHS = ['/admin/login', '/admin/two-factor', '/admin/forgot', '/admin/reset'];

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

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
