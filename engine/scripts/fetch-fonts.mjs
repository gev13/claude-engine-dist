#!/usr/bin/env node
/**
 * Fetch and self-host the font catalogue from Google Fonts.
 *
 * Run rarely and deliberately — the output is committed, so a site never
 * fetches a font at build time and never at run time. Google's CSS API already
 * serves **subset** `.woff2` files with the matching `unicode-range`, so there
 * is nothing to subset here: asking for the right subsets and keeping the
 * ranges is the whole job.
 *
 *   npm run fonts:fetch            # everything in FAMILIES
 *   npm run fonts:fetch -- Lora    # one family, for adding a face later
 *
 * It writes three things and nothing else:
 *   public/fonts/google/*.woff2      the files
 *   src/styles/fonts-google.css      the @font-face rules
 *   src/lib/fontCatalogue.ts         family, stack and script coverage
 *
 * Licensing: every family in the Google Fonts catalogue is open source, but
 * under three different licences — OFL, Apache 2.0 and UFL. OFL requires the
 * licence text to travel with the font, so the licence of each family is
 * looked up from the google/fonts repository layout and recorded in
 * public/fonts/google/LICENSES.md. A family whose licence cannot be
 * established is skipped rather than shipped.
 */

import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

/* A browser user agent, because the API serves .ttf to anything it does not
   recognise and .woff2 only to a modern browser. */
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/**
 * The subsets worth carrying.
 *
 * European plus Armenian, which is what the engine's language list actually
 * needs. Vietnamese, Devanagari, Thai and the CJK sets are deliberately left
 * out: each is large, none is in `LANGUAGES`, and a family can be re-fetched
 * with more when a site needs them.
 *
 * `cyrillic-ext` and `greek-ext` are left out for a different reason: they
 * carry historic and minority alphabets — Church Slavonic, polytonic Greek —
 * that modern Russian and Greek do not use, and they are not free.
 */
const SUBSETS = new Set(['latin', 'latin-ext', 'cyrillic', 'greek', 'armenian']);

/**
 * Fifty families, in rough order of how often they are used, plus the two
 * Armenian faces — without which this engine cannot set Armenian at all,
 * which is the whole reason for the exercise.
 *
 * `mono` and `serif` mark the role a family is *for*, so the admin can group
 * them; everything else is a sans or a display face.
 */
