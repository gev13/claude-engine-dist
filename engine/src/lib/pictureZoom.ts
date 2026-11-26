import { z } from 'zod';

/* ═══════════════════════════════════════════════════════════════════════════
   A picture zoomed and placed in its box (3.37)
   ───────────────────────────────────────────────────────────────────────────
   For a media band's picture and a card's: drawn to cover its box as before,
   then scaled by `imageZoom` (100–300 %) about `imageFocus` — the point that
   also anchors the cover (`object-position`). Each with a value on tablets
   (≤1024px) and phones (≤768px), unset keeping the wider screen's.

   Written as classes and custom properties, read by library-details.css;
   the scale is the `scale` property, so a hover zoom (a transform) still
   adds to it. To match a design that draws the picture W % wide at L % from
   the left: zoom W, focus x = −L / (W − 100) × 100 %.
   ═══════════════════════════════════════════════════════════════════════════ */

const PLACE = '(?:-?(?:\\d+|\\d*\\.\\d+)(?:%|px)|0|left|right|center|top|bottom)';
/** One or two of a percentage, a length in px or a side: `50% 0%`, `left 30%`. */
export const FOCUS = new RegExp(`^${PLACE}(?:\\s+${PLACE})?$`);

const zoom = () => z.number().min(100).max(300).optional();
const focus = () => z.string().trim().max(40).refine((v) => FOCUS.test(v), 'One or two of a percentage, a length or a side, e.g. 50% 0%').optional();

export const pictureZoomFields = {
  imageZoom: zoom(),
  imageZoomTablet: zoom(),
  imageZoomMobile: zoom(),
  imageFocus: focus(),
  imageFocusTablet: focus(),
  imageFocusMobile: focus(),
  /** How the picture fills its box: cut to cover it (unset, as before), whole inside it, or stretched to it. */
  imageFit: z.enum(['cover', 'contain', 'fill']).optional(),
  /** 3.38 — the fit on tablets and phones; each unset keeps the wider screen's. */
  imageFitTablet: z.enum(['cover', 'contain', 'fill']).optional(),
  imageFitMobile: z.enum(['cover', 'contain', 'fill']).optional(),
};

export type PictureZoom = { [K in keyof typeof pictureZoomFields]?: K extends `imageZoom${string}` ? number : K extends `imageFit${string}` ? 'cover' | 'contain' | 'fill' : string };
const FITS = ['cover', 'contain', 'fill'];

const TIERS = [
  ['', 'imageZoom', 'imageFocus'],
  ['-t', 'imageZoomTablet', 'imageFocusTablet'],
  ['-m', 'imageZoomMobile', 'imageFocusMobile'],
] as const;

/** The classes and properties for one picture's host; nothing for nothing set. Every value checked again. */
export function pictureZoom(p: PictureZoom | undefined): { className: string[]; style: Record<string, string> } {
  const className: string[] = [];
  const style: Record<string, string> = {};
  if (!p) return { className, style };
  for (const [suffix, zoomKey, focusKey] of TIERS) {
    const z = p[zoomKey];
    if (typeof z === 'number' && Number.isFinite(z) && z >= 100 && z <= 300) {
      className.push(`has-pz${suffix}`);
      style[`--he-pz${suffix}`] = String(Math.round(z * 100) / 10000);
    }
    const f = p[focusKey];
    if (typeof f === 'string' && FOCUS.test(f.trim())) {
      className.push(`has-pf${suffix}`);
      style[`--he-pf${suffix}`] = f.trim();
    }
  }
  for (const [suffix, key] of [['', 'imageFit'], ['-t', 'imageFitTablet'], ['-m', 'imageFitMobile']] as const) {
    const fit = p[key];
    if (typeof fit === 'string' && FITS.includes(fit)) {
      className.push(`has-pfit${suffix}`);
      style[`--he-pfit${suffix}`] = fit;
    }
  }
  return { className, style };
}
