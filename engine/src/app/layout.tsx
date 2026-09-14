import type { Metadata, Viewport } from 'next';
import { SITE_URL } from '@/lib/env';
import { getSiteSettings } from '@/server/content/siteSettings';
import '@/styles/globals.css';

/**
 * Resolved per request rather than at module load: the name, tagline and
 * description are editable in the admin, and a static object would freeze
 * whatever they were when the process started.
 */
export async function generateMetadata(): Promise<Metadata> {
  const s = await getSiteSettings();
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: `${s.tagline} — ${s.name}`, template: `%s — ${s.name}` },
    description: s.description,
    applicationName: s.name,
    authors: [{ name: s.name, url: SITE_URL }],
    creator: s.name,
    publisher: s.name,
    formatDetection: { telephone: false, address: false, email: false },
    icons: {
      icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
      apple: [{ url: '/apple-icon.png' }],
    },
    ...(s.discourageSearchEngines ? { robots: { index: false, follow: false } } : {}),
  };
}

export const viewport: Viewport = {
  themeColor: '#201e1d',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The visitor-preference script in the site layout adds classes and
    // data-scheme to <html> before React hydrates, on purpose, so the page
    // never flashes the wrong motion or colour setting.
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* The two faces above the fold. Preloading them removes the swap
            flash on first paint without delaying anything else. */}
        <link rel="preload" href="/fonts/bricolage-grotesque-var-latin.woff2" as="font" type="font/woff2" crossOrigin="" />
        <link rel="preload" href="/fonts/archivo-var-latin.woff2" as="font" type="font/woff2" crossOrigin="" />
      </head>
      <body>{children}</body>
    </html>
  );
}
