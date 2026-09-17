import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/* ═══════════════════════════════════════════════════════════════════════════
   A test that ships must pass where it lands
   ───────────────────────────────────────────────────────────────────────────
   The test suite travels to the distribution; a handful of files deliberately
   do not. Write a test that reads one of those and it is green here and red
   there — on a repository whose owner cannot see this one and has no idea what
   the missing fixture was.

   That happened: `tests/licence.test.ts` read `dist-files/LICENSE` and the
   publish script, both stripped on purpose, and turned the distribution's CI
   red over a licence that was entirely correct.

   So: a test may mention a stripped path, but only if it also asks whether the
   file is there. `existsSync` in the same file is the evidence that it
   degrades rather than throws. Crude, and it catches the exact mistake.

   This runs only in the development repository — the one that has the list.
   ═══════════════════════════════════════════════════════════════════════════ */

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));
const PUBLISH = here('../scripts/publish-dist.mjs');

/**
 * The paths the distribution strips, read from the script that strips them.
 *
 * Comments are removed before the quotes are matched, because the prose in
 * that block contains apostrophes — "the distribution's own README", "a
 * user's server" — and a naive match pairs them into entries that are not
 * paths at all. One of those was a bare comma, which then "matched" every
 * test file in the suite.
 */
function stripped(): string[] {
  /* `describe.runIf(false)` still runs the callback to collect the tests
     inside it, so this is reached even where the suite is skipped — and this
     file would then be the very thing it exists to prevent: a test that reads
     a stripped path and throws in the distribution. Caught by running the
     suite against a simulated distribution tree, which is the only check that
     actually speaks for that repository. */
  if (!existsSync(PUBLISH)) return [];

  const source = readFileSync(PUBLISH, 'utf8');
  const block = source
    .slice(source.indexOf('const EXCLUDE'), source.indexOf('];', source.indexOf('const EXCLUDE')))
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
  return [...block.matchAll(/'([^']+)'/g)].map((m) => m[1]!).filter((entry) => /^[A-Za-z0-9._/-]+$/.test(entry));
}

/** Every test file, including the ones in `tests/ui`. */
function testFiles(dir = here('.')): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return testFiles(full);
    return entry.name.endsWith('.test.ts') || entry.name.endsWith('.test.tsx') ? [full] : [];
  });
}

describe.runIf(existsSync(PUBLISH))('tests that read files the distribution strips', () => {
  const excluded = stripped();

  it('reads its own exclusion list rather than a copy of it', () => {
    // If this ever comes back empty the whole check passes vacuously.
    expect(excluded.length).toBeGreaterThan(5);
    expect(excluded).toContain('engine/dist-files');
    expect(excluded).toContain('engine/scripts/publish-dist.mjs');
  });

  /* The parser is the part that failed first, so it checks itself: anything
     with whitespace in it came from prose, not from the list. */
  it('parses paths, not fragments of the comments around them', () => {
    for (const entry of excluded) {
      expect(entry, entry).not.toMatch(/\s/);
      expect(entry.length, entry).toBeGreaterThan(1);
    }
  });

  it('either avoid them or cope with their absence', () => {
    const offenders: string[] = [];

    for (const file of testFiles()) {
      const source = readFileSync(file, 'utf8');
      // This file names the paths in prose; that is not a read.
      if (file.endsWith('distributionTests.test.ts')) continue;

      for (const exclusion of excluded) {
        const leaf = exclusion.replace(/^engine\//, '');
        if (!source.includes(leaf)) continue;
        if (source.includes('existsSync')) continue;
        offenders.push(`${path.basename(file)} reads ${leaf} without checking it is there`);
      }
    }

    expect(offenders).toEqual([]);
  });
});
