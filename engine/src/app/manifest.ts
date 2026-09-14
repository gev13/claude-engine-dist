import type { MetadataRoute } from 'next';
import { getSiteSettings } from '@/server/content/siteSettings';

export const revalidate = 3600;

/**
 * The web app manifest, served at /manifest.webmanifest.
 *
 * Generated rather than a file in `public/`, because the name and description
 * are Settings: a static manifest carried whichever site it was written for.
 * Next links it from every page on its own.
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const s = await getSiteSettings();
  return {
    name: s.name,
    short_name: s.name,
    description: s.description,
    start_url: '/',
    display: 'standalone',
    background_color: '#201e1d',
    theme_color: '#201e1d',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  };
}
