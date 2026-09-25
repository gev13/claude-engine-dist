#!/usr/bin/env node
/**
 * Merge an engine release into a site that lives in its own repository, and
 * tag the merge so the site's admin panel can install it.
 *
 *   npm run release:merge                 # the newest release on the remote
 *   npm run release:merge -- 2.4.0        # a particular one
 *   npm run release:merge -- 2.4.0 --push # and push the tag when it passes
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 * The updater fetches `v<version>` from a remote and checks it out. A site
 * that is a plain copy of the engine needs nothing more. A site with commits
 * of its own — its ports, its container names, the pm2 process its server
 * runs — needs the release *combined* with those commits, and that is a merge.
 *
 * The merge deliberately does not happen on the server. A conflict there
 * leaves a half-merged tree on a production box and an updater that will
 * refuse every later attempt. It happens here, where a person can resolve one.
 *
 * ── The two mistakes this exists to prevent ─────────────────────────────────
 * Both were made by hand before this script existed.
 *
 *   1. Fetching the engine's tags writes them into this repository's tag
 *      namespace. The engine's `v2.1.0` and this site's `v2.1.0` are then two
 *      different trees, and pushing the wrong one points the site's server at
 *      the engine's tree — losing every local commit, silently, while
 *      reporting success. Nothing here ever fetches tags.
 *
 *   2. A merge can resolve the wrong way and leave the version behind. The
 *      tag then claims a release the tree is not. Checked before tagging.
 *
 * Never pushes the branch. On a site whose CI deploys from `main`, pushing the
 * branch *is* a deployment, and it takes no backup — the admin panel's update
 * does. So this pushes a tag at most, and says what to do next.
 */

import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const ARGS = process.argv.slice(2);
const WANT_PUSH = ARGS.includes('--push');
const VERSION_ARG = ARGS.find((a) => /^\d+\.\d+\.\d+$/.test(a));
const REMOTE_ARG = (() => {
  const i = ARGS.indexOf('--remote');
  return i >= 0 ? ARGS[i + 1] : undefined;
})();

const git = (args, opts = {}) =>
  execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts }).trim();

/** Do the release and the merge result agree about this file? */
const sameAs = (ref, file) => {
  try {
    /* `:(top)` — the file names come from `git diff --name-only`, which is
       relative to the repository root, while this script runs from
       `engine/`. A bare pathspec was read relative to that, matched nothing,
       and every file the site owned looked "lost" (2.13.0, on a fork site). */
    execFileSync('git', ['diff', '--quiet', ref, 'HEAD', '--', `:(top)${file}`], { stdio: 'ignore' });
    return true; // exit 0 — identical, so this site's version did not survive
  } catch {
    return false; // exit 1 — they differ, which is what a kept customisation looks like
  }
};

const say = (message) => console.log(message);
const die = (message) => {
  console.error(`\n  ${message}\n`);
  process.exit(1);
};

/* ── Pure helpers, exported so they can be tested without a repository ────── */

/**
 * The remote a release comes from: the one named, or the only one that is not
 * `origin`. Guessing between several would be the kind of convenience that
 * points a site at the wrong tree.
 */
export function pickRemote(remotes, named) {
  if (named) {
    if (!remotes.includes(named)) throw new Error(`This repository has no remote called "${named}".`);
    return named;
  }
  const candidates = remotes.filter((name) => name !== 'origin');
  if (candidates.length === 1) return candidates[0];
  if (candidates.length === 0) {
    throw new Error('This repository has only an origin. Add the engine as a remote, or pass --remote.');
  }
  throw new Error(`Several remotes could be the engine (${candidates.join(', ')}). Pass --remote <name>.`);
}

/** Does this repository already carry a tag for that release? */
const existingTag = (version) => {
  try {
    return git(['tag', '-l', `v${version}`]) !== '';
  } catch {
    return false;
  }
};

/** The version in a package.json, or nothing if it cannot be read. */
export function versionOf(packageJson) {
  try {
    const parsed = JSON.parse(packageJson);
    return typeof parsed.version === 'string' ? parsed.version : null;
  } catch {
    return null;
  }
}

/* ── The run ──────────────────────────────────────────────────────────────── */

