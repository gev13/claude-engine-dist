import { z } from 'zod';

/* ═══════════════════════════════════════════════════════════════════════════
   Corners: rounded, cut on the diagonal (2.21), or rounded on chosen
   corners only (3.29 — `leaf`)
   ───────────────────────────────────────────────────────────────────────────
   A cut corner is a clip-path polygon with the legs written in — cards,
   inputs, chips, images and sections clip. Buttons are *painted* instead
   (`CUT_BUTTON_FILL` and `CUT_BUTTON_RING`, legs as `--he-cut-*` on the button), because a
   clip-path also clips the glow a button may carry.

   A leaf rounds the chosen corners and leaves the others square: a
   four-value radius where a border has to follow the curve, and
   `inset(0 round …)` wherever the shape is a clip.
   ═══════════════════════════════════════════════════════════════════════════ */

export const CORNERS = ['tl', 'tr', 'br', 'bl'] as const;
export type Corner = (typeof CORNERS)[number];

export const CORNER_LABELS: Record<Corner, string> = { tl: 'Top left', tr: 'Top right', br: 'Bottom right', bl: 'Bottom left' };

/** The largest leaf radius; a cut's legs stop at 96. */
export const LEAF_MAX = 200;

export const cornerShapeSchema = z.object({
  /** `rounded` is the radius as before; `cut` clips the chosen corners on the diagonal; `leaf` rounds only the chosen corners. */
  style: z.enum(['rounded', 'cut', 'leaf']).optional(),
  /** The length of each cut's legs, or a leaf's radius, in px (a cut stops at 96). */
  size: z.number().int().min(0).max(LEAF_MAX).optional(),
  /** Which corners are cut or rounded; unset is top right and bottom left. */
  corners: z.array(z.enum(CORNERS)).min(1).max(4).optional(),
  /**
   * 3.34.2 — a size of each corner's own over `size` (a corner given one is
   * shaped even when not among `corners`; 0 squares it), and on phones
   * (≤768px) one size and sizes per corner. On a phone a corner takes, in
   * turn: its phone size, the phone size, its own size, the size. Written by
   * a block's Design tab; elsewhere the per-corner sizes apply and the phone
   * ones are not read.
   */
  sizes: z.lazy(() => cornerSizesSchema).optional(),
  sizeMobile: z.number().int().min(0).max(LEAF_MAX).optional(),
  sizesMobile: z.lazy(() => cornerSizesSchema).optional(),
});

const cornerSize = z.number().int().min(0).max(LEAF_MAX).optional();
const cornerSizesSchema = z.object({ tl: cornerSize, tr: cornerSize, br: cornerSize, bl: cornerSize });

export type CornerShape = z.infer<typeof cornerShapeSchema>;

export const DEFAULT_CUT_CORNERS: Corner[] = ['tr', 'bl'];

export type CutLegs = Record<Corner, number>;

const within = (value: unknown, max: number): number | undefined =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= max ? value : undefined;

/**
 * 3.34.2 — each corner's size, in px, 0 for a square one: the chosen corners
 * at the size, a corner's own size over it, and on a phone the phone sizes
 * over both. Bounded by `max` (96 for a cut, LEAF_MAX for a leaf).
 */
function cornerPx(shape: CornerShape, fallbackSize: number, max: number, phone: boolean): CutLegs {
  const base = within(shape.size, max) ?? fallbackSize;
  const chosen = new Set(shape.corners?.length ? shape.corners : DEFAULT_CUT_CORNERS);
  const out = {} as CutLegs;
  for (const corner of CORNERS) {
    const own = within(shape.sizes?.[corner], max);
    const phoneOwn = phone ? within(shape.sizesMobile?.[corner], max) : undefined;
    const phoneAll = phone ? within(shape.sizeMobile, max) : undefined;
    const shaped = chosen.has(corner) || own !== undefined || phoneOwn !== undefined;
    out[corner] = shaped ? (phoneOwn ?? phoneAll ?? own ?? base) : 0;
  }
  return out;
}

/** 3.34.2 — whether a shape has anything of its own on phones. */
export function hasPhoneCorners(shape: CornerShape | undefined): boolean {
  return Boolean((shape?.style === 'cut' || shape?.style === 'leaf') && (shape.sizeMobile !== undefined || (shape.sizesMobile && Object.values(shape.sizesMobile).some((v) => v !== undefined))));
}

/** 3.34.2 — whether a shape names a size per corner or for phones (a block then writes its radius too). */
export function hasCornerSizes(shape: CornerShape | undefined): boolean {
  return hasPhoneCorners(shape) || Boolean(shape?.sizes && Object.values(shape.sizes).some((v) => v !== undefined));
}

/** A cut shape's four legs, in px; null for a rounded or unset shape. (3.34.2) `phone`: as drawn on phones. */
export function cutLegs(shape: CornerShape | undefined, fallbackSize: number, phone = false): CutLegs | null {
  if (shape?.style !== 'cut') return null;
  return cornerPx(shape, fallbackSize, 96, phone);
}

/**
 * 3.29 — a leaf's four radii in border-radius order (top left, top right,
 * bottom right, bottom left), e.g. `0px 64px 0px 64px`; null for anything
 * that is not a leaf. Bounded here, as `cutLegs` bounds a cut.
 */
export function leafRadii(shape: CornerShape | undefined, fallbackSize: number, phone = false): string | null {
  if (shape?.style !== 'leaf') return null;
  const px = cornerPx(shape, fallbackSize, LEAF_MAX, phone);
  return CORNERS.map((corner) => `${Math.max(0, Math.min(LEAF_MAX, Math.round(px[corner])))}px`).join(' ');
}

