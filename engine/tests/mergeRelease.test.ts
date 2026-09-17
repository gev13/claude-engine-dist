import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
// @ts-expect-error — a plain .mjs script, imported for the decisions it makes.
import { pickRemote, versionOf } from '../scripts/merge-release.mjs';

/* ═══════════════════════════════════════════════════════════════════════════
   Merging a release into a site that has commits of its own
   ───────────────────────────────────────────────────────────────────────────
   The updater will not do this on the server, and the reason is written down
   there: a conflict mid-update leaves a half-merged tree on a production box
   and an updater that refuses every later attempt. So it happens here, and
   this script is the automation of what was previously done by hand — badly,
   twice.

   The git work is proved against real repositories rather than mocked. What
   is pinned here is the judgement: which remote, which version, and the
   refusals that must never be skipped on the way to a tag.
   ═══════════════════════════════════════════════════════════════════════════ */

const source = readFileSync(fileURLToPath(new URL('../scripts/merge-release.mjs', import.meta.url)), 'utf8');

describe('choosing the remote', () => {
  it('takes the one that is not origin', () => {
    expect(pickRemote(['origin', 'engine'])).toBe('engine');
    expect(pickRemote(['upstream', 'origin'])).toBe('upstream');
  });

  it('takes the one named, whatever else is there', () => {
    expect(pickRemote(['origin', 'engine', 'fork'], 'fork')).toBe('fork');
  });

  /* Guessing between several would be the kind of convenience that points a
     production site at the wrong tree. */
  it('refuses to guess between several', () => {
    expect(() => pickRemote(['origin', 'engine', 'upstream'])).toThrow(/--remote/);
  });

  it('says what to do when there is only an origin', () => {
    expect(() => pickRemote(['origin'])).toThrow(/Add the engine as a remote/);
  });

  it('refuses a remote that does not exist rather than falling back', () => {
    expect(() => pickRemote(['origin', 'engine'], 'nope')).toThrow(/no remote called "nope"/);
  });
});

describe('reading the version', () => {
  it('reads it from a package.json', () => {
    expect(versionOf('{"version":"2.4.0"}')).toBe('2.4.0');
  });

  it('returns nothing rather than throwing on rubbish', () => {
    expect(versionOf('not json')).toBeNull();
    expect(versionOf('{}')).toBeNull();
    expect(versionOf('{"version":42}')).toBeNull();
  });
});

describe('what the script must never do', () => {
  /* The mistake that nearly cost a live site its deployment settings: the
     engine's `v2.1.0` and the site's `v2.1.0` are different trees, and
     fetching tags puts both names in one namespace. */
  it('never fetches tags into this repository', () => {
    for (const fetch of source.match(/git\(\['fetch'[^\]]*\]/g) ?? []) {
      expect(fetch, fetch).toContain("'--no-tags'");
    }
    expect(source).not.toMatch(/'fetch',\s*'--tags'/);
  });

  it('never pushes the branch, only a tag', () => {
    for (const push of source.match(/git\(\['push'[^\]]*\]/g) ?? []) {
      expect(push, push).toContain('refs/tags/');
    }
  });

  /* Pushing is the one outward step, so it is opt-in. A script that published
     by default would be a script people run once and regret. */
  it('pushes nothing unless asked', () => {
    expect(source).toContain("ARGS.includes('--push')");
    expect(source).toContain('if (WANT_PUSH)');
  });
});

describe('after a conflict is resolved by hand', () => {
  /* The script tells you to merge by hand and run it again to check and tag.
     It then found nothing to merge and bailed out, so the instruction it
     printed was a lie and the checking and tagging never happened. */
  it('carries on to the checking rather than bailing out', () => {
    expect(source).toContain('const merged = behind === ');
    expect(source).toMatch(/already merged here/);
  });

  it('skips only the merge, not the verification', () => {
    expect(source).toContain('if (!merged) git([\'merge\'');
  });

  it('still refuses to tag the same release twice', () => {
    expect(source).toContain('existingTag(target)');
    expect(source).toMatch(/already tagged here/);
  });
});

describe('the refusals on the way to a tag', () => {
  /* `lastIndexOf`: the helper that *reads* tags also matches this, and it is
     defined near the top — anchoring on the first occurrence sliced away the
     whole run and every assertion below passed against an empty string. */
  const beforeTag = source.slice(0, source.lastIndexOf("git(['tag'"));

  it('refuses to merge over uncommitted work', () => {
    expect(beforeTag).toMatch(/uncommitted changes/);
  });

  it('refuses a detached checkout, which has no branch to merge into', () => {
    expect(beforeTag).toMatch(/not on a branch/);
  });

  it('undoes a conflicted merge rather than leaving it half done', () => {
    expect(beforeTag).toContain("'merge', '--abort'");
    expect(beforeTag).toMatch(/has been undone/);
  });

  it('checks the merged version before tagging it', () => {
    expect(beforeTag).toContain("'HEAD:engine/package.json'");
    expect(beforeTag).toMatch(/resolved the wrong way/);
  });

  /* The check that a merge did not quietly take the engine's copy of a file
     this site had deliberately changed — its ports, its process name. */
  it('checks the site’s own files survived the merge', () => {
    expect(beforeTag).toContain('sameAs(releaseRef, file)');
    expect(beforeTag).toMatch(/took the engine's copy/);
    expect(beforeTag).toMatch(/Nothing has been tagged/);
  });
});
