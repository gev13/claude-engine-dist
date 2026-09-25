import type { NextConfig } from 'next';
import { buildCsp } from './src/lib/csp';

const isProd = process.env.NODE_ENV === 'production';

/**
 * Content-Security-Policy.
 *
 * Built by `buildCsp` (src/lib/csp.ts), the one builder every policy uses.
 * This file sets the admin's and the band probe's, which never change. The
 * public site's is set by the middleware, per request, because it grows with
 * the integrations and CAPTCHA an administrator switches on (2.16) — so the
 * public rule below deliberately carries **no** CSP: two policies on one
 * response are enforced as their intersection.
 */
const csp = buildCsp({ isProd });

/* The one route that may be framed, and only by this site.
   ───────────────────────────────────────────────────────────────────────────
   `/admin/band/<type>` renders a single demo block so the Design panel can
   *measure* the padding that block already has. Measuring means a real
   viewport — media queries answer to one — so the panel loads it in a hidden
   iframe sized to each breakpoint, which `frame-ancestors 'none'` forbids.

   The exception is narrow on purpose, and it is worth stating why framing this
   is not worth a clickjacker's time: the route is behind the admin gate, it
   renders demo content rather than the site's, and it has no form, no control
   and no action to trick anybody into clicking. `'self'` keeps it framable
   only from this origin. Nothing else moves — `tests/securityHeaders.test.ts`
   fails if `frame-ancestors 'none'` stops applying to any other path. */
export const BAND_PROBE_PATH = '/admin/band';

/* The probe, which may be framed by this origin. */
const probeCsp = buildCsp({ isProd, frameAncestors: "'self'" });

/* The admin, which is the thing doing the framing.
   ───────────────────────────────────────────────────────────────────────────
   `frame-ancestors` says who may frame *me*; `frame-src` says what *I* may
   frame. Relaxing only the first left the Design panel unable to load a page
   from its own origin, so the spacing it measures silently came back empty —
   a policy failure that looks exactly like a feature that does not work.
   Public pages keep the narrow list: only the admin frames anything of ours. */
const adminCsp = buildCsp({ isProd, frameSelf: true });

const withCsp = (value: string, frameOptions?: string) =>
  securityHeaders.map((header) =>
    header.key === 'Content-Security-Policy'
      ? { key: header.key, value }
      : header.key === 'X-Frame-Options' && frameOptions
        ? { key: header.key, value: frameOptions }
        : header,
  );

const NOINDEX = { key: 'X-Robots-Tag', value: 'noindex, nofollow' };

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  ...(isProd
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }]
    : []),
];

const nextConfig: NextConfig = {
  /* Pinned to this directory. Left to infer it, Next walks upwards and picks
     the first lockfile it finds — a stray package-lock.json in a parent or home
     directory then becomes the tracing root, which warns on every build and
     can leave files out of a standalone deployment. */
  outputFileTracingRoot: __dirname,
  reactStrictMode: true,
  poweredByHeader: false,
  /* The trailing slash is a setting (Settings → Permalinks), so the middleware
     puts every address in the site's form. Next's own redirect is decided at
     build time and would fight it — stripping the slash a site asked for. */
  skipTrailingSlashRedirect: true,
  compress: true,
  serverExternalPackages: ['argon2', 'postgres', 'sharp'],
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [360, 480, 640, 828, 1080, 1200, 1600, 1920],
  },
  experimental: {
    optimizePackageImports: ['date-fns'],
    /* The router keeps a rendered page in memory and reuses it on the next
       navigation — thirty seconds by default for a dynamic segment and five
       minutes for a static one. That is invisible and indistinguishable from
       a browser cache to the person who just saved a page and clicked back to
       it, so the site fetches instead. The browser's own HTTP cache still
       answers with a 304 where nothing changed. */
    staleTimes: { dynamic: 0, static: 0 },
  },
  async headers() {
    return [
      /* Three policies, on sources that cannot both match one path.
         
         Overlap is the trap here, not omission: two rules matching a path
         send two `Content-Security-Policy` headers, and a browser then
         enforces the *intersection* of them — so a relaxation written as a
         second rule layered on top does nothing at all, silently.
         `tests/securityHeaders.test.ts` asserts exactly one matches. */
      { source: '/admin/band/:path*', headers: [...withCsp(probeCsp, 'SAMEORIGIN'), NOINDEX] },
      { source: '/admin/((?!band$|band/).*)', headers: [...withCsp(adminCsp), NOINDEX] },
      { source: '/admin', headers: [...withCsp(adminCsp), NOINDEX] },
      // No CSP here: the middleware sets the public policy per request (2.16).
      { source: '/((?!admin$|admin/).*)', headers: securityHeaders.filter((header) => header.key !== 'Content-Security-Policy') },
      { source: '/api/:path*', headers: [NOINDEX] },
    ];
  },
};

export default nextConfig;
