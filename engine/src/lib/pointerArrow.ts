import { isColor } from './theme';

/* ═══════════════════════════════════════════════════════════════════════════
   3.33 — a round arrow as the pointer itself, generated from a fill, a glyph
   colour and a size: an SVG data address in a `cursor` value, so nothing is
   uploaded. The CSP's img-src already allows `data:`. Browsers refuse cursors
   over 128px, so the size stops at 96.
   ═══════════════════════════════════════════════════════════════════════════ */

const FALLBACK_FILL = '#ffffff';
const FALLBACK_GLYPH = '#000000';

export function arrowCursor(fill?: string, glyph?: string, size?: number): string {
  const box = typeof size === 'number' && size >= 24 && size <= 96 ? Math.round(size) : 48;
  const circle = fill && isColor(fill) ? fill : FALLBACK_FILL;
  const stroke = glyph && isColor(glyph) ? glyph : FALLBACK_GLYPH;
  const half = box / 2;
  // An up-right arrow, drawn at a third of the circle.
  const a = box / 3;
  const b = box - a;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${box}" height="${box}" viewBox="0 0 ${box} ${box}">` +
    `<circle cx="${half}" cy="${half}" r="${half}" fill="${circle}"/>` +
    `<path d="M${a} ${b}L${b} ${a}M${a + box / 12} ${a}H${b}V${b - box / 12}" fill="none" stroke="${stroke}" stroke-width="${Math.max(1.5, box / 28)}" stroke-linecap="round" stroke-linejoin="round"/>` +
    `</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${half} ${half},pointer`;
}
