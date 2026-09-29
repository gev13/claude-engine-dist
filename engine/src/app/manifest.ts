import type { MetadataRoute } from 'next';
import { getSiteSettings } from '@/server/content/siteSettings';
import { getTheme } from '@/server/content/theme';
import { mediaShape } from '@/server/media/lookup';
import { isColor } from '@/lib/theme';

export const revalidate = 3600;

/** The engine's own colours, for a site that has not set a page colour. */
const DEFAULT_COLOUR = '#201e1d';

/**
 * The web app manifest, served at /manifest.webmanifest.
 *
 * Generated rather than a file in `public/`, because the name and description
 * are Settings: a static manifest carried whichever site it was written for.
 * Next links it from every page on its own.
 *
 * 3.18 — the site's own favicon (Appearance → Brand) and page colour, so a
 * home-screen icon is the site's rather than the engine's mark.
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const [s, theme] = await Promise.all([getSiteSettings(), getTheme()]);
  const favicon = theme.brand?.faviconUrl && /^\/[A-Za-z0-9._~\-/%]*$/.test(theme.brand.faviconUrl) ? theme.brand.faviconUrl : undefined;
  const shape = favicon ? await mediaShape(favicon).catch(() => null) : null;
  const colour = theme.colors?.background && isColor(theme.colors.background) ? theme.colors.background : DEFAULT_COLOUR;
  const type = favicon?.endsWith('.svg') ? 'image/svg+xml' : favicon?.endsWith('.webp') ? 'image/webp' : favicon?.endsWith('.jpg') || favicon?.endsWith('.jpeg') ? 'image/jpeg' : 'image/png';
  return {
    name: s.name,
    short_name: s.name,
    description: s.description,
    start_url: '/',
    display: 'standalone',
    background_color: colour,
    theme_color: colour,
    icons: favicon
      ? [{ src: favicon, sizes: shape ? `${shape.width}x${shape.height}` : 'any', type }]
      : [
          { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
          { src: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
        ],
  };
}
