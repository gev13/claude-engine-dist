import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PLATFORM_CREATOR, PLATFORM_META, PLATFORM_NAME } from '@/lib/credits';

/* 3.0 — every page says which platform made it and who created that, in
   two meta tags no setting reaches. Neither is a ranking signal; the site's
   own title, description, authors, publisher and structured data are left
   exactly as they were. */

const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');
const LAYOUTS = ['src/app/(site)/[locale]/layout.tsx', 'src/app/(system)/layout.tsx'];

describe('the platform credits', () => {
  it('are the generator and creator tags', () => {
    expect(PLATFORM_META).toEqual({ generator: PLATFORM_NAME, creator: PLATFORM_CREATOR });
    expect(PLATFORM_NAME).toBe('Claude Engine Builder');
    expect(PLATFORM_CREATOR).toBe('Gevorg Andreasyan');
  });

  it('are printed by both layouts, which no longer name a creator of their own', () => {
    for (const layout of LAYOUTS) {
      const source = read(layout);
      expect(source).toContain('...PLATFORM_META');
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
