import { describe, expect, it } from 'vitest';
import nextConfig from '../next.config';

/* ═══════════════════════════════════════════════════════════════════════════
   Who may put this site in a frame
   ───────────────────────────────────────────────────────────────────────────
   Exactly one route may be framed, and only by this origin: the Design
   panel's spacing probe, which exists to be measured in a hidden iframe. An
   exception carved for a convenience is the kind that widens later without
   anybody noticing, so its shape is pinned here — what it covers, and far
   more importantly what it does not.
   ═══════════════════════════════════════════════════════════════════════════ */

type Header = { key: string; value: string };
type Rule = { source: string; headers: Header[] };

const rules = (await nextConfig.headers!()) as Rule[];

const forSource = (source: string) => rules.find((rule) => rule.source === source)!;
const value = (rule: Rule, key: string) => rule.headers.find((h) => h.key === key)?.value ?? '';

const everythingElse = forSource('/((?!admin/band$|admin/band/).*)');
const probe = forSource('/admin/band/:path*');

describe('the site as a whole', () => {
  it('refuses to be framed at all', () => {
    expect(value(everythingElse, 'Content-Security-Policy')).toContain("frame-ancestors 'none'");
    expect(value(everythingElse, 'X-Frame-Options')).toBe('DENY');
  });

  it('excludes only the probe from that rule, and nothing that looks like it', () => {
    const pattern = new RegExp(`^${everythingElse.source}$`);
    // The paths that matter are still covered.
    for (const path of ['/', '/admin', '/admin/pages', '/admin/settings', '/api/admin/users', '/blog/post']) {
      expect(pattern.test(path), path).toBe(true);
    }
    // And a path merely starting with the same letters is not a way out.
    expect(pattern.test('/admin/band/hero')).toBe(false);
    expect(pattern.test('/admin/band')).toBe(false);
    /* The boundary matters: without it a later `/admin/bands` would fall out
       of this rule and match no rule at all, arriving with no security
       headers whatsoever. */
    expect(pattern.test('/admin/bands')).toBe(true);
    expect(pattern.test('/admin/banding/x')).toBe(true);
  });
});

describe('the spacing probe', () => {
  it('may be framed by this origin and no other', () => {
    expect(value(probe, 'Content-Security-Policy')).toContain("frame-ancestors 'self'");
    expect(value(probe, 'X-Frame-Options')).toBe('SAMEORIGIN');
  });

  /* The exception is about framing. Everything else that makes the response
     safe has to survive it, or a convenience has quietly bought a hole. */
  it('keeps every other protection exactly as the rest of the site has it', () => {
    for (const header of everythingElse.headers) {
      if (header.key === 'Content-Security-Policy' || header.key === 'X-Frame-Options') continue;
      expect(value(probe, header.key), header.key).toBe(header.value);
    }
  });

  it('changes one directive of the policy and no others', () => {
    const relaxed = value(probe, 'Content-Security-Policy');
    const strict = value(everythingElse, 'Content-Security-Policy');
    expect(relaxed.replace("frame-ancestors 'self'", "frame-ancestors 'none'")).toBe(strict);
  });

  it('does not become a way to load scripts from anywhere', () => {
    expect(value(probe, 'Content-Security-Policy')).toContain("default-src 'self'");
    expect(value(probe, 'Content-Security-Policy')).toContain("object-src 'none'");
  });
});
