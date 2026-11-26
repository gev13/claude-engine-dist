import { z } from 'zod';
import { FONT_STACKS } from './fontStacks';

/* ═══════════════════════════════════════════════════════════════════════════
   A run of words drawn in a face, size, weight and colour of their own (3.30,
   shared since 3.33). Imports only zod and the font stacks: theme.ts reaches
   this file through careersLook.ts and blog.ts. Written two ways, every value checked again:
   as a rule (`typeRule`, for a CSS writer) or as custom properties in a style
   attribute (`typeVars`, read by a rule in library-details.css).
   ═══════════════════════════════════════════════════════════════════════════ */

const LENGTH = /^(0|\d*\.?\d+(px|rem|em|vw|vh|%))$/;
const COLOUR = /^(#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})|(rgb|rgba|hsl|hsla)\(\s*[0-9.,%\s/deg-]+\))$/i;
const LINE = /^(\d*\.?\d+|\d*\.?\d+(px|rem|em))$/;
const TRACKING = /^(0|-?\d*\.?\d+(px|rem|em))$/;
const len = () => z.string().trim().max(40).refine((v) => LENGTH.test(v), 'Not a valid CSS length').optional();

/**
 * 3.37 — a face: the text's (`body`) or the headings' (`display`), as before,
 * or any other face the site has (`system`, `serif`, a catalogue key). Checked
 * against the list, never typed: it lands in a <style> element. `display` keeps
 * meaning the headings' face, not the brand stack of that name.
 */
export const isTypeFace = (value: unknown): value is string => typeof value === 'string' && (value === 'body' || value === 'display' || Object.prototype.hasOwnProperty.call(FONT_STACKS, value));

export const typeStyleSchema = z.object({
  /** The text's face or the headings' (3.37: or any face the site has). */
  font: z.string().trim().max(60).refine(isTypeFace, 'Not a face this site has').optional(),
  size: len(),
  sizeMobile: len(),
  weight: z.enum(['300', '400', '500', '600', '700', '800']).optional(),
  line: z.string().trim().max(20).refine((v) => LINE.test(v), 'A line height').optional(),
  /** The line height on tablets (≤1024px) and on phones (≤768px), 3.36; unset keeps the wider tier's. */
  lineTablet: z.string().trim().max(20).refine((v) => LINE.test(v), 'A line height').optional(),
  lineMobile: z.string().trim().max(20).refine((v) => LINE.test(v), 'A line height').optional(),
  tracking: z.string().trim().max(20).refine((v) => TRACKING.test(v), 'A spacing such as -0.5px').optional(),
  color: z.string().trim().max(60).refine((v) => COLOUR.test(v), 'Not a colour').optional(),
});
export type TypeStyle = z.infer<typeof typeStyleSchema>;

const ok = (re: RegExp, v: unknown): v is string => typeof v === 'string' && re.test(v.trim());
const FACES: Record<string, string> = { body: 'var(--he-body-family)', display: 'var(--font-display)' };
/** A face's stack, checked again; unknown is nothing. */
const faceOf = (font: unknown): string | undefined => (isTypeFace(font) ? (FACES[font] ?? FONT_STACKS[font]) : undefined);

/** The checked declarations of a type style, the size on phones apart. */
function declarations(type: TypeStyle): [string, string][] {
  return (
    [
      ['font-family', faceOf(type.font)],
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
  if (ok(LINE, type.lineTablet)) out.push(`@media (max-width:1024px){${selector}{line-height:${type.lineTablet.trim()}}}`);
  const phone = [ok(LENGTH, type.sizeMobile) ? `font-size:${type.sizeMobile.trim()}` : '', ok(LINE, type.lineMobile) ? `line-height:${type.lineMobile.trim()}` : ''].filter(Boolean);
  if (phone.length) out.push(`@media (max-width:768px){${selector}{${phone.join(';')}}}`);
  return out;
}

const VAR_NAMES: Record<string, string> = { 'font-family': 'font', 'font-size': 'size', 'font-weight': 'weight', 'line-height': 'line', 'letter-spacing': 'tracking', color: 'color' };

/** A type style as custom properties (`--he-x-size`, `--he-x-size-m`, `--he-x-line-t`, `--he-x-line-m`, …), for a style attribute. */
export function typeVars(prefix: string, type: TypeStyle | undefined): Record<string, string> {
  if (!type) return {};
  const out: Record<string, string> = {};
  for (const [property, value] of declarations(type)) out[`--he-${prefix}-${VAR_NAMES[property]}`] = value;
  if (ok(LENGTH, type.sizeMobile)) out[`--he-${prefix}-size-m`] = type.sizeMobile.trim();
  if (ok(LINE, type.lineTablet)) out[`--he-${prefix}-line-t`] = type.lineTablet.trim();
  if (ok(LINE, type.lineMobile)) out[`--he-${prefix}-line-m`] = type.lineMobile.trim();
  return out;
}
