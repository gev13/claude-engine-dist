/* ═══════════════════════════════════════════════════════════════════════════
   Pictures for the image sitemap (3.19)
   ───────────────────────────────────────────────────────────────────────────
   Settings → "List pictures in the sitemap" gives every address the pictures
   shown on it. They are found by walking whatever holds the content — a block
   tree, a post's HTML, a cover URL — for this site's own media addresses, so
   a new block type with a picture in it is covered the day it is added.

   Pure: the server reads the rows and hands them in.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Google reads at most 1,000 pictures per address. */
export const MAX_SITEMAP_IMAGES = 1000;

const IMAGE_PATH = /^\/media\/[^\s"'<>?#]+\.(?:png|jpe?g|webp|gif|avif|svg)$/i;
const IMG_SRC = /<img\b[^>]*?\bsrc\s*=\s*["']([^"']+)["']/gi;

/** A media address as a site path, without its size query (`?w=`); null for anything else. */
export function mediaImagePath(value: string, siteUrl = ''): string | null {
  let path = value.trim();
  if (siteUrl && path.startsWith(`${siteUrl}/`)) path = path.slice(siteUrl.length);
  path = path.replace(/[?#].*$/, '');
  return IMAGE_PATH.test(path) ? path : null;
}

/** A block switched off in its Design tab is not on the page, so neither are its pictures. */
const isDisabledBlock = (value: Record<string, unknown>) =>
  typeof value.type === 'string' && (value.style as { disabled?: unknown } | undefined)?.disabled === true;

/**
 * Every picture in `sources`, in the order found, each once. A source may be
 * a block tree, any JSON, an HTML string or a single address.
 */
export function collectImages(sources: unknown[], siteUrl = '', max = MAX_SITEMAP_IMAGES): string[] {
  const found = new Set<string>();
  const add = (candidate: string) => {
    const path = mediaImagePath(candidate, siteUrl);
    if (path && found.size < max) found.add(path);
  };
  const visit = (value: unknown, depth: number): void => {
    if (found.size >= max || depth > 40 || value == null) return;
    if (typeof value === 'string') {
      if (value.includes('<img')) for (const match of value.matchAll(IMG_SRC)) add(match[1]);
      else add(value);
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) visit(item, depth + 1);
      return;
    }
    if (typeof value === 'object') {
      const record = value as Record<string, unknown>;
      if (isDisabledBlock(record)) return;
      for (const item of Object.values(record)) visit(item, depth + 1);
    }
  };
  for (const source of sources) visit(source, 0);
  return [...found];
}
