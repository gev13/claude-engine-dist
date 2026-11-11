import { z } from 'zod';

/* ═══════════════════════════════════════════════════════════════════════════
   A run of words drawn in a face, size, weight and colour of their own (3.30,
   shared since 3.33). Imports only zod: theme.ts reaches this file through
   careersLook.ts and blog.ts. Written two ways, every value checked again:
   as a rule (`typeRule`, for a CSS writer) or as custom properties in a style
   attribute (`typeVars`, read by a rule in library-details.css).
   ═══════════════════════════════════════════════════════════════════════════ */

const LENGTH = /^(0|\d*\.?\d+(px|rem|em|vw|vh|%))$/;
const COLOUR = /^(#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})|(rgb|rgba|hsl|hsla)\(\s*[0-9.,%\s/deg-]+\))$/i;
const LINE = /^(\d*\.?\d+|\d*\.?\d+(px|rem|em))$/;
const TRACKING = /^(0|-?\d*\.?\d+(px|rem|em))$/;
const len = () => z.string().trim().max(40).refine((v) => LENGTH.test(v), 'Not a valid CSS length').optional();

export const typeStyleSchema = z.object({
  /** The text's face or the headings'. */
  font: z.enum(['body', 'display']).optional(),
  size: len(),
  sizeMobile: len(),
  weight: z.enum(['300', '400', '500', '600', '700', '800']).optional(),
  line: z.string().trim().max(20).refine((v) => LINE.test(v), 'A line height').optional(),
  tracking: z.string().trim().max(20).refine((v) => TRACKING.test(v), 'A spacing such as -0.5px').optional(),
  color: z.string().trim().max(60).refine((v) => COLOUR.test(v), 'Not a colour').optional(),
});
export type TypeStyle = z.infer<typeof typeStyleSchema>;

const ok = (re: RegExp, v: unknown): v is string => typeof v === 'string' && re.test(v.trim());
const FACES = { body: 'var(--he-body-family)', display: 'var(--font-display)' } as const;

/** The checked declarations of a type style, the size on phones apart. */
function declarations(type: TypeStyle): [string, string][] {
  return (
    [
      ['font-family', type.font ? FACES[type.font] : undefined],
      ['font-size', ok(LENGTH, type.size) ? type.size.trim() : undefined],
      ['font-weight', typeof type.weight === 'string' && /^[3-8]00$/.test(type.weight) ? type.weight : undefined],
      ['line-height', ok(LINE, type.line) ? type.line.trim() : undefined],
      ['letter-spacing', ok(TRACKING, type.tracking) ? type.tracking.trim() : undefined],
      ['color', ok(COLOUR, type.color) ? type.color.trim() : undefined],
    ] as [string, string | undefined][]
  ).filter((pair): pair is [string, string] => pair[1] !== undefined);
}

/** A type style as rules under one selector; nothing for nothing set. */
export function typeRule(selector: string, type: TypeStyle | undefined): string[] {
  if (!type) return [];
  const decls = declarations(type);
  const out = decls.length ? [`${selector}{${decls.map(([p, v]) => `${p}:${v}`).join(';')}}`] : [];
  if (ok(LENGTH, type.sizeMobile)) out.push(`@media (max-width:768px){${selector}{font-size:${type.sizeMobile.trim()}}}`);
  return out;
}

const VAR_NAMES: Record<string, string> = { 'font-family': 'font', 'font-size': 'size', 'font-weight': 'weight', 'line-height': 'line', 'letter-spacing': 'tracking', color: 'color' };

/** A type style as custom properties (`--he-x-size`, `--he-x-size-m`, …), for a style attribute. */
export function typeVars(prefix: string, type: TypeStyle | undefined): Record<string, string> {
  if (!type) return {};
  const out: Record<string, string> = {};
  for (const [property, value] of declarations(type)) out[`--he-${prefix}-${VAR_NAMES[property]}`] = value;
  if (ok(LENGTH, type.sizeMobile)) out[`--he-${prefix}-size-m`] = type.sizeMobile.trim();
  return out;
}
