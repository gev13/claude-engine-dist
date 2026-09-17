import type { NextConfig } from 'next';

const isProd = process.env.NODE_ENV === 'production';

/**
 * Content-Security-Policy.
 * TinyMCE is self-hosted from /tinymce and needs 'unsafe-inline' for the styles
 * it injects into its editor chrome. Next's inline bootstrap needs
 * 'unsafe-inline' for scripts in dev; in production it is nonce-free but
 * restricted to 'self'.
 */
/* Google Analytics, and only Google Analytics.
   
   Listed unconditionally because the CSP is static while the analytics id is
   a setting somebody changes in the admin. That is not as loose as it looks:
   a host being *permitted* loads nothing — the only thing that ever points at
   these is `/analytics.js`, which the engine writes and which returns a
   comment when no id is set. Nothing else in the site references them. */
const GA_SCRIPT = 'https://www.googletagmanager.com';
const GA_BEACON = 'https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com';

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${GA_SCRIPT}${isProd ? '' : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  `img-src 'self' data: blob: ${GA_BEACON}`,
  "media-src 'self' blob:",
  `connect-src 'self' ${GA_BEACON}`,
  // Video players and maps, loaded only when a visitor asks (src/lib/embeds.ts).
  "frame-src https://www.youtube-nocookie.com https://player.vimeo.com https://www.openstreetmap.org https://www.google.com",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  'upgrade-insecure-requests',
].join('; ');

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
      { source: '/:path*', headers: securityHeaders },
      { source: '/admin/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] },
      { source: '/api/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] },
    ];
  },
};

export default nextConfig;
