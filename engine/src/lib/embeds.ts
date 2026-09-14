/* ═══════════════════════════════════════════════════════════════════════════
   Third-party embeds — video players and maps
   ───────────────────────────────────────────────────────────────────────────
   Nothing from a third party loads until a visitor presses play or asks for
   the map; until then the page shows a preview served by the site itself.
   The Content-Security-Policy's frame-src lists exactly EMBED_ORIGINS, and a
   test holds the two together.
   ═══════════════════════════════════════════════════════════════════════════ */

export const EMBED_ORIGINS = [
  'https://www.youtube-nocookie.com',
  'https://player.vimeo.com',
  'https://www.openstreetmap.org',
  'https://www.google.com',
] as const;

export type VideoSource =
  | { kind: 'file'; src: string }
  | { kind: 'youtube'; id: string }
  | { kind: 'vimeo'; id: string; hash?: string };
export type HostedVideo = Exclude<VideoSource, { kind: 'file' }>;

export const VIDEO_HOST_LABEL: Record<HostedVideo['kind'], string> = { youtube: 'YouTube', vimeo: 'Vimeo' };

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
/** An uploaded video: a site path with a video extension. The CSP plays media only from the site itself. */
const VIDEO_FILE = /^\/[A-Za-z0-9._~\-/%]+\.(?:mp4|webm|m4v|mov)$/i;

/** Reads a YouTube or Vimeo link in its usual shapes, or an uploaded video's path. Anything else is null. */
export function parseVideoUrl(input: string): VideoSource | null {
  const value = input.trim();
  if (VIDEO_FILE.test(value)) return value.includes('..') ? null : { kind: 'file', src: value };

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  const host = url.hostname.replace(/^(?:www|m)\./, '');

  if (host === 'youtu.be' || host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const id =
      host === 'youtu.be'
        ? url.pathname.slice(1)
        : url.pathname === '/watch'
          ? url.searchParams.get('v')
          : /^\/(?:embed|shorts|live)\/([^/]+)/.exec(url.pathname)?.[1];
    return id && YOUTUBE_ID.test(id) ? { kind: 'youtube', id } : null;
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    // An unlisted video carries a privacy hash after its id.
    const match = /^\/(?:video\/)?(\d{6,12})(?:\/([0-9a-f]{6,20}))?\/?$/.exec(url.pathname);
    if (!match?.[1]) return null;
    return match[2] ? { kind: 'vimeo', id: match[1], hash: match[2] } : { kind: 'vimeo', id: match[1] };
  }
  return null;
}

/** The player to load once a visitor presses play. YouTube plays from its no-cookie domain. */
export function videoEmbedUrl(video: HostedVideo): string {
  if (video.kind === 'youtube') return `https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&rel=0`;
  return `https://player.vimeo.com/video/${video.id}?autoplay=1&dnt=1${video.hash ? `&h=${video.hash}` : ''}`;
}

export type MapPlace = { provider: 'openstreetmap' | 'google'; address: string; lat?: number; lng?: number; zoom: number };

export const MAP_PROVIDER_LABEL = { openstreetmap: 'OpenStreetMap', google: 'Google Maps' } as const;

/** The embeddable map, or null when OpenStreetMap has no coordinates to centre on. */
export function mapEmbedUrl({ provider, address, lat, lng, zoom }: MapPlace): string | null {
  if (provider === 'google') {
    const query = lat !== undefined && lng !== undefined ? `${lat},${lng}` : address;
    return `https://www.google.com/maps?q=${encodeURIComponent(query)}&z=${zoom}&output=embed`;
  }
  if (lat === undefined || lng === undefined) return null;
  // A 256px tile spans 360 / 2^zoom degrees of longitude; show about three tiles across.
  const dx = (360 / 2 ** zoom) * 1.5;
  const dy = dx * 0.5 * Math.cos((lat * Math.PI) / 180);
  const bbox = [lng - dx, lat - dy, lng + dx, lat + dy].map((n) => n.toFixed(5)).join(',');
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${encodeURIComponent(`${lat},${lng}`)}`;
}

/** A link that opens the place on the provider's own site, for directions. */
export function mapLinkUrl({ provider, address, lat, lng, zoom }: MapPlace): string {
  const point = lat !== undefined && lng !== undefined;
  if (provider === 'google') {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(point ? `${lat},${lng}` : address)}`;
  }
  return point
    ? `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=${zoom}/${lat}/${lng}`
    : `https://www.openstreetmap.org/search?query=${encodeURIComponent(address)}`;
}
