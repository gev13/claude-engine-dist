/**
 * Text split the way a reader sees it: one entry per visible character.
 *
 * A string's `.length` counts UTF-16 code units, so an emoji is two, a flag
 * four and a family emoji eleven. Slicing by that count can cut a character
 * in half, and half an emoji renders as a "?" box. Anything that reveals,
 * counts or measures text a character at a time goes through this instead.
 *
 * `Intl.Segmenter` keeps flags, skin tones and joined (ZWJ) emoji whole;
 * where it is missing, code points at least never split a surrogate pair.
 */

let segmenter: Intl.Segmenter | null | undefined;

export function graphemes(text: string): string[] {
  if (segmenter === undefined) {
    segmenter = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
  }
  if (!segmenter) return Array.from(text);
  return Array.from(segmenter.segment(text), (s) => s.segment);
}

/** Of several strings, the one with the most visible characters (the first on a tie). */
export function longestByGraphemes(words: readonly string[]): string {
  let best = '';
  let bestCount = 0;
  for (const word of words) {
    const count = graphemes(word).length;
    if (count > bestCount) {
      best = word;
      bestCount = count;
    }
  }
  return best;
}
