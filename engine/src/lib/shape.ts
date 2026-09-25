import { z } from 'zod';

/* ═══════════════════════════════════════════════════════════════════════════
   Corners: rounded, or cut on the diagonal (2.21)
   ───────────────────────────────────────────────────────────────────────────
   A cut corner is a clip-path polygon with the legs written in — cards,
   inputs, chips, images and sections clip. Buttons are *painted* instead
   (`CUT_BUTTON_BACKGROUND`, legs as `--he-cut-*` on the button), because a
   clip-path also clips the glow a button may carry.
   ═══════════════════════════════════════════════════════════════════════════ */

export const CORNERS = ['tl', 'tr', 'br', 'bl'] as const;
export type Corner = (typeof CORNERS)[number];

export const CORNER_LABELS: Record<Corner, string> = { tl: 'Top left', tr: 'Top right', br: 'Bottom right', bl: 'Bottom left' };

export const cornerShapeSchema = z.object({
  /** `rounded` is the radius as before; `cut` clips the chosen corners on the diagonal. */
  style: z.enum(['rounded', 'cut']).optional(),
  /** The length of each cut's legs, in px. */
  size: z.number().int().min(0).max(96).optional(),
  /** Which corners are cut; unset is top right and bottom left. */
  corners: z.array(z.enum(CORNERS)).min(1).max(4).optional(),
});

export type CornerShape = z.infer<typeof cornerShapeSchema>;

export const DEFAULT_CUT_CORNERS: Corner[] = ['tr', 'bl'];

export type CutLegs = Record<Corner, number>;

/** A cut shape's four legs, in px; null for a rounded or unset shape. */
export function cutLegs(shape: CornerShape | undefined, fallbackSize: number): CutLegs | null {
  if (shape?.style !== 'cut') return null;
  const size = typeof shape.size === 'number' && Number.isInteger(shape.size) && shape.size >= 0 && shape.size <= 96 ? shape.size : fallbackSize;
  const chosen = new Set(shape.corners?.length ? shape.corners : DEFAULT_CUT_CORNERS);
  return { tl: chosen.has('tl') ? size : 0, tr: chosen.has('tr') ? size : 0, br: chosen.has('br') ? size : 0, bl: chosen.has('bl') ? size : 0 };
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
  const w = Math.max(1, Math.min(4, width)) * 1.5;
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
 * Buttons, painted rather than clipped: four quarter layers of the border
 * colour, four of the fill inside them, each transparent across its own
 * corner's cut. A glow (`filter: drop-shadow`) then follows the painted
 * shape, which a clip-path would have cut off. The fill and line colours are
 * `--he-bf` and `--he-bl`, set per variant and per state.
 */
export const CUT_BUTTON_BACKGROUND = (() => {
  const corner = (angle: number, leg: string, colour: string, box: 'padding-box' | 'border-box', place: string) =>
    `linear-gradient(${angle}deg,transparent calc(${leg} * .7071),${colour} 0) ${place}/calc(50% + .5px) calc(50% + .5px) no-repeat ${box}`;
  const layers = (colour: string, box: 'padding-box' | 'border-box', inset: string) =>
    [
      corner(135, `max(0px,var(--he-cut-tl,0px) - ${inset})`, colour, box, 'top left'),
      corner(225, `max(0px,var(--he-cut-tr,0px) - ${inset})`, colour, box, 'top right'),
      corner(315, `max(0px,var(--he-cut-br,0px) - ${inset})`, colour, box, 'bottom right'),
      corner(45, `max(0px,var(--he-cut-bl,0px) - ${inset})`, colour, box, 'bottom left'),
    ].join(',');
  // The fill sits inside the border; its cut is shorter by the border's share of the diagonal.
  return `${layers('var(--he-bf)', 'padding-box', 'var(--he-bw,0px) * .4142')},${layers('var(--he-bl)', 'border-box', '0px')}`;
})();
