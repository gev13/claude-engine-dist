import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ENGINE_VERSION, feedSchema } from '@/lib/version';

/* The feed is read by every site, on whatever version it runs — and an old
   site checks it with its own, old schema. One summary over 400 characters
   made every site report "The release feed is not in the expected shape"
   and see no update at all. So the file is held to the schema here, and to
   the limits every earlier version shipped with. */

const FEED = join(__dirname, '../../releases.json');

describe.runIf(existsSync(FEED))('releases.json', () => {
  const feed = existsSync(FEED) ? JSON.parse(readFileSync(FEED, 'utf8')) : null;

  it('parses with the feed schema', () => {
    expect(feedSchema.safeParse(feed).success).toBe(true);
  });

  it('stays inside the limits every earlier version checks', () => {
    for (const release of feed.releases) {
      expect(release.summary.length, release.version).toBeLessThanOrEqual(400);
      expect(release.date.length, release.version).toBeLessThanOrEqual(40);
      expect((release.minNode ?? '').length, release.version).toBeLessThanOrEqual(20);
      expect((release.url ?? '').length, release.version).toBeLessThanOrEqual(300);
    }
    expect(feed.releases.length).toBeLessThanOrEqual(200);
  });

  it('names this version as the latest', () => {
    expect(feed.latest).toBe(ENGINE_VERSION);
  });
});
