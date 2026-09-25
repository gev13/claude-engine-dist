import type { CSSProperties } from 'react';
import { z } from 'zod';

/**
 * How a card answers the pointer (T33, 2.19) — the Design panel's hover
 * effects, for the cards *inside* a list rather than the list's band: post
 * lists, the blog's archives and the projects block.
 *
 * Unset is nothing at all, so every list saved before 2.19 draws exactly the
 * markup it did. Tilt leans the card towards the pointer in 3D, through
 * custom properties written by `CardTilt` — a mouse only, never under reduced
 * motion. The perspective is the distance the card is seen from: small is a
 * steep, close lean, 6000 an almost flat one.
 */
export const CARD_HOVERS = ['none', 'lift', 'grow', 'shadow', 'tilt'] as const;
export type CardHoverEffect = (typeof CARD_HOVERS)[number];

export const CARD_HOVER_LABELS: Record<CardHoverEffect, string> = {
  none: 'None',
  lift: 'Lift',
  grow: 'Grow',
  shadow: 'Shadow',
  tilt: 'Tilt (3D)',
};

export const TILT_DEFAULTS = { perspective: 1100, maxAngle: 8 } as const;

export const cardHoverSchema = z.object({
  effect: z.enum(CARD_HOVERS).optional(),
  /** Tilt only: how far away the card is seen from, in px. */
  perspective: z.number().int().min(300).max(8000).optional(),
  /** Tilt only: the most it leans, in degrees. */
  maxAngle: z.number().int().min(1).max(25).optional(),
  /** Tilt only: a soft highlight that follows the pointer. */
  glare: z.boolean().optional(),
  /** The card's picture grows a little under the pointer. */
  zoom: z.boolean().optional(),
});

export type CardHover = z.infer<typeof cardHoverSchema>;

/** True when a list's cards need the tilt script. */
export const wantsTilt = (hover: CardHover | undefined) => hover?.effect === 'tilt';

/**
 * The class and custom properties one card carries. Nothing at all for an
 * unset or `none` effect without zoom, so an untouched card's markup is
 * unchanged. Numbers are re-checked here: they land in a style attribute.
 */
export function cardHoverProps(hover: CardHover | undefined): { className?: string; style?: CSSProperties } {
  const effect = hover?.effect && hover.effect !== 'none' ? hover.effect : undefined;
  if (!effect && !hover?.zoom) return {};
  const classes = ['he-ch'];
  if (effect) classes.push(`he-ch--${effect}`);
  if (effect === 'tilt' && hover?.glare) classes.push('has-glare');
  if (hover?.zoom) classes.push('has-zoom');
  if (effect !== 'tilt') return { className: classes.join(' ') };

  const perspective = clampInt(hover?.perspective, 300, 8000, TILT_DEFAULTS.perspective);
  const maxAngle = clampInt(hover?.maxAngle, 1, 25, TILT_DEFAULTS.maxAngle);
  return {
    className: classes.join(' '),
    style: { '--he-ch-persp': `${perspective}px`, '--he-ch-max': String(maxAngle) } as CSSProperties,
  };
}

function clampInt(value: number | undefined, min: number, max: number, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max ? value : fallback;
}
