import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CAREERS_PATH, ownedByCareers } from '@/lib/careers';

/* 3.30.2 — a page at /careers (the listing's heading) was prerendered by the
   catch-all as well as by the careers route, to the same file; whichever
   finished last was served, so a build could lose the roles. */

describe('the careers routes own their addresses', () => {
  it('claims the listing and every advert, nothing else', () => {
    expect(ownedByCareers(CAREERS_PATH)).toBe(true);
    expect(ownedByCareers(`${CAREERS_PATH}/designer`)).toBe(true);
    expect(ownedByCareers('/careers-day')).toBe(false);
    expect(ownedByCareers('/about')).toBe(false);
  });
  it('keeps them out of the catch-all’s prerendered paths', () => {
    const page = readFileSync(join(__dirname, '../src/app/(site)/[locale]/[[...slug]]/page.tsx'), 'utf8');
    expect(page).toMatch(/\.filter\(\(path\) => !ownedByCareers\(path\)\)/);
  });
});
