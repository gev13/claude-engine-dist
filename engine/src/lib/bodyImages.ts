import { isResizable, widthsFor } from './responsive';

/* ═══════════════════════════════════════════════════════════════════════════
   Pictures inside a post's text (3.22)
   ───────────────────────────────────────────────────────────────────────────
   The editor's HTML carries only `src` and `alt`, so a post's pictures were
   fetched at full size and the page jumped as each arrived. Before the text
   is shown, each library picture gains its stored `width`/`height` (the
   browser reserves the space) and — with responsive images on — a `srcset`
   of the sizes generated beside it and a `sizes` for the article column.
   Pure, so it is tested without a database; the lookup is the caller's.
   ═══════════════════════════════════════════════════════════════════════════ */

export type BodyImageShape = { width: number; height: number };

/** The article column: the full screen on phones, about 760px beside. */
export const BODY_IMAGE_SIZES = '(max-width: 800px) 100vw, 760px';

const IMG = /<img\b[^>]*>/gi;
const attr = (tag: string, name: string) => new RegExp(`\\s${name}\\s*=\\s*"([^"]*)"`, 'i').exec(tag)?.[1];

/** The library addresses a body's pictures use, once each. */
export function bodyImageUrls(html: string): string[] {
  const urls = new Set<string>();
  for (const tag of html.match(IMG) ?? []) {
    const src = attr(tag, 'src');
    if (src && src.startsWith('/media/') && !src.includes('..')) urls.add(src.split(/[?#]/)[0]!);
  }
  return [...urls];
}

export function rewriteBodyImages(html: string, shapes: Map<string, BodyImageShape>, responsive: boolean): string {
  if (shapes.size === 0) return html;
  return html.replace(IMG, (tag) => {
    const src = attr(tag, 'src');
    const shape = src ? shapes.get(src) : undefined;
    if (!src || !shape || !(shape.width > 0) || !(shape.height > 0)) return tag;
    const extra: string[] = [];
    if (attr(tag, 'width') === undefined && attr(tag, 'height') === undefined) {
      extra.push(`width="${Math.round(shape.width)}"`, `height="${Math.round(shape.height)}"`);
    }
    if (responsive && isResizable(src) && attr(tag, 'srcset') === undefined) {
      const widths = widthsFor(shape.width);
      if (widths.length > 0) {
        const set = [...widths.map((w) => `${src}?w=${w} ${w}w`), `${src} ${Math.round(shape.width)}w`].join(', ');
        extra.push(`srcset="${set}"`, `sizes="${BODY_IMAGE_SIZES}"`);
      }
    }
    if (extra.length === 0) return tag;
    return tag.replace(/\s*\/?>$/, (end) => ` ${extra.join(' ')}${end.trim() === '/>' ? ' />' : '>'}`);
  });
}