const FAMILIES = [
  ['Roboto', 'sans'], ['Open Sans', 'sans'], ['Noto Sans', 'sans'], ['Montserrat', 'sans'],
  ['Lato', 'sans'], ['Poppins', 'sans'], ['Inter', 'sans'], ['Roboto Condensed', 'sans'],
  ['Oswald', 'display'], ['Chakra Petch', 'display'], ['Raleway', 'sans'], ['Nunito Sans', 'sans'], ['Nunito', 'sans'],
  ['Ubuntu', 'sans'], ['Rubik', 'sans'], ['Work Sans', 'sans'], ['Fira Sans', 'sans'],
  ['Mulish', 'sans'], ['Barlow', 'sans'], ['Quicksand', 'sans'], ['Titillium Web', 'sans'],
  ['Heebo', 'sans'], ['Josefin Sans', 'display'], ['DM Sans', 'sans'], ['Karla', 'sans'],
  ['Manrope', 'sans'], ['Source Sans 3', 'sans'], ['Space Grotesk', 'sans'], ['IBM Plex Sans', 'sans'],
  ['Cabin', 'sans'], ['Arimo', 'sans'], ['Dosis', 'sans'], ['Exo 2', 'sans'],
  ['Hind', 'sans'], ['Outfit', 'sans'], ['Figtree', 'sans'], ['Plus Jakarta Sans', 'sans'],
  ['PT Sans', 'sans'], ['Asap', 'sans'], ['Assistant', 'sans'], ['Commissioner', 'sans'],

  ['Playfair Display', 'serif'], ['Merriweather', 'serif'], ['Noto Serif', 'serif'],
  ['Lora', 'serif'], ['PT Serif', 'serif'], ['Bitter', 'serif'], ['Libre Baskerville', 'serif'],
  ['Alegreya', 'serif'],

  ['Roboto Mono', 'mono'], ['JetBrains Mono', 'mono'], ['Source Code Pro', 'mono'],
  ['IBM Plex Mono', 'mono'], ['Inconsolata', 'mono'],

  ['Noto Sans Armenian', 'sans'], ['Noto Serif Armenian', 'serif'],
];

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT_DIR = path.join(ROOT, 'public/fonts/google');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** A stable key for a family: "Noto Sans Armenian" → "notoSansArmenian". */
function keyOf(family) {
  const words = family.replace(/[^A-Za-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
  return words.map((w, i) => (i === 0 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase())).join('');
}

/**
 * A filename that is only ever generated here.
 *
 * The **weight** is part of it, and has to be: a static family serves 400 and
 * 700 as separate files with the same family, style and subset, so leaving it
 * out meant the bold overwrote the regular and every `font-weight: 400` rule
 * then pointed at the bold file. A variable family collapses to one `var`
 * file per subset and style, which is the whole reason to prefer it.
 */
const fileNameOf = (family, style, subset, weight) => {
  const slug = family.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const w = weight.includes(' ') ? 'var' : weight.trim();
  return `${slug}-${style}-${w}-${subset}.woff2`;
};

async function getText(url) {
  const res = await fetch(url, { headers: { 'user-agent': UA } });
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  return res.text();
}

/**
 * The licence, from the directory a family sits in in google/fonts.
 *
 * `ofl/`, `apache/` and `ufl/` are the three, and the directory *is* the
 * licence — which makes this a cheap, factual lookup rather than a guess.
 */
async function licenceOf(family) {
  const dir = family.toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const [licence, folder] of [['OFL-1.1', 'ofl'], ['Apache-2.0', 'apache'], ['UFL-1.0', 'ufl']]) {
    const res = await fetch(`https://raw.githubusercontent.com/google/fonts/main/${folder}/${dir}/METADATA.pb`, {
      method: 'HEAD',
    });
    if (res.ok) return licence;
  }
  return null;
}

/**
 * One family's faces.
 *
 * The API rejects an axis a family does not have, so the variable form is
 * tried first and the static weights are the fallback. Italic is asked for
 * separately: a family without one answers 400 and is simply roman-only.
 */
async function fetchFamily(family) {
  const name = family.replace(/ /g, '+');
  const attempts = [
    `${name}:ital,wght@0,100..900;1,100..900`,
    `${name}:wght@100..900`,
    // A static family with the in-between weights a design asks for (2.21: Chakra Petch's 500 and 600).
    `${name}:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,700`,
    `${name}:ital,wght@0,400;0,700;1,400;1,700`,
    `${name}:wght@400;700`,
    name,
  ];

  for (const spec of attempts) {
    try {
      const css = await getText(`https://fonts.googleapis.com/css2?family=${spec}&display=swap`);
      if (css.includes('@font-face')) return css;
    } catch {
      /* Try the next, less demanding, shape. */
    }
    await sleep(120);
  }
  return null;
}

/** Split the API's CSS into one record per @font-face, keeping its subset comment. */
function parseFaces(css) {
  const faces = [];
  const pattern = /\/\*\s*([a-z0-9-]+)\s*\*\/\s*@font-face\s*\{([^}]*)\}/g;
  let match;
  while ((match = pattern.exec(css))) {
    const [, subset, body] = match;
    const url = body.match(/url\((https:\/\/[^)]+\.woff2)\)/)?.[1];
    const range = body.match(/unicode-range:\s*([^;]+);/)?.[1]?.trim();
    const weight = body.match(/font-weight:\s*([^;]+);/)?.[1]?.trim() ?? '400';
    const style = body.match(/font-style:\s*([^;]+);/)?.[1]?.trim() ?? 'normal';
    if (url && range) faces.push({ subset, url, range, weight, style });
  }
  return faces;
}

