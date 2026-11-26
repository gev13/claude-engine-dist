/* 3.38.2 — shadows that follow a picture's own outline: `filter:
   drop-shadow()`, which has no spread and no inset. Up to four, written one
   after another (each also shades the ones before it, as filters chain).
   Checked here and again where they are written into a style attribute. */

const ONE = /^-?\d{1,3}(?:\.\d{1,2})?(?:px)?\s+-?\d{1,3}(?:\.\d{1,2})?(?:px)?\s+\d{1,3}(?:\.\d{1,2})?(?:px)?\s+(#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})|(rgb|rgba|hsl|hsla)\(\s*[0-9.,%\s/deg-]+\))$/i;

/** The shadows one by one, or null when any of them is not one. */
function split(value: string): string[] | null {
  // Commas inside a colour's brackets are not separators.
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of value) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (depth < 0) return null;
    if (ch === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else current += ch;
  }
  parts.push(current.trim());
  if (depth !== 0 || parts.length > 4 || parts.some((p) => !ONE.test(p))) return null;
  return parts;
}

export function isDropShadows(value: string): boolean {
  return split(value.trim()) !== null;
}

/** `drop-shadow(a) drop-shadow(b)`, or undefined for anything else. */
export function dropShadowFilter(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const parts = split(value.trim());
  return parts ? parts.map((p) => `drop-shadow(${p.replace(/\s+/g, ' ')})`).join(' ') : undefined;
}
