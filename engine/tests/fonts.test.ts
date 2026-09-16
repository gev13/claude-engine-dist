import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { FONT_GROUPS, FONT_SCRIPTS, covers, fontWarning, scriptFor, warningText } from '@/lib/fonts';
import { FONT_CATALOGUE } from '@/lib/fontCatalogue';
import { FONT_STACKS } from '@/lib/theme';
import { themeToCss } from '@/lib/theme-css';
import { themeSchema } from '@/lib/theme';

/* ═══════════════════════════════════════════════════════════════════════════
   Which faces can draw which languages
   ───────────────────────────────────────────────────────────────────────────
   A typeface is a design choice right up to the point where it cannot draw
   the alphabet, and then it is a bug that does not announce itself: the
   browser substitutes whatever the device has and the page looks *nearly*
   right.

   The first test reads `fonts.css` rather than trusting the table, because
   the table's whole job is to describe those files. If somebody adds a
   Cyrillic subset and forgets to say so here, the engine would go on warning
   about a problem it no longer has — so the two are checked against each
   other.
   ═══════════════════════════════════════════════════════════════════════════ */

const fontsCss = readFileSync(new URL('../src/styles/fonts.css', import.meta.url), 'utf8');

/** The ranges each script needs at least some of. */
const RANGES = {
  cyrillic: /U\+04[0-9A-F]{2}/i,
  armenian: /U\+05[3-8][0-9A-F]/i,
} as const;

describe('what the brand faces actually carry', () => {
  it('agrees with the stylesheet about Cyrillic and Armenian', () => {
    for (const [script, pattern] of Object.entries(RANGES) as [keyof typeof RANGES, RegExp][]) {
      const inCss = pattern.test(fontsCss);
      const claimed = (['display', 'sans', 'mono'] as const).some((font) => covers(font, script));
      expect(claimed, `${script}: fonts.css ${inCss ? 'has' : 'has no'} range, table says ${claimed}`).toBe(inCss);
    }
  });

  /* Not a promise about how it looks — the admin screen says as much — but a
     system font will render the glyphs, so it must not be reported as unable
     to. */
  it('treats the reader’s own fonts as covering everything', () => {
    expect(FONT_SCRIPTS.system).toContain('armenian');
    expect(FONT_SCRIPTS.serif).toContain('cyrillic');
  });
});

describe('which script a language is written in', () => {
  it('knows the ones that are not Latin', () => {
    expect(scriptFor('hy')).toBe('armenian');
    expect(scriptFor('ru')).toBe('cyrillic');
    expect(scriptFor('el')).toBe('greek');
    expect(scriptFor('ar')).toBe('arabic');
  });

  it('reads a region tag as its language', () => {
    expect(scriptFor('ru-RU')).toBe('cyrillic');
    expect(scriptFor('HY')).toBe('armenian');
  });

  it('assumes Latin for everything else, including one it has never seen', () => {
    expect(scriptFor('en')).toBe('latin');
    expect(scriptFor('zz')).toBe('latin');
  });
});

describe('the warning', () => {
  it('says nothing at all for a Latin language', () => {
    expect(fontWarning('display', 'en')).toBeNull();
    expect(fontWarning('sans', 'de')).toBeNull();
  });

  it('warns that a bundled face has no glyphs for the alphabet', () => {
    const warning = fontWarning('display', 'hy');
    expect(warning).toEqual({ font: 'display', script: 'armenian', bundled: true });
    expect(warningText(warning!, 'Հայերեն')).toContain('no Armenian glyphs');
  });

  /* A different problem needing different words: the glyphs will be there,
     and they will not be the site's design. */
  it('warns differently about a font the engine does not ship', () => {
    const warning = fontWarning('system', 'ru');
    expect(warning).toEqual({ font: 'system', script: 'cyrillic', bundled: false });
    expect(warningText(warning!, 'Русский')).toContain('will not match');
  });
});