/** The scripts a set of subsets adds up to, in the engine's own vocabulary. */
function scriptsOf(subsets) {
  const scripts = new Set();
  for (const subset of subsets) {
    if (subset.startsWith('latin')) scripts.add('latin');
    if (subset.startsWith('cyrillic')) scripts.add('cyrillic');
    if (subset.startsWith('greek')) scripts.add('greek');
    if (subset === 'armenian') scripts.add('armenian');
  }
  return [...scripts];
}

/** The catalogue as last written, for a run that adds to it rather than replacing it. */
async function existingCatalogue() {
  const text = await readFile(path.join(ROOT, 'src/lib/fontCatalogue.ts'), 'utf8').catch(() => '');
  const json = text.match(/FONT_CATALOGUE: readonly CatalogueEntry\[\] = (\[[\s\S]*\]);/)?.[1];
  if (!json) return [];
  try {
    return JSON.parse(json);
  } catch {
    return [];
  }
}

async function main() {
  const only = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  const wanted = only.length ? FAMILIES.filter(([f]) => only.includes(f)) : FAMILIES;

  if (wanted.length === 0) {
    console.error(`\nNo family matched ${only.join(', ')}. Names must match FAMILIES exactly.`);
    process.exit(1);
  }

  await mkdir(OUT_DIR, { recursive: true });
  if (!only.length) {
    // A full run replaces the set, so a family dropped from the list leaves.
    for (const name of await readdir(OUT_DIR).catch(() => [])) {
      await rm(path.join(OUT_DIR, name), { force: true });
    }
  }

  const catalogue = [];
  const cssBlocks = [];
  const licences = [];
  let bytes = 0;
  let skipped = 0;

  /* A run for one family keeps every other one. It used to write the three
     outputs from the families it fetched alone, so adding one face emptied
     the catalogue of the other fifty-odd. */
  if (only.length) {
    const refetched = new Set(wanted.map(([family]) => family));
    const kept = await existingCatalogue();
    for (const entry of kept) {
      if (refetched.has(entry.family)) continue;
      catalogue.push(entry);
      licences.push({ family: entry.family, licence: entry.licence });
    }
    const css = await readFile(path.join(ROOT, 'src/styles/fonts-google.css'), 'utf8').catch(() => '');
    for (const block of css.match(/@font-face \{[^}]*\}/g) ?? []) {
      const family = block.match(/font-family: '([^']+)'/)?.[1];
      if (family && !refetched.has(family)) cssBlocks.push(block);
    }
    // The refetched families' old files go; their new ones are written below.
    for (const [family] of wanted) {
      const slug = family.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      for (const name of await readdir(OUT_DIR).catch(() => [])) {
        if (name.startsWith(`${slug}-normal-`) || name.startsWith(`${slug}-italic-`)) await rm(path.join(OUT_DIR, name), { force: true });
      }
    }
  }

  for (const [family, role] of wanted) {
    process.stdout.write(`${family} … `);

    const licence = await licenceOf(family);
    if (!licence) {
      console.log('skipped — licence could not be established');
      skipped += 1;
      continue;
    }

    const css = await fetchFamily(family);
    if (!css) {
      console.log('skipped — no faces returned');
      skipped += 1;
      continue;
    }

    const faces = parseFaces(css).filter((face) => SUBSETS.has(face.subset));
    if (faces.length === 0) {
      console.log('skipped — none of the subsets we carry');
      skipped += 1;
      continue;
    }

    let familyBytes = 0;
    const written = new Set();
    const subsets = new Set();

    for (const face of faces) {
      const res = await fetch(face.url, { headers: { 'user-agent': UA } });
      if (!res.ok) throw new Error(`${res.status} downloading ${face.url}`);
      const data = Buffer.from(await res.arrayBuffer());

      /* A woff2 begins with "wOF2". Checked because this is the one step that
         writes a downloaded file to disk. */
      if (data.subarray(0, 4).toString('latin1') !== 'wOF2') {
        throw new Error(`${family}: ${face.url} is not a woff2`);
      }

      const italic = face.style === 'italic';
      const file = fileNameOf(family, italic ? 'italic' : 'normal', face.subset, face.weight);
      await writeFile(path.join(OUT_DIR, file), data);
      familyBytes += data.byteLength;
      written.add(file);
      subsets.add(face.subset);

      cssBlocks.push(
        `@font-face {\n` +
          `  font-family: '${family}';\n` +
          `  font-style: ${face.style};\n` +
          `  font-weight: ${face.weight};\n` +
          `  font-display: swap;\n` +
          `  src: url('/fonts/google/${file}') format('woff2');\n` +
          `  unicode-range: ${face.range};\n` +
          `}`,
      );
      await sleep(60);
    }

    bytes += familyBytes;
    catalogue.push({ key: keyOf(family), family, role, scripts: scriptsOf(subsets), licence });
    licences.push({ family, licence });
    console.log(`${written.size} files, ${Math.round(familyBytes / 1024)} KB, ${licence}`);
  }

  catalogue.sort((a, b) => a.family.localeCompare(b.family));

  await writeFile(
    path.join(ROOT, 'src/styles/fonts-google.css'),
    `/*\n * Google Fonts, self-hosted.\n *\n * GENERATED by scripts/fetch-fonts.mjs — do not edit by hand.\n *\n * Each file is one subset of one family, and its unicode-range is what makes\n * the browser download it only when the page actually contains those\n * characters. A site that never uses a family pays nothing for it being here.\n *\n * Licences are in public/fonts/google/LICENSES.md.\n */\n\n${cssBlocks.join('\n\n')}\n`,
  );

  await writeFile(
    path.join(ROOT, 'src/lib/fontCatalogue.ts'),
    `/* GENERATED by scripts/fetch-fonts.mjs — do not edit by hand.\n *\n * What each self-hosted family is called, what it is for, which scripts it\n * can actually draw, and the licence it travels under.\n */\n\nexport type CatalogueRole = 'sans' | 'serif' | 'display' | 'mono';\n\nexport type CatalogueEntry = {\n  key: string;\n  family: string;\n  role: CatalogueRole;\n  scripts: readonly string[];\n  licence: string;\n};\n\nexport const FONT_CATALOGUE: readonly CatalogueEntry[] = ${JSON.stringify(catalogue, null, 2)};\n`,
  );

  const rows = licences
    .sort((a, b) => a.family.localeCompare(b.family))
    .map((l) => `| ${l.family} | ${l.licence} |`)
    .join('\n');

  await writeFile(
    path.join(OUT_DIR, 'LICENSES.md'),
    `# Font licences\n\nEvery family here comes from the Google Fonts catalogue and is open source,\nbut under three different licences. The SIL Open Font License requires this\nnotice to travel with the files, which is why this file exists.\n\n- **OFL-1.1** — https://openfontlicense.org\n- **Apache-2.0** — https://www.apache.org/licenses/LICENSE-2.0\n- **UFL-1.0** — https://ubuntu.com/legal/font-licence\n\nSources and full texts: https://github.com/google/fonts\n\n| Family | Licence |\n| --- | --- |\n${rows}\n`,
  );

  console.log(
    `\n${catalogue.length} families, ${Math.round(bytes / 1024 / 1024 * 10) / 10} MB${skipped ? `, ${skipped} skipped` : ''}.`,
  );
  console.log('Wrote public/fonts/google, src/styles/fonts-google.css, src/lib/fontCatalogue.ts.');
}

main().catch((error) => {
  console.error('\nFailed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
