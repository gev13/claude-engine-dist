/* ═══════════════════════════════════════════════════════════════════════════
   The CSS length grammar (3.38: shared, and with calc())
   ───────────────────────────────────────────────────────────────────────────
   A length lands inside a <style> element or a style attribute, so it is a
   pattern, never free text: a number with an optional unit; calc() adding and
   subtracting such numbers (`calc(100vw - 468px)`); or clamp()/min()/max() of
   two or three of either. Nothing in it can close a declaration. Imports
   nothing, so theme.ts and the files theme.ts itself reaches can share it.
   ═══════════════════════════════════════════════════════════════════════════ */

const LENGTH_UNIT = '(?:px|rem|em|%|vw|vh|vmin|vmax|ch|ex|pt)';
export const SIMPLE_LENGTH = `-?\\d*\\.?\\d+${LENGTH_UNIT}?`;
/** 3.38 — calc() of plain lengths joined by + and −, spaced as CSS requires. */
const CALC = `calc\\(\\s*${SIMPLE_LENGTH}(?:\\s+[-+]\\s+${SIMPLE_LENGTH}){1,3}\\s*\\)`;
const TERM = `(?:${SIMPLE_LENGTH}|${CALC})`;

export const LENGTH_PATTERN = new RegExp(`^(?:${TERM}|(?:clamp|min|max)\\(\\s*${TERM}\\s*,\\s*${TERM}\\s*(?:,\\s*${TERM}\\s*)?\\))$`);

export function isLength(value: string): boolean {
  return LENGTH_PATTERN.test(value.trim());
}

/** A length that has a unit, or is zero. What may actually reach a stylesheet. */
export function isUsableLength(value: string): boolean {
  const trimmed = value.trim();
  if (!isLength(trimmed)) return false;
  return Number(trimmed) === 0 || !/^-?\d*\.?\d+$/.test(trimmed);
}

/**
 * 3.38.1 — the same grammar with a unit on every number but 0, as a pattern,
 * for the files that check lengths with a regular expression (the chrome's).
 */
const UNIT_SIMPLE = `(?:0|-?\\d*\\.?\\d+${LENGTH_UNIT})`;
const UNIT_CALC = `calc\\(\\s*${UNIT_SIMPLE}(?:\\s+[-+]\\s+${UNIT_SIMPLE}){1,3}\\s*\\)`;
const UNIT_TERM = `(?:${UNIT_SIMPLE}|${UNIT_CALC})`;
export const UNIT_LENGTH_PATTERN = new RegExp(`^(?:${UNIT_TERM}|(?:clamp|min|max)\\(\\s*${UNIT_TERM}\\s*,\\s*${UNIT_TERM}\\s*(?:,\\s*${UNIT_TERM}\\s*)?\\))$`);
