import { z } from 'zod';
import { isLength, isShadow, normaliseLength } from './theme';

/* ═══════════════════════════════════════════════════════════════════════════
   3.34 — the card grid's lift, tuned, and a row of cards that widen
   ───────────────────────────────────────────────────────────────────────────
   Both opt-in. The lift's settings act on `hover: 'lift'` (its drawn 6px
   rise is what an unset grid keeps), for pointers that hover only. The
   widening row is for pictures with text over them, from tablets up; phones
   keep the stacked cards. Every value is checked here again on its way into a
   style attribute.
   ═══════════════════════════════════════════════════════════════════════════ */

/** The easings an option may name, the same set as the entrances (3.28). */
export const EASINGS = { soft: 'cubic-bezier(0.2,0.7,0.2,1)', ease: 'ease', easeOut: 'ease-out', easeInOut: 'ease-in-out', linear: 'linear' } as const;
export const EASING_NAMES = ['soft', 'ease', 'easeOut', 'easeInOut', 'linear'] as const;

const length = z.string().trim().max(40).transform(normaliseLength).refine(isLength, 'Not a valid CSS length');
const ms = z.number().int().min(0).max(3000);

export const cardMotionFields = {
  /** How far the card rises (e.g. 10px); unset is the drawn 6px. */
  liftDistance: length.optional(),
  /** The shadow it gains, e.g. 0 30px 60px -30px rgba(0,0,0,.35); unset, none. */
  liftShadow: z.string().trim().max(120).refine(isShadow, 'Such as 0 30px 60px -30px rgba(0,0,0,0.35)').optional(),
  /** How far its picture zooms inside it (1.07 is 7%); unset, not at all. */
  liftZoom: z.number().min(1).max(1.5).optional(),
  /** The rise's and the zoom's length in ms, and their easing. */
  liftDuration: ms.optional(),
  liftZoomDuration: ms.optional(),
  liftEasing: z.enum(EASING_NAMES).optional(),
  /** Pictures with text over them, one row: the card pointed at or focused widens by this much (1.3) while the others narrow. */
  expand: z.number().min(1.05).max(4).optional(),
  expandDuration: ms.optional(),
  expandEasing: z.enum(EASING_NAMES).optional(),
  /** The cards' words hidden until the card widens. */
  expandText: z.enum(['reveal']).optional(),
};

type Motion = { [K in keyof typeof cardMotionFields]?: z.infer<(typeof cardMotionFields)[K]> };

const PX = /^(-?\d{1,3})(?:px)?$/;

/**
 * How far a shadow reaches above and below its card, in px — room the grid
 * makes inside itself so a sliding row (which clips) shows the lift whole.
 */
export function shadowReach(shadow: string | undefined): { up: number; down: number } {
  if (!shadow || !isShadow(shadow)) return { up: 0, down: 0 };
  const [, y = '0', blur = '0', spread = '0'] = shadow.trim().split(/\s+/);
  const n = (v: string) => Number(PX.exec(v)?.[1] ?? 0);
  const reach = n(blur) + n(spread);
  return { up: Math.max(0, reach - n(y)), down: Math.max(0, reach + n(y)) };
}

const okMs = (value: unknown) => (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 3000 ? value : undefined);
const okEase = (value: unknown) => (typeof value === 'string' && value in EASINGS ? EASINGS[value as keyof typeof EASINGS] : undefined);

/** The classes and custom properties the grid carries for these options; nothing for a grid that sets none. */
export function cardMotion(p: Motion & { hover?: string; variant?: string }): { className: string[]; style: Record<string, string> } {
  const className: string[] = [];
  const style: Record<string, string> = {};
  const lift = p.hover === 'lift' && (p.liftDistance || p.liftShadow || p.liftZoom || p.liftDuration !== undefined || p.liftZoomDuration !== undefined || p.liftEasing);
  if (lift) {
    className.push('has-lift');
    const distance = p.liftDistance && isLength(p.liftDistance) ? p.liftDistance : '6px';
    style['--he-lift-d'] = distance;
    if (p.liftShadow && isShadow(p.liftShadow)) style['--he-lift-shadow'] = p.liftShadow.trim();
    if (typeof p.liftZoom === 'number' && p.liftZoom >= 1 && p.liftZoom <= 1.5) {
      className.push('has-lift-zoom');
      style['--he-lift-zoom'] = String(p.liftZoom);
    }
    const ease = okEase(p.liftEasing);
    if (okMs(p.liftDuration) !== undefined) style['--he-lift-t'] = `${okMs(p.liftDuration)}ms`;
    if (okMs(p.liftZoomDuration) !== undefined) style['--he-lift-zt'] = `${okMs(p.liftZoomDuration)}ms`;
    if (ease) style['--he-lift-ease'] = ease;
    const reach = shadowReach(p.liftShadow);
    style['--he-lift-room-t'] = `calc(${distance} + ${reach.up}px)`;
    style['--he-lift-room-b'] = `${reach.down}px`;
  }
  if (p.variant === 'overlay' && typeof p.expand === 'number' && p.expand >= 1.05 && p.expand <= 4) {
    className.push('is-expand');
    if (p.expandText === 'reveal') className.push('is-expand-reveal');
    style['--he-expand'] = String(p.expand);
    if (okMs(p.expandDuration) !== undefined) style['--he-expand-t'] = `${okMs(p.expandDuration)}ms`;
    const ease = okEase(p.expandEasing);
    if (ease) style['--he-expand-ease'] = ease;
  }
  return { className, style };
}