/** The clip for a leaf: the box itself, with those corners rounded. */
export function leafClip(radii: string): string {
  return `inset(0 round ${radii})`;
}

/**
 * The clip-path for those legs, with the sizes written in: every element
 * that uses it resolves the percentages against its own box. Numbers only
 * reach here from `cutLegs`, which bounds them.
 */
export function cutPolygon(legs: CutLegs): string {
  const px = (n: number) => `${Math.max(0, Math.min(96, Math.round(n)))}px`;
  const { tl, tr, br, bl } = { tl: px(legs.tl), tr: px(legs.tr), br: px(legs.br), bl: px(legs.bl) };
  return `polygon(${tl} 0,calc(100% - ${tr}) 0,100% ${tr},100% calc(100% - ${br}),calc(100% - ${br}) 100%,${bl} 100%,0 calc(100% - ${bl}),0 ${tl})`;
}

/** The legs as `--he-cut-*` declarations, for the painted button background. */
export function cutVars(legs: CutLegs): [string, string][] {
  return CORNERS.map((corner) => [`--he-cut-${corner}`, `${Math.max(0, Math.min(96, Math.round(legs[corner])))}px`]);
}

/**
 * A thin line along each cut, for an element whose border the clip would
 * otherwise leave open on the diagonal (chips, inputs). Returned as the
 * background longhands — image, position, size — so the element keeps its
 * own background colour; it needs no background image of its own, which is
 * true of every chip and field it is used on. Null when nothing is cut.
 */
export function cutLines(legs: CutLegs, width = 1): { image: string; position: string; size: string } | null {
  // 3.17 — down to a hairline (0.5), for a box whose own border is 1px.
  const w = Math.max(0.5, Math.min(4, width)) * 1.5;
  const gradient = (angle: 'to bottom right' | 'to top right') =>
    `linear-gradient(${angle},transparent calc(50% - ${w}px),var(--he-cut-line,currentColor) calc(50% - ${w}px),var(--he-cut-line,currentColor) calc(50% + ${w}px),transparent calc(50% + ${w}px))`;
  const layers = (
    [
      ['to bottom right', 'top left', legs.tl],
      ['to top right', 'top right', legs.tr],
      ['to bottom right', 'bottom right', legs.br],
      ['to top right', 'bottom left', legs.bl],
    ] as const
  ).filter(([, , leg]) => leg > 0);
  if (layers.length === 0) return null;
  return {
    image: layers.map(([angle]) => gradient(angle)).join(','),
    position: layers.map(([, place]) => place).join(','),
    size: layers.map(([, , leg]) => `${Math.round(leg)}px ${Math.round(leg)}px`).join(','),
  };
}

/**
 * Buttons, painted rather than clipped, so a glow (`filter: drop-shadow`)
 * follows the painted shape instead of being cut off by a clip-path. The
 * fill and edge colours are `--he-bf` and `--he-bl`, set per variant and per
 * state.
 *
 * 3.15.1 — the fill is one shape on `::after`, the padding box with each
 * cut shortened by the border's share of the diagonal. It used to be four
 * quarter layers of the background, overlapping by half a pixel so no seam
 * showed; a see-through fill then showed the overlap as a faint cross.
 */
export const CUT_BUTTON_FILL = (() => {
  const inner = (c: string) => `max(0px,var(--he-cut-${c},0px) - var(--he-bw,0px) * .4142)`;
  return `polygon(${inner('tl')} 0,calc(100% - ${inner('tr')}) 0,100% ${inner('tr')},100% calc(100% - ${inner('br')}),calc(100% - ${inner('br')}) 100%,${inner('bl')} 100%,0 calc(100% - ${inner('bl')}),0 ${inner('tl')})`;
})();

/**
 * 3.15 — a cut button's edge: a `::before` over the border box, clipped to
 * the border box's cut shape with the fill's own shape taken out (evenodd),
 * so only the ring between them is painted. `--he-bx` is the button's real
 * border width, the ring's thickness.
 */
export const CUT_BUTTON_RING = (() => {
  const leg = (c: string) => `var(--he-cut-${c},0px)`;
  const inner = (c: string) => `max(0px,var(--he-cut-${c},0px) - var(--he-bw,0px) * .4142)`;
  const b = 'var(--he-bx,0px)';
  const outer = [
    `${leg('tl')} 0`,
    `calc(100% - ${leg('tr')}) 0`,
    `100% ${leg('tr')}`,
    `100% calc(100% - ${leg('br')})`,
    `calc(100% - ${leg('br')}) 100%`,
    `${leg('bl')} 100%`,
    `0 calc(100% - ${leg('bl')})`,
    `0 ${leg('tl')}`,
    `${leg('tl')} 0`,
  ];
  const hole = [
    `calc(${b} + ${inner('tl')}) ${b}`,
    `calc(100% - ${b} - ${inner('tr')}) ${b}`,
    `calc(100% - ${b}) calc(${b} + ${inner('tr')})`,
    `calc(100% - ${b}) calc(100% - ${b} - ${inner('br')})`,
    `calc(100% - ${b} - ${inner('br')}) calc(100% - ${b})`,
    `calc(${b} + ${inner('bl')}) calc(100% - ${b})`,
    `${b} calc(100% - ${b} - ${inner('bl')})`,
    `${b} calc(${b} + ${inner('tl')})`,
    `calc(${b} + ${inner('tl')}) ${b}`,
  ];
  return `polygon(evenodd,${[...outer, ...hole].join(',')})`;
})();
