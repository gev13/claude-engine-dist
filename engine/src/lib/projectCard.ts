import { z } from 'zod';
import { isColor, isLength } from './theme';

/**
 * 3.24 — how a project card is drawn, shared by the projects block and the
 * project archives (Projects → Page template). Every field unset draws the
 * card exactly as before: the layout's own picture shape, the site's card
 * corners, category chips, no text swap, the 1.05 zoom.
 */
export const projectCardSchema = z.object({
  /** The picture's shape; `auto` is each file's own. */
  ratio: z.enum(['1/1', '4/3', '3/2', '16/9', '3/4', 'auto']).optional(),
  /** The picture's corners, px. */
  radius: z.number().int().min(0).max(48).optional(),
  /** The categories under the title: chips (as before) or plain text. */
  categoryStyle: z.enum(['chips', 'plain']).optional(),
  /** Pointing at a card slides the category line away and a link line in ("Show project"). */
  reveal: z.enum(['none', 'link']).optional(),
  /** The words of that line; empty is the Site translation "Show project". */
  revealLabel: z.string().trim().max(40).optional(),
  /** A short line after the words (on unless switched off). */
  revealLine: z.boolean().optional(),
  /** The line's colour; unset is the accent. */
  revealColor: z
    .string()
    .trim()
    .max(60)
    .refine((v) => isColor(v), 'Not a colour')
    .optional(),
  /** How far the picture zooms under the pointer (the zoom hover), e.g. 1.06. */
  zoom: z.number().min(1).max(1.3).optional(),
  /** 3.26 — the title's size, weight and letter spacing; the category's size; the space under the picture; the gaps between cards. */
  titleSize: z.string().trim().max(40).refine((v) => isLength(v), 'Not a valid CSS length').optional(),
  titleWeight: z.enum(['300', '400', '500', '600', '700', '800']).optional(),
  titleTracking: z.string().trim().max(20).refine((v) => isLength(v), 'Not a valid CSS length').optional(),
  categorySize: z.string().trim().max(40).refine((v) => isLength(v), 'Not a valid CSS length').optional(),
  textGap: z.string().trim().max(40).refine((v) => isLength(v), 'Not a valid CSS length').optional(),
  columnGap: z.string().trim().max(40).refine((v) => isLength(v), 'Not a valid CSS length').optional(),
  rowGap: z.string().trim().max(40).refine((v) => isLength(v), 'Not a valid CSS length').optional(),
  /** 3.28 — the space between the title and the category line; the reveal link's size. */
  titleGap: z.string().trim().max(40).refine((v) => isLength(v), 'Not a valid CSS length').optional(),
  revealSize: z.string().trim().max(40).refine((v) => isLength(v), 'Not a valid CSS length').optional(),
  /** 3.28 — the words on a panel of their own under the picture: its colour and padding (and on phones); the card's corners are `radius`. */
  bodyBackground: z.string().trim().max(60).refine((v) => isColor(v), 'Not a colour').optional(),
  bodyPadding: z.string().trim().max(60).refine((v) => v.trim().split(/\s+/).length <= 4 && v.trim().split(/\s+/).every((part) => isLength(part)), 'One to four CSS lengths').optional(),
  bodyPaddingMobile: z.string().trim().max(60).refine((v) => v.trim().split(/\s+/).length <= 4 && v.trim().split(/\s+/).every((part) => isLength(part)), 'One to four CSS lengths').optional(),
});

export type ProjectCardOptions = z.infer<typeof projectCardSchema>;

const RATIOS: Record<string, string> = { '1/1': '1 / 1', '4/3': '4 / 3', '3/2': '3 / 2', '16/9': '16 / 9', '3/4': '3 / 4' };

/** The list's classes and custom properties for a card's options; nothing at all for an untouched card. */
export function projectCardLook(card: ProjectCardOptions | undefined): { className: string[]; style: Record<string, string | number> } {
  const className: string[] = [];
  const style: Record<string, string | number> = {};
  if (!card) return { className, style };
  if (card.ratio === 'auto') className.push('is-ratio-auto');
  else if (card.ratio && RATIOS[card.ratio]) {
    className.push('has-ratio');
    style['--he-proj-ratio'] = RATIOS[card.ratio]!;
  }
  if (typeof card.radius === 'number') {
    className.push('has-radius');
    style['--he-proj-radius'] = `${card.radius}px`;
  }
  if (card.categoryStyle === 'plain') className.push('is-cats-plain');
  if (card.reveal === 'link') className.push('has-reveal');
  if (card.revealColor && isColor(card.revealColor)) style['--he-proj-reveal'] = card.revealColor;
  if (typeof card.zoom === 'number' && card.zoom >= 1 && card.zoom <= 1.3) style['--he-proj-zoom'] = card.zoom;
  // 3.26 — each a class and a property, only when set.
  const lengths: [keyof ProjectCardOptions, string, string][] = [
    ['titleSize', 'has-title-size', '--he-proj-title-size'],
    ['titleTracking', 'has-title-tracking', '--he-proj-title-tracking'],
    ['categorySize', 'has-cat-size', '--he-proj-cat-size'],
    ['textGap', 'has-text-gap', '--he-proj-text-gap'],
    ['columnGap', 'has-col-gap', '--he-proj-col-gap'],
    ['rowGap', 'has-row-gap', '--he-proj-row-gap'],
    ['titleGap', 'has-title-gap', '--he-proj-title-gap'],
    ['revealSize', 'has-reveal-size', '--he-proj-reveal-size'],
  ];
  for (const [key, cls, prop] of lengths) {
    const value = card[key];
    if (typeof value === 'string' && isLength(value)) {
      className.push(cls);
      style[prop] = value;
    }
  }
  if (card.titleWeight) {
    className.push('has-title-weight');
    style['--he-proj-title-weight'] = card.titleWeight;
  }
  // 3.28 — the words on a panel of their own.
  if (card.bodyBackground && isColor(card.bodyBackground)) {
    className.push('has-body');
    style['--he-proj-body'] = card.bodyBackground;
    if (card.bodyPadding) style['--he-proj-body-pad'] = card.bodyPadding;
    if (card.bodyPaddingMobile) style['--he-proj-body-pad-m'] = card.bodyPaddingMobile;
  }
  return { className, style };
}