function main() {
  try {
    if (git(['rev-parse', '--is-inside-work-tree']) !== 'true') die('This is not a git repository.');
  } catch {
    die('git is not available here.');
  }

  if (git(['status', '--porcelain'])) {
    die('This checkout has uncommitted changes. Commit or stash them first — a merge would mix them in.');
  }

  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
  if (branch === 'HEAD') die('This checkout is not on a branch. `git checkout main` first.');

  let remote;
  try {
    remote = pickRemote(git(['remote']).split('\n').filter(Boolean), REMOTE_ARG);
  } catch (error) {
    die(error.message);
  }

  say(`\n  Merging into ${branch} from "${remote}".`);

  /* `--no-tags` is the whole point of mistake (1) above. */
  git(['fetch', '--no-tags', '--prune', remote]);

  const head = `refs/remotes/${remote}/HEAD`;
  let releaseRef;
  try {
    // The remote's default branch, whatever it is called.
    const symbolic = git(['symbolic-ref', head]);
    releaseRef = symbolic.replace('refs/remotes/', '');
  } catch {
    releaseRef = `${remote}/main`;
  }

  let target = VERSION_ARG;
  if (VERSION_ARG) {
    // A specific release: its tag, fetched to FETCH_HEAD and never written here.
    try {
      git(['fetch', '--no-tags', remote, `refs/tags/v${VERSION_ARG}`]);
      releaseRef = 'FETCH_HEAD';
    } catch {
      die(`The "${remote}" remote has no v${VERSION_ARG}.`);
    }
  } else {
    target = versionOf(git(['show', `${releaseRef}:engine/package.json`]));
    if (!target) die(`Could not read a version from ${releaseRef}. Is "${remote}" really the engine?`);
  }

  const already = git(['rev-list', '--count', `${releaseRef}..HEAD`]) !== '0';
  const behind = git(['rev-list', '--count', `HEAD..${releaseRef}`]);

  /* Nothing left to merge. That is either a repeat run, or — the case that
     matters — somebody has just done the merge by hand after a conflict,
     which is what this script tells them to do. Bailing out here made that
     instruction a lie: it sent them back to a command that then refused,
     with the checking and tagging never done. So it carries on to the
     verification instead, and only the merge is skipped. */
  const merged = behind === '0';
  if (merged && existingTag(target)) {
    die(`Already up to date, and v${target} is already tagged here. Nothing to do.`);
  }

  /* Which files are this site's own? Anything its commits touched that the
     release does not contain. After the merge these must still differ from
     the engine's copies, or the merge quietly took the engine's side. */
  const ours = already
    ? git(['diff', '--name-only', `${releaseRef}...HEAD`]).split('\n').filter(Boolean)
    : [];
  if (ours.length > 0) say(`  ${ours.length} file(s) are this site's own: ${ours.slice(0, 5).join(', ')}${ours.length > 5 ? ', …' : ''}`);

  if (merged) {
    say(`  v${target} is already merged here — checking it, then tagging.`);
  } else {
    say(`  Merging v${target} (${behind} commit(s)).`);
  }

  try {
    if (!merged) git(['merge', '--no-ff', releaseRef, '-m', `Merge engine ${target}`]);
  } catch (error) {
    const conflicted = git(['diff', '--name-only', '--diff-filter=U']) || '(see git status)';
    try {
      git(['merge', '--abort']);
    } catch {
      /* Nothing to abort. */
    }
    die(
      `That does not merge cleanly:\n\n${conflicted}\n\n  The merge has been undone, so this checkout is as it was.\n  Merge it by hand, then run this again to check and tag.\n\n${error.stderr ?? ''}`,
    );
  }

  /* Mistake (2): a merge that resolved the wrong way. */
  const mergedVersion = versionOf(git(['show', 'HEAD:engine/package.json']));
  if (mergedVersion !== target) {
    die(
      `The merge succeeded but engine/package.json says ${mergedVersion ?? 'nothing'}, not ${target}.\n  The merge resolved the wrong way. Fix it, then run this again — nothing has been tagged.`,
    );
  }

  /* `git diff --quiet` exits 0 when two trees agree about a file and 1 when
     they differ. For a file this site had changed, *differing* from the
     engine is the good outcome — agreeing means the merge took the engine's
     copy and this site's change is gone. */
  const lost = ours.filter((file) => sameAs(releaseRef, file));
  const kept = ours.length - lost.length;
  if (ours.length > 0) {
    if (lost.length > 0) {
      die(
        `The merge took the engine's copy of ${lost.length} file(s) this site had changed:\n\n${lost.join('\n')}\n\n  Nothing has been tagged. Check those before continuing.`,
      );
    }
    say(`  All ${kept} of this site's own file(s) survived the merge.`);
  }

  git(['tag', '-a', `v${target}`, '-m', `Release ${target} for this site`, 'HEAD']);
  say(`  Tagged v${target} on the merge commit.`);

  if (WANT_PUSH) {
    git(['push', 'origin', `refs/tags/v${target}`]);
    say(`  Pushed the tag to origin.\n\n  Now press update in the admin panel.\n`);
  } else {
    say(
      `\n  Nothing has been pushed. To make this release available to the site:\n\n` +
        `      git push origin refs/tags/v${target}\n\n` +
        `  The tag only — pushing the branch runs your deploy workflow, which\n` +
        `  takes no backup. The admin panel's update does.\n`,
    );
  }
}

// Importing this for its helpers must not run a merge.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
