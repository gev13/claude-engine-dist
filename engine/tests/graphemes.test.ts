import { describe, expect, it } from 'vitest';
import { graphemes, longestByGraphemes } from '../src/lib/graphemes';

const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

const SMILE = '\u{1F60E}';
const FLAG = '\u{1F1E6}\u{1F1F2}';
const FAMILY = '\u{1F468}‍\u{1F469}‍\u{1F467}';
const THUMB = '\u{1F44D}\u{1F3FD}';

describe('graphemes', () => {
  it('splits plain text into its letters', () => {
    expect(graphemes('Cool')).toEqual(['C', 'o', 'o', 'l']);
    expect(graphemes('')).toEqual([]);
  });

  it('keeps an emoji, a flag, a skin tone and a joined (ZWJ) emoji whole', () => {
    expect(graphemes(`Stay Cool ${SMILE}`)).toHaveLength(11);
    expect(graphemes(`Stay Cool ${SMILE}`).at(-1)).toBe(SMILE);
    expect(graphemes(`Hi ${FLAG}`)).toEqual(['H', 'i', ' ', FLAG]);
    expect(graphemes(FAMILY)).toEqual([FAMILY]);
    expect(graphemes(`${THUMB}!`)).toEqual([THUMB, '!']);
  });

  it('never leaves half a character in any typed frame', () => {
    for (const word of [`Stay Cool ${SMILE}`, `Go ${FLAG}`, `${FAMILY} home`, `${THUMB}${SMILE}`]) {
      const letters = graphemes(word);
      for (let n = 0; n <= letters.length; n += 1) {
        const frame = letters.slice(0, n).join('');
        expect(LONE_SURROGATE.test(frame), `${JSON.stringify(frame)} from ${JSON.stringify(word)}`).toBe(false);
        expect(word.startsWith(frame)).toBe(true);
      }
      expect(letters.join('')).toBe(word);
    }
  });

  it('falls back to code points without Intl.Segmenter, still never splitting a surrogate pair', () => {
    expect(Array.from(`Cool ${SMILE}`)).toHaveLength(6);
  });
});

describe('longestByGraphemes', () => {
  it('measures by visible characters, not UTF-16 units', () => {
    // The family emoji is eight units but one character.
    expect(longestByGraphemes([FAMILY, 'abc'])).toBe('abc');
    expect(longestByGraphemes(['ab', `a${FLAG}`, 'cd'])).toBe('ab');
    expect(longestByGraphemes(['short', 'longer', 'other1'])).toBe('longer');
    expect(longestByGraphemes([])).toBe('');
  });
});
