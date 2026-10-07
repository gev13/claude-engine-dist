/**
 * 3.28 — blocks placed inside a post's article. A paragraph holding nothing
 * but `[[block:N]]` (N counted from 1) stands for the post's Nth block, drawn
 * at that place in the article's column. The text is cut there; a marker for
 * a block the post does not have is left as it was written.
 */
const MARKER = /<p>\s*\[\[block:(\d{1,2})\]\]\s*<\/p>/g;

export function splitAtBlocks(html: string, count: number): { parts: (string | number)[]; placed: Set<number> } {
  const parts: (string | number)[] = [];
  const placed = new Set<number>();
  if (count === 0 || !html.includes('[[block:')) return { parts: [html], placed };
  let last = 0;
  for (const match of html.matchAll(MARKER)) {
    const index = Number(match[1]) - 1;
    if (index < 0 || index >= count || placed.has(index)) continue;
    const at = match.index ?? 0;
    if (at > last) parts.push(html.slice(last, at));
    parts.push(index);
    placed.add(index);
    last = at + match[0].length;
  }
  if (last < html.length) parts.push(html.slice(last));
  return { parts, placed };
}
