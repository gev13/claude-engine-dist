import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error — a plain .mjs helper of the font fetcher, without types.
import { weightRange } from '../scripts/lib/woff2-axes.mjs';

/* 3.17.1 — a variable font is one file for every weight. Declared as two
   single weights (400 and 700) on that one file, a browser drew 500 and 600
   as 400: Manrope Medium and SemiBold came out Regular. Each variable file is
   now declared once, across its own weight range. */

const fontsDir = path.join(__dirname, '../public/fonts/google');
const css = readFileSync(path.join(__dirname, '../src/styles/fonts-google.css'), 'utf8');
const faces = [...css.matchAll(/@font-face \{([^}]*)\}/g)].map((m) => ({
  family: m[1]!.match(/font-family: '([^']+)'/)![1]!,
  style: m[1]!.match(/font-style:\s*([^;]+);/)![1]!.trim(),
  weight: m[1]!.match(/font-weight:\s*([^;]+);/)![1]!.trim(),
  file: m[1]!.match(/url\('\/fonts\/google\/([^']+)'\)/)![1]!,
  range: m[1]!.match(/unicode-range:\s*([^;]+);/)![1]!.trim(),
}));
const hash = (file: string) => createHash('md5').update(readFileSync(path.join(fontsDir, file))).digest('hex');

describe('variable Google fonts', () => {
  it('declare one file per face, never the same bytes under two weights', () => {
    const seen = new Map<string, string>();
    for (const face of faces) {
      const key = `${face.family}|${face.style}|${face.range}|${hash(face.file)}`;
      expect(seen.get(key), `${face.file} (${face.weight}) repeats ${seen.get(key)}`).toBeUndefined();
      seen.set(key, `${face.file} (${face.weight})`);
    }
  });

  it('declare a variable file across (at most) the weight range it carries', () => {
    for (const face of faces.filter((f) => f.file.includes('-var-'))) {
      const range = weightRange(readFileSync(path.join(fontsDir, face.file)));
      expect(range, face.file).not.toBeNull();
      const [lo, hi] = face.weight.split(' ').map(Number);
      expect(lo! >= range[0] && hi! <= range[1] && lo! < hi!, `${face.file}: ${face.weight} outside ${range}`).toBe(true);
    }
  });

  it('give the site’s button face its medium, semibold and bold', () => {
    const manrope = faces.filter((f) => f.family === 'Manrope' && f.style === 'normal');
    expect(manrope.length).toBeGreaterThan(0);
    expect(manrope.every((f) => f.weight === '200 800')).toBe(true);
  });
});

describe('the woff2 weight axis reader', () => {
  it('reads a variable file’s range and nothing from a static one', () => {
    expect(weightRange(readFileSync(path.join(fontsDir, 'manrope-normal-var-latin.woff2')))).toEqual([200, 800]);
    const fixed = faces.find((f) => /-\d{3}-latin\.woff2$/.test(f.file))!;
    expect(weightRange(readFileSync(path.join(fontsDir, fixed.file)))).toBeNull();
    expect(weightRange(Buffer.from('not a font'))).toBeNull();
  });
});
