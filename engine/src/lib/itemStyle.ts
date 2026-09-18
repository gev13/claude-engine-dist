import { z } from 'zod';
import { BORDER_STYLES, box, color, length, type SpacingBox } from './blockStyle';
import { isColor, isLength } from './theme';

/* ═══════════════════════════════════════════════════════════════════════════
   Styling one item inside a block
   ───────────────────────────────────────────────────────────────────────────
   `blockStyle` dresses a whole section. This dresses one card in it — the
   thing an editor reaches for when a grid of six needs one tile picked out,
   and which until now could only be done by writing CSS.

   Deliberately much smaller than `blockStyle`, and not by accident: most of
   what a section has means nothing on a card. An entrance, a sticky position,
   a shape divider, a per-breakpoint hide — those belong to a band, and
   offering them here would be eight controls nobody can use to produce a
   sensible result. What is here is what an editor actually asks for about a
   card: its colour, its spacing, its edge.

   It is shared rather than written into `cardGrid`, because the request will
   come again for the next block with a list in it, and a second copy of this
   vocabulary would drift from the first.
   ═══════════════════════════════════════════════════════════════════════════ */

export const itemStyleSchema = z.object({
  /** Replaces whatever the card paints itself. */
  background: color.optional(),
  /** The text inside it, including the heading — a dark tile needs light text. */
  color: color.optional(),
  /** Margin and padding, the same eight fields the Design panel uses. */
  spacing: box.optional(),
  borderWidth: length.optional(),
  borderStyle: z.enum(BORDER_STYLES).optional(),
  borderColor: color.optional(),
  radius: length.optional(),
  align: z.enum(['left', 'center', 'right']).optional(),
  /**
   * A name to aim your own CSS at, the same escape hatch a block has.
   *
   * Constrained exactly as the block one is: it lands in a class attribute,
   * so it may hold only what a class name may hold.
   */
  className: z
    .string()
    .trim()
    .max(120)
    .regex(/^[A-Za-z_-][A-Za-z0-9_ -]*$/, 'Letters, digits, dashes and underscores; separate several with spaces')
    .optional(),
});

export type ItemStyle = z.output<typeof itemStyleSchema>;

/** Nothing set at all — worth knowing, so an untouched card emits no CSS. */
export function isEmptyItemStyle(style: ItemStyle | undefined): boolean {
  if (!style) return true;
  return Object.values(style).every((value) =>
    value === undefined || (typeof value === 'object' && Object.values(value).every((v) => v === undefined)),
  );
}

type Decl = [string, string];

/** The eight spacing fields, re-checked on the way out. */
function spacingDecls(spacing: SpacingBox | undefined): Decl[] {
  if (!spacing) return [];
  const out: Decl[] = [];
  for (const [key, value] of Object.entries(spacing)) {
    if (typeof value !== 'string' || !isLength(value)) continue;
    // marginTop → margin-top
    out.push([key.replace(/([A-Z])/g, '-$1').toLowerCase(), value]);
  }
  return out;
}

/**
 * The CSS for one item, scoped to a class the renderer also puts on it.
 *
 * Every value is checked again here rather than trusted from the schema —
 * this is interpolated into a `<style>` element, and the schema and this
 * function are two separate chances to be wrong about the same value. The
 * same reasoning `themeToCss` follows.
 */
export function itemStyleToCss(selector: string, style: ItemStyle | undefined): string {
  if (isEmptyItemStyle(style) || !style) return '';

  const decls: Decl[] = [...spacingDecls(style.spacing)];

  if (style.background && isColor(style.background)) decls.push(['background', style.background]);
  if (style.radius && isLength(style.radius)) decls.push(['border-radius', style.radius]);
  if (style.align) decls.push(['text-align', style.align]);

  /* A width with no style draws nothing, which reads as the field being
     broken. `solid` is what somebody typing a width meant. */
  if (style.borderWidth && isLength(style.borderWidth)) {
    decls.push(['border-width', style.borderWidth]);
    decls.push(['border-style', style.borderStyle ?? 'solid']);
  } else if (style.borderStyle && style.borderStyle !== 'none') {
    decls.push(['border-style', style.borderStyle]);
    decls.push(['border-width', '1px']);
  }
  if (style.borderColor && isColor(style.borderColor)) decls.push(['border-color', style.borderColor]);

  const own = decls.length ? `${selector}{${decls.map(([k, v]) => `${k}:${v}`).join(';')}}` : '';

  /* Text colour has to reach the heading too. A card paints its title from
     the theme, so setting the item's colour and watching the title stay dark
     on a dark tile is the obvious first disappointment. */
  const text =
    style.color && isColor(style.color)
      ? `${selector},${selector} :is(h1,h2,h3,h4,h5,h6,p,li,span,a){color:${style.color}}`
      : '';

  return own + text;
}

/**
 * The classes one item carries: the generated one the CSS aims at, and the
 * editor's own name beside it.
 *
 * The generated one includes the block's id because a card may be styled
 * inside a block nobody has touched — and an unstyled block is not wrapped,
 * so there is no `.he-b-<id>` to scope from. Returns nothing at all when the
 * card is untouched, so a page full of ordinary cards gains no classes.
 */
export function itemClass(blockId: string | undefined, index: number, style: ItemStyle | undefined): string | undefined {
  const own = style?.className;
  const generated = blockId && !isEmptyItemStyle(style) ? `he-i-${blockId}-${index}` : undefined;
  return [generated, own].filter(Boolean).join(' ') || undefined;
}
