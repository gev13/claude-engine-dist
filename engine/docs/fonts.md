# Fonts

The engine self-hosts every typeface. No third-party origin means no CSP
exception, no render-blocking request to another domain, and no font loading
after the page has already drawn — which is worth real milliseconds of LCP.

The cost of that is the one this file is about: a face only draws the alphabets
whose glyphs are actually in the file on disk.

## What is bundled

**Three brand faces** plus a **self-hosted catalogue of 55 Google Fonts**
(13 MB, 488 files). An editor picks from all of them; a visitor downloads only
the subsets of the families a page actually uses, because every `@font-face`
carries a `unicode-range`. A family nobody picks costs a visitor nothing.

The catalogue is fetched by `npm run fonts:fetch`, which writes
`public/fonts/google/`, `src/styles/fonts-google.css` and
`src/lib/fontCatalogue.ts` **together** — so a family cannot be offered in the
admin unless its file is on disk. `tests/fonts.test.ts` checks that every
referenced file exists.

To slim the set, edit `FAMILIES` in `scripts/fetch-fonts.mjs` and re-run; to
add one family without touching the rest, `npm run fonts:fetch -- "Lora"`.

Subsets carried: latin, latin-ext, cyrillic, greek, armenian. Not carried:
`cyrillic-ext` and `greek-ext` (Church Slavonic, polytonic Greek — not used by
modern Russian or Greek), and the Vietnamese, Indic and CJK sets.

### The three brand faces

**Latin and Latin-Extended only**:

| Key | Family | Role | Subsets |
| --- | --- | --- | --- |
| `display` | Bricolage Grotesque | Headings | latin, latin-ext |
| `sans` | Archivo | Body | latin, latin-ext |
| `mono` | JetBrains Mono | Labels | latin, latin-ext |

Plus two that are not bundled at all — `system` and `serif` — which resolve to
whatever the reader's device has.

**So those three cannot set Armenian or Russian.** Pick one for an Armenian
site and the page renders in whatever the phone substituted — it usually looks
nearly right, which is exactly why nobody notices. `src/lib/fonts.ts` knows
this and the Appearance screen says it out loud.

For Armenian the catalogue has **Noto Sans Armenian** and **Noto Serif
Armenian**; for Cyrillic and Greek, most of the 55.

## Adding a face, or a subset of one you already have

Four steps, and the fourth is the one that is easy to forget.

### 1. Subset the file

Ship one `.woff2` per script, not one file with everything in it. A visitor
reading English should not download Armenian glyphs.

```bash
# pip install fonttools brotli
pyftsubset SourceFont.ttf \
  --output-file=public/fonts/myface-var-armenian.woff2 \
  --flavor=woff2 --layout-features='*' \
  --unicodes='U+0530-058F,U+FB13-FB17'
```

Useful ranges:

| Script | Unicode range |
| --- | --- |
| Cyrillic | `U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116` |
| Cyrillic Extended | `U+0460-052F,U+1C80-1C88,U+20B4,U+2DE0-2DFF,U+A640-A69F,U+FE2E-FE2F` |
| Greek | `U+0370-03FF` |
| Armenian | `U+0530-058F,U+FB13-FB17` |

A variable font covers every weight in one file; a static one needs a file per
weight you actually use.

### 2. Declare it in `src/styles/fonts.css`

```css
@font-face {
  font-family: 'Archivo';
  font-style: normal;
  font-weight: 100 900;
  font-display: swap;
  src: url('/fonts/archivo-var-armenian.woff2') format('woff2');
  unicode-range: U+0530-058F, U+FB13-FB17;
}
```

The `unicode-range` is what makes this work: the browser downloads the file
**only** when the page actually contains those characters. Same family name as
the Latin declaration, so nothing else has to change — `--font-sans` already
says `'Archivo'`.

### 3. Add it to the allowlist, if it is a new family

`FONT_STACKS` and `FONT_LABELS` in `src/lib/theme.ts`. Fonts are an allowlist
rather than free text, because the value is interpolated into a `<style>`
element.

### 4. Tell `src/lib/fonts.ts` what it now covers

```ts
export const FONT_SCRIPTS: Record<FontKey, readonly Script[]> = {
  display: ['latin'],
  sans: ['latin', 'armenian'],   // ← the new subset
  ...
};
```

Miss this and the engine goes on warning about a problem it no longer has.
`tests/fonts.test.ts` reads `fonts.css` and compares it against this table, so
a forgotten update fails the build rather than misleading an editor.

## Choosing a face per language

Appearance → Typography → **Fonts by language**, on a multilingual site. Each
language may override the three family variables; a language with no entry uses
the site's own fonts.

It works through the `lang` attribute the site layout already sets:

```css
:root:lang(hy) { --font-display: …; --font-sans: …; }
```

No JavaScript, no per-page branching, and nothing at all is emitted on a site
that speaks one language.

## Licensing

Check it before adding a face. Most Google Fonts are OFL, which permits
self-hosting and subsetting; a commercial licence often does not. The engine
ships nothing it has not got a licence for, and neither should a site built on
it.
