import { z } from 'zod';
import { color, length } from './blockStyle';
import { isColor, isLength } from './theme';

/* ═══════════════════════════════════════════════════════════════════════════
   How a diagram is drawn
   ───────────────────────────────────────────────────────────────────────────
   The converging figure and the layer stack were SVG with every colour and
   size written into the markup. The colours at least read the theme, so they
   followed a change of accent — but nothing about the diagram itself could be
   chosen: not the weight of a box, not the size of a label, not whether the
   destination is the brand colour or something else entirely.

   These are custom properties with the drawn-in values as fallbacks, set on
   the `<svg>` element, so a diagram nobody has styled emits nothing and
   renders exactly as before. They are applied as CSS *properties* rather than
   SVG presentation attributes, because an attribute cannot hold a `var()`.
   ═══════════════════════════════════════════════════════════════════════════ */

export const figureStyleSchema = z.object({
  /** The dashed curves, the joining dot, and the destination's fill. */
  lineColor: color.optional(),
  /** The graph-paper rules behind everything. */
  gridColor: color.optional(),
  sourceBorder: color.optional(),
  sourceText: color.optional(),
  targetBackground: color.optional(),
  targetText: color.optional(),
  /** The small monospaced label in each source box. */
  sourceSize: length.optional(),
  /** The heavy label in the destination. */
  targetSize: length.optional(),
  /** How thick a source box's outline and the curves are drawn. */
  borderWidth: length.optional(),
  /** Rounded corners on the boxes. */
  radius: length.optional(),
});

export type FigureStyle = z.output<typeof figureStyleSchema>;

/** Nothing chosen at all, so an untouched diagram carries no properties. */
export function isEmptyFigureStyle(style: FigureStyle | undefined): boolean {
  return !style || Object.values(style).every((v) => v === undefined);
}

/* The property each field writes, and what the SVG falls back to — which is
   exactly what was in the markup before any of this existed. */
const PROPERTIES = [
  ['lineColor', '--he-fig-line', isColor],
  ['gridColor', '--he-fig-grid', isColor],
  ['sourceBorder', '--he-fig-source-border', isColor],
  ['sourceText', '--he-fig-source-text', isColor],
  ['targetBackground', '--he-fig-target-bg', isColor],
  ['targetText', '--he-fig-target-text', isColor],
  ['sourceSize', '--he-fig-source-size', isLength],
  ['targetSize', '--he-fig-target-size', isLength],
  ['borderWidth', '--he-fig-border', isLength],
  ['radius', '--he-fig-radius', isLength],
] as const satisfies readonly (readonly [keyof FigureStyle, string, (v: string) => boolean])[];

/**
 * The custom properties to put on the `<svg>`, as a React style object.
 *
 * Every value is checked again here rather than trusted from the schema: it
 * is going into a style attribute, and the schema and this are two separate
 * chances to be wrong about the same value.
 */
export function figureStyleProperties(style: FigureStyle | undefined): React.CSSProperties {
  if (isEmptyFigureStyle(style) || !style) return {};

  const out: Record<string, string> = {};
  for (const [field, property, valid] of PROPERTIES) {
    const value = style[field];
    if (typeof value === 'string' && valid(value)) out[property] = value;
  }
  return out as React.CSSProperties;
}
