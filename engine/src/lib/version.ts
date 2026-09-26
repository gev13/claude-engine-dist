import { z } from 'zod';

/* ═══════════════════════════════════════════════════════════════════════════
   Engine version and the release feed (package 6)
   ───────────────────────────────────────────────────────────────────────────
   One number says which engine a site is running. It lives here rather than
   being read from package.json, because this module is imported by client
   code as well — and a test holds the two to the same value, so they cannot
   drift.

   The version is admin-only. The health endpoint stays silent about it: a
   public version number tells anybody looking for an exploit exactly which
   one to try.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Keep in step with package.json — `tests/version.test.ts` enforces it. */
export const ENGINE_VERSION = '3.8.0';

/** `1.2.3`, optionally with a pre-release such as `1.2.3-beta.1`. */
const SEMVER = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/;

export type Version = { major: number; minor: number; patch: number; pre: string | null };

export function parseVersion(value: string): Version | null {
  const match = SEMVER.exec(value.trim());
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    pre: match[4] ?? null,
  };
}

export const isVersion = (value: string): boolean => SEMVER.test(value.trim());

/**
 * Negative when `a` is older, positive when newer, zero when the same.
 * A pre-release is older than the release it leads to (1.2.0-rc.1 < 1.2.0),
 * which is the rule everybody's tooling follows.
 */
export function compareVersions(a: string, b: string): number {
  const left = parseVersion(a);
  const right = parseVersion(b);
  if (!left || !right) return 0;

  for (const part of ['major', 'minor', 'patch'] as const) {
    if (left[part] !== right[part]) return left[part] < right[part] ? -1 : 1;
  }
  if (left.pre === right.pre) return 0;
  if (left.pre === null) return 1;
  if (right.pre === null) return -1;
  return left.pre < right.pre ? -1 : 1;
}

/** Whether `candidate` is a version this site has not reached yet. */
export function isNewer(candidate: string, current: string = ENGINE_VERSION): boolean {
  if (!isVersion(candidate) || !isVersion(current)) return false;
  return compareVersions(candidate, current) > 0;
}

/* ── The feed ─────────────────────────────────────────────────────────────── */

/**
 * `releases.json`, published with the engine. It is data, never instructions:
 * it is fetched, validated against this schema, and stored. Nothing in it is
 * ever executed, and the only field that reaches a command line is `version`,
 * which must match the semver pattern above.
 */
export const releaseSchema = z.object({
  version: z.string().regex(SEMVER, 'Not a version number'),
  /** ISO date, for "released on". */
  date: z.string().max(40),
  /** One line for the notice; the changelog holds the detail. */
  summary: z.string().max(400).default(''),
  /** Whether taking it runs database migrations. */
  requiresMigration: z.boolean().default(false),
  /** Lowest Node version it runs on, for the checks before an update. */
  minNode: z.string().max(20).optional(),
  /** Where a person can read more. Shown as a link, never fetched. */
  url: z.string().url().max(300).optional(),
});

export type Release = z.output<typeof releaseSchema>;

export const feedSchema = z.object({
  latest: z.string().regex(SEMVER, 'Not a version number'),
  releases: z.array(releaseSchema).min(1).max(200),
});

export type ReleaseFeed = z.output<typeof feedSchema>;

/** The newest release in a feed, and whether this site is behind it. */
export function newestRelease(feed: ReleaseFeed): Release | null {
  const sorted = [...feed.releases].sort((a, b) => compareVersions(b.version, a.version));
  return sorted[0] ?? null;
}

/** Every release between the running version and the newest, newest first. */
export function releasesSince(feed: ReleaseFeed, current: string = ENGINE_VERSION): Release[] {
  return feed.releases
    .filter((release) => isNewer(release.version, current))
    .sort((a, b) => compareVersions(b.version, a.version));
}