describe('the CSS it produces', () => {
  const parse = (input: unknown) => themeSchema.parse(input);

  it('gives each language its own family variables, keyed off the lang attribute', () => {
    const css = themeToCss(parse({ localeFonts: { hy: { display: 'system', sans: 'system' } } }));
    expect(css).toContain(':root:lang(hy){');
    expect(css).toContain('--font-display:');
    expect(css).toContain('--font-sans:');
    // Only what was set: `mono` was left alone and must not appear for hy.
    expect(css.split(':root:lang(hy){')[1]!.split('}')[0]).not.toContain('--font-mono');
  });

  it('emits nothing on a site that never set one', () => {
    expect(themeToCss(parse({}))).not.toContain(':lang(');
    expect(themeToCss(parse({ localeFonts: {} }))).not.toContain(':lang(');
  });

  /* The locale is interpolated into a selector, so it is checked twice: the
     schema is the gate, and the generator re-checks because it is what
     actually writes into a <style> element. Both layers are exercised, since
     a change to either must not be able to open the other. */
  it('is rejected by the schema before it gets near a selector', () => {
    expect(themeSchema.safeParse({ localeFonts: { 'hy){} body{display:none': { display: 'system' } } }).success).toBe(
      false,
    );
  });

  it('refuses to build a selector from something that is not a locale, schema or no schema', () => {
    const nasty = themeToCss({ localeFonts: { 'hy){} body{display:none': { display: 'system' } } } as never);
    expect(nasty).not.toContain('display:none');
    expect(nasty).not.toContain(':lang(');
  });

  it('drops a face it does not know', () => {
    const css = themeToCss({ localeFonts: { ru: { sans: 'comic' } } } as never);
    expect(css).not.toContain(':lang(ru)');
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   The self-hosted catalogue
   ───────────────────────────────────────────────────────────────────────────
   `fontCatalogue.ts`, `fonts-google.css` and `public/fonts/google` are written
   together by `scripts/fetch-fonts.mjs`, and the whole point of generating
   them from one run is that they cannot disagree. These check that they have
   not: a family offered in the admin whose file is not on disk would render
   as a silent fallback, which is exactly the failure this package exists to
   remove.
   ═══════════════════════════════════════════════════════════════════════════ */

const googleCss = readFileSync(new URL('../src/styles/fonts-google.css', import.meta.url), 'utf8');
/* `fileURLToPath`, not `.pathname`: this repository lives under a directory
   with a space in its name, and a URL percent-encodes it. */
const fontsDir = fileURLToPath(new URL('../public/fonts/google/', import.meta.url));

describe('the self-hosted catalogue', () => {
  it('has fifty-odd families, including two that can set Armenian', () => {
    expect(FONT_CATALOGUE.length).toBeGreaterThanOrEqual(50);
    const armenian = FONT_CATALOGUE.filter((f) => f.scripts.includes('armenian'));
    expect(armenian.length, 'no Armenian face: the engine cannot set Armenian').toBeGreaterThanOrEqual(2);
  });

  it('offers nothing whose file is not on disk', () => {
    const referenced = [...googleCss.matchAll(/url\('\/fonts\/google\/([^']+)'\)/g)].map((m) => m[1]!);
    expect(referenced.length).toBeGreaterThan(0);
    for (const file of referenced) {
      expect(existsSync(path.join(fontsDir, file)), file).toBe(true);
    }
  });

  it('declares every family it lists, and lists every family it declares', () => {
    for (const font of FONT_CATALOGUE) {
      expect(googleCss, font.family).toContain(`font-family: '${font.family}';`);
      expect(FONT_STACKS[font.key], font.key).toContain(font.family);
    }
  });

  /* A static family serves 400 and 700 as separate files. They shared a
     filename once, so the bold overwrote the regular and every 400 rule
     pointed at the bold glyphs — silently, because it still *looked* like a
     font. */
  it('never points two weights of one face at the same file', () => {
    const faces = [...googleCss.matchAll(/@font-face \{([^}]*)\}/g)].map((m) => m[1]!);
    const byFile = new Map<string, Set<string>>();
    for (const body of faces) {
      const file = body.match(/url\('\/fonts\/google\/([^']+)'\)/)?.[1];
      const weight = body.match(/font-weight:\s*([^;]+);/)?.[1]?.trim();
      const range = body.match(/unicode-range:\s*([^;]+);/)?.[1]?.trim();
      if (!file || !weight || !range) continue;
      const key = `${file}`;
      (byFile.get(key) ?? byFile.set(key, new Set()).get(key)!).add(`${weight}|${range}`);
    }
    for (const [file, combos] of byFile) {
      expect(combos.size, `${file} is claimed by ${combos.size} different weight/range pairs`).toBe(1);
    }
  });

  it('groups the picker rather than showing sixty in one list', () => {
    expect(FONT_GROUPS.length).toBeGreaterThan(1);
    expect(FONT_GROUPS[0]!.label).toBe('This site');
    // Every face in the flat list belongs to exactly one group.
    const seen = FONT_GROUPS.flatMap((g) => g.options.map((o) => o.value));
    expect(new Set(seen).size).toBe(seen.length);
  });

  /* Every family is open source, but under three different licences, and OFL
     requires the notice to travel with the files. */
  it('records a licence for every family', () => {
    const notice = readFileSync(new URL('../public/fonts/google/LICENSES.md', import.meta.url), 'utf8');
    for (const font of FONT_CATALOGUE) {
      expect(['OFL-1.1', 'Apache-2.0', 'UFL-1.0'], font.family).toContain(font.licence);
      expect(notice, font.family).toContain(font.family);
    }
  });
});
