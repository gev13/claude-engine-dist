import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ENGINE_VERSION,
  compareVersions,
  feedSchema,
  isNewer,
  isVersion,
  newestRelease,
  parseVersion,
  releasesSince,
} from '../src/lib/version';

describe('the engine version', () => {
  it('matches package.json, so the two cannot drift', () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string };
    expect(ENGINE_VERSION).toBe(pkg.version);
  });

  it('is itself a version number', () => {
    expect(isVersion(ENGINE_VERSION)).toBe(true);
  });
});

describe('version comparison', () => {
  it('reads the parts', () => {
    expect(parseVersion('1.2.3')).toEqual({ major: 1, minor: 2, patch: 3, pre: null });
    expect(parseVersion('1.2.3-rc.1')).toEqual({ major: 1, minor: 2, patch: 3, pre: 'rc.1' });
    expect(parseVersion('1.2')).toBeNull();
    expect(parseVersion('v1.2.3')).toBeNull();
    expect(parseVersion('1.2.3; rm -rf /')).toBeNull();
  });

  it('orders releases the way everybody expects', () => {
    expect(compareVersions('1.0.0', '2.0.0')).toBeLessThan(0);
    expect(compareVersions('1.10.0', '1.9.0')).toBeGreaterThan(0);
    expect(compareVersions('1.0.1', '1.0.1')).toBe(0);
    // A pre-release comes before the release it leads to.
    expect(compareVersions('1.2.0-rc.1', '1.2.0')).toBeLessThan(0);
    expect(compareVersions('1.2.0-alpha', '1.2.0-beta')).toBeLessThan(0);
  });

  it('knows what counts as newer than this site', () => {
    expect(isNewer('9.9.9', '0.1.0')).toBe(true);
    expect(isNewer('0.1.0', '0.1.0')).toBe(false);
    expect(isNewer('0.0.9', '0.1.0')).toBe(false);
    // Nonsense is never newer — it must not become a checkout target.
    expect(isNewer('main', '0.1.0')).toBe(false);
    expect(isNewer('', '0.1.0')).toBe(false);
  });
});

describe('the release feed', () => {
  const feed = {
    latest: '1.2.0',
    releases: [
      { version: '1.0.0', date: '2026-01-01', summary: 'First', requiresMigration: false },
      { version: '1.2.0', date: '2026-03-01', summary: 'Third', requiresMigration: true },
      { version: '1.1.0', date: '2026-02-01', summary: 'Second', requiresMigration: false },
    ],
  };

  it('accepts a well-formed feed and fills in what it omits', () => {
    const parsed = feedSchema.parse({ latest: '1.0.0', releases: [{ version: '1.0.0', date: '2026-01-01' }] });
    expect(parsed.releases[0]!.summary).toBe('');
    expect(parsed.releases[0]!.requiresMigration).toBe(false);
  });

  it('refuses a feed whose versions are not versions', () => {
    expect(feedSchema.safeParse({ latest: 'main', releases: [{ version: '1.0.0', date: 'x' }] }).success).toBe(false);
    expect(
      feedSchema.safeParse({ latest: '1.0.0', releases: [{ version: '../../etc/passwd', date: 'x' }] }).success,
    ).toBe(false);
    expect(feedSchema.safeParse({ latest: '1.0.0', releases: [] }).success).toBe(false);
  });

  it('finds the newest release whatever order the feed is in', () => {
    const parsed = feedSchema.parse(feed);
    expect(newestRelease(parsed)?.version).toBe('1.2.0');
  });

  it('lists what a site is behind by, newest first', () => {
    const parsed = feedSchema.parse(feed);
    expect(releasesSince(parsed, '1.0.0').map((r) => r.version)).toEqual(['1.2.0', '1.1.0']);
    expect(releasesSince(parsed, '1.2.0')).toEqual([]);
    expect(releasesSince(parsed, '2.0.0')).toEqual([]);
  });

  it('notices when any pending release needs a migration', () => {
    const parsed = feedSchema.parse(feed);
    expect(releasesSince(parsed, '1.0.0').some((r) => r.requiresMigration)).toBe(true);
    expect(releasesSince(parsed, '1.1.0').some((r) => r.requiresMigration)).toBe(true);
  });
});
