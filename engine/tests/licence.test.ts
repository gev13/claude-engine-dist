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
   ═══════════════════════════════════════════════════════════════════════════ */

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));
const read = (path: string) => readFileSync(here(path), 'utf8');

const licence = read('../dist-files/LICENSE');
const publish = read('../scripts/publish-dist.mjs');

describe('the licence itself', () => {
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
  it('is copied to the root by the publish script', () => {
    expect(publish).toContain("['engine/dist-files/LICENSE', 'LICENSE']");
  });

  it('is not excluded on the way', () => {
    const exclude = publish.slice(publish.indexOf('const EXCLUDE'), publish.indexOf('const USER_DOCS'));
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
