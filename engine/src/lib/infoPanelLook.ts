import { z } from 'zod';
import { cornerShapeSchema, cutLegs, cutPolygon, hasPhoneCorners, leafRadii, type CornerShape } from './shape';
import { isColor, isUsableLength } from './theme';
import { typeStyleSchema, typeVars } from './typeStyle';

/* ═══════════════════════════════════════════════════════════════════════════
   3.37 — the info panel's rows (`layout: 'list'`): the icon's tile, colour,
   size, stroke and corners, the label's and the value's type, the space
   between them, between the rows (and on phones), and the rows' alignment.
   Written as classes and custom properties on `.he-info`, read by rules in
   library-form-details.css keyed to those classes; nothing set, nothing
   written.
   ═══════════════════════════════════════════════════════════════════════════ */

const length = z.string().trim().max(40).refine(isUsableLength, 'A CSS length, such as 12px');
const colour = z.string().trim().max(60).refine(isColor, 'Not a colour');

/** Spread into the `infoPanel` schema. Each is read with `layout: 'list'` only. */
export const infoPanelListFields = {
  /** The tile behind the icon (`transparent` for none) and the icon's colour. */
  iconTile: colour.optional(),
  iconColor: colour.optional(),
  /** The icon's size (its box; unset 20px) and its line's thickness (unset 1.4). */
  iconGlyph: length.optional(),
  iconStroke: z.number().min(0.5).max(4).optional(),
  /** The tile's corners, cut or rounded on chosen corners (lib/shape.ts); unset or `rounded` keeps the tile's radius. */
  iconCorners: cornerShapeSchema.optional(),
  labelType: typeStyleSchema.optional(),
  valueType: typeStyleSchema.optional(),
  /** Label to value (unset 8px); between the rows (unset 40px) and on phones (unset: the rows' gap, else 28px). */
  labelGap: length.optional(),
  rowGap: length.optional(),
  rowGapMobile: length.optional(),
  /** `center`: the icon level with the middle of the two lines; unset keeps it at the top. */
  rowAlign: z.enum(['start', 'center']).optional(),
};

type ListLook = { [K in keyof typeof infoPanelListFields]?: z.output<(typeof infoPanelListFields)[K]> };

const len = (v: unknown): string | undefined => (typeof v === 'string' && isUsableLength(v.trim()) && !/[;{}<>]/.test(v) ? v.trim() : undefined);
const col = (v: unknown): string | undefined => (typeof v === 'string' && isColor(v.trim()) ? v.trim() : undefined);

/** The tile's corners as custom properties: a cut's clip (and a square radius), or a leaf's radii. */
function cornerVars(shape: CornerShape | undefined, phone: boolean, suffix: string): Record<string, string> {
  const legs = cutLegs(shape, 8, phone);
  if (legs) return { [`--he-info-clip${suffix}`]: cutPolygon(legs), [`--he-info-radius${suffix}`]: '0px' };
  const leaf = leafRadii(shape, 12, phone);
  if (leaf) return { [`--he-info-clip${suffix}`]: 'none', [`--he-info-radius${suffix}`]: leaf };
  return {};
}

/** The list's extra classes and style; empty for nothing set, so the markup is as before. */
export function infoPanelLook(p: ListLook): { classes: string[]; style: Record<string, string> | undefined } {
  const classes: string[] = [];
  const style: Record<string, string> = {};
  const add = (cls: string, vars: Record<string, string | undefined>) => {
    const set = Object.entries(vars).filter((e): e is [string, string] => e[1] !== undefined);
    if (!set.length) return;
    classes.push(cls);
    for (const [k, v] of set) style[k] = v;
  };
  add('has-tile', { '--he-info-tile': col(p.iconTile) });
  add('has-icon-color', { '--he-info-icon': col(p.iconColor) });
  add('has-glyph', { '--he-info-glyph': len(p.iconGlyph) });
  add('has-stroke', { '--he-info-stroke': typeof p.iconStroke === 'number' && p.iconStroke >= 0.5 && p.iconStroke <= 4 ? String(p.iconStroke) : undefined });
  add('has-tile-shape', cornerVars(p.iconCorners, false, ''));
  if (hasPhoneCorners(p.iconCorners)) add('has-tile-shape-m', cornerVars(p.iconCorners, true, '-m'));
  const label = typeVars('info-l', p.labelType);
  if (Object.keys(label).length) add('has-label-type', label);
  const value = typeVars('info-v', p.valueType);
  if (Object.keys(value).length) add('has-value-type', value);
  add('has-label-gap', { '--he-info-lgap': len(p.labelGap) });
  add('has-row-gap', { '--he-info-gap': len(p.rowGap) });
  add('has-row-gap-m', { '--he-info-gap-m': len(p.rowGapMobile) });
  if (p.rowAlign === 'center') classes.push('is-row-center');
  return { classes, style: Object.keys(style).length ? style : undefined };
}
