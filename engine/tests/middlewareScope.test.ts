import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/* 3.4.2 — the admin API is left out of the middleware, so an upload is read
   exactly as it arrived instead of through Next's copy of the body. */
const source = readFileSync(new URL('../src/middleware.ts', import.meta.url), 'utf8');
const matcher = source.slice(source.indexOf('matcher: ['), source.indexOf('],', source.indexOf('matcher: [')));

describe('the middleware', () => {
  it('still guards the admin pages', () => {
    expect(matcher).toContain("'/admin/:path*'");
  });

  it('never runs for an API route', () => {
    expect(matcher).not.toMatch(/'\/api/);
    // The catch-all leaves out every /api/ path, the admin API included.
    expect(matcher).toContain("(?!_next/|api/|media/");
  });
});
