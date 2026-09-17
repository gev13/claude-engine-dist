import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/* ═══════════════════════════════════════════════════════════════════════════
   The licence, and the one it cannot speak for
   ───────────────────────────────────────────────────────────────────────────
   The distribution is public and the development repository is not. Without a
   licence file the legal default is all rights reserved — a public repository
   nobody may use is one published by accident, and it sat that way for a
   while.

   The subtler risk is the opposite: an MIT file at the root reads as covering
   everything beneath it, and the bundled typefaces are not ours to relicense.
   The SIL Open Font License requires its notice to travel with the files, so
   the licence has to say what it does *not* cover.

   ── This file runs in two repositories ──────────────────────────────────────
   And the first version of it did not. It read `dist-files/LICENSE` and the
   publish script, both of which the distribution deliberately strips — so the
   test shipped and its fixtures did not, and the distribution's CI went red on
   a licence that was perfectly correct.

   So it looks for the licence where each repository keeps it: the source copy
   here, the published copy at the root there. The assertions about *how* it
   gets published only run where the publishing happens.
   ═══════════════════════════════════════════════════════════════════════════ */

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));
const read = (path: string) => readFileSync(here(path), 'utf8');

/** The source copy (development) or the published one (distribution). */
const LICENCE_PATH = ['../dist-files/LICENSE', '../../LICENSE'].find((path) => existsSync(here(path)));
const licence = LICENCE_PATH ? read(LICENCE_PATH) : '';

/** Only the development repository has the script that publishes. */
const PUBLISH_PATH = '../scripts/publish-dist.mjs';
const publish = existsSync(here(PUBLISH_PATH)) ? read(PUBLISH_PATH) : null;

describe('the licence itself', () => {
  it('exists in whichever repository this is', () => {
    expect(LICENCE_PATH, 'no LICENSE found in either place').toBeDefined();
  });

  it('is MIT, with a holder and a year', () => {
    expect(licence).toContain('MIT License');
    expect(licence).toMatch(/Copyright \(c\) \d{4} \S/);
    // The grant and the disclaimer are the two halves that make it MIT.
    expect(licence).toContain('without restriction');
    expect(licence).toContain('WITHOUT WARRANTY OF ANY KIND');
  });

  it('does not silently claim the bundled typefaces', () => {
    expect(licence).toContain('SIL Open Font License');
    expect(licence).toContain('public/fonts/google/LICENSES.md');
    expect(licence).toMatch(/cannot relicense/);
  });
});

describe('it reaches the distribution', () => {
  /* The distribution is generated. A LICENSE added to that repository by hand
     is a LICENSE the next release overwrites. */
  it.runIf(publish)('is copied to the root by the publish script', () => {
    expect(publish).toContain("['engine/dist-files/LICENSE', 'LICENSE']");
  });

  it.runIf(publish)('is not excluded on the way', () => {
    const exclude = publish!.slice(publish!.indexOf('const EXCLUDE'), publish!.indexOf('const USER_DOCS'));
    expect(exclude).not.toContain('LICENSE');
  });
});

describe('the notice the OFL requires still travels', () => {
  it('is present in the repository', () => {
    expect(existsSync(here('../public/fonts/google/LICENSES.md'))).toBe(true);
  });

  it('names every licence the bundled families are under', () => {
    const notice = read('../public/fonts/google/LICENSES.md');
    for (const name of ['OFL-1.1', 'Apache-2.0', 'UFL-1.0']) {
      expect(notice, name).toContain(name);
    }
  });
});
