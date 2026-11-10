import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PLATFORM_CREATOR, PLATFORM_META, PLATFORM_NAME, platformMeta } from '@/lib/credits';
import { PORTABLE_SEO_KEYS, parseSiteSettings } from '@/lib/siteSettings';

/* 3.0 — the platform's name and who created it, in two meta tags whose words
   no setting reaches. 3.32 — whether a page prints them at all is the site's
   choice, off unless switched on: a security review asked for that. Neither is
   a ranking signal; the site's own title, description, authors, publisher and
   structured data are left exactly as they were. */

const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');
const LAYOUTS = ['src/app/(site)/[locale]/layout.tsx', 'src/app/(system)/layout.tsx'];

describe('the platform credits', () => {
  it('are the generator and creator tags', () => {
    expect(PLATFORM_META).toEqual({ generator: PLATFORM_NAME, creator: PLATFORM_CREATOR });
    expect(PLATFORM_NAME).toBe('Claude Engine Builder');
    expect(PLATFORM_CREATOR).toBe('Gevorg Andreasyan');
  });

  it('are printed only when the site switches them on (3.32)', () => {
    expect(platformMeta(undefined)).toEqual({});
    expect(platformMeta(false)).toEqual({});
    expect(platformMeta(true)).toEqual(PLATFORM_META);
    // An untouched site has no stored value, and a bad one is dropped: both mean off.
    expect(parseSiteSettings({}).platformCredits).toBeUndefined();
    expect(parseSiteSettings({ platformCredits: 'yes' }).platformCredits).toBeUndefined();
    expect(parseSiteSettings({ platformCredits: true }).platformCredits).toBe(true);
    expect(PORTABLE_SEO_KEYS).toContain('seo.platformCredits');
  });

  it('are printed by both layouts through the switch, which no longer name a creator of their own', () => {
    for (const layout of LAYOUTS) {
      const source = read(layout);
      expect(source).toMatch(/\.\.\.platformMeta\((s|settings)\.platformCredits\)/);
      expect(source).not.toContain('...PLATFORM_META');
      expect(source).not.toMatch(/\bcreator:/);
      expect(source).not.toMatch(/\bgenerator:/);
      // The site keeps its own authorship.
      expect(source).toMatch(/publisher: (s|settings)\.name/);
    }
  });

  it('carry no version number', () => {
    expect(Object.values(PLATFORM_META).join(' ')).not.toMatch(/\d+\.\d+/);
  });
});

describe('the old name', () => {
  it('appears nowhere in the source', () => {
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.(tsx?|css|json|md|mjs)$/.test(entry) && /house[\s-]?edge/i.test(readFileSync(path, 'utf8'))) hits.push(path);
      }
    };
    for (const dir of ['src', 'scripts', 'docs']) walk(join(__dirname, '..', dir));
    expect(hits).toEqual([]);
  });
});
