import { describe, expect, it } from 'vitest';
import nextConfig from '../next.config';

/* ═══════════════════════════════════════════════════════════════════════════
   Who may frame this site, and what this site may frame
   ───────────────────────────────────────────────────────────────────────────
   Two directives, easy to confuse, and confusing them cost a working feature:
   `frame-ancestors` says who may frame *me*, `frame-src` says what *I* may
   frame. The Design panel's spacing probe needs both — the probe framable by
   this origin, and the admin allowed to frame it. Relaxing only the first
   left the panel quietly measuring nothing, which looks exactly like a
   feature that does not work rather than like a policy that refused.

   The other trap is overlap. Two rules matching one path send two
   `Content-Security-Policy` headers, and a browser enforces the intersection
   — so a relaxation written as a second rule on top does nothing at all, and
   says nothing about it. Exactly one policy per path, asserted below.
   ═══════════════════════════════════════════════════════════════════════════ */

type Header = { key: string; value: string };
type Rule = { source: string; headers: Header[] };

const rules = (await nextConfig.headers!()) as Rule[];

const CSP = 'Content-Security-Policy';
const policyRules = rules.filter((rule) => rule.headers.some((h) => h.key === CSP));
const matches = (rule: Rule, path: string) =>
  new RegExp(`^${rule.source.replace(/\/:path\*$/, '(/.*)?')}$`).test(path);

const forSource = (source: string) => rules.find((rule) => rule.source === source)!;
const value = (rule: Rule, key: string) => rule.headers.find((h) => h.key === key)?.value ?? '';

const probe = forSource('/admin/band/:path*');
const admin = forSource('/admin/((?!band$|band/).*)');
const site = forSource('/((?!admin$|admin/).*)');

describe('exactly one policy applies to any path', () => {
  /* The failure this prevents is silent: overlapping rules are enforced as
     their intersection, so the relaxation appears to have been ignored. */
  it.each([
    '/',
    '/blog/a-post',
    '/admin',
    '/admin/pages',
    '/admin/pages/123',
    '/admin/band/hero',
    '/admin/bands',
  ])('%s is covered by one and only one', (path) => {
    const hit = policyRules.filter((rule) => matches(rule, path));
    expect(hit.map((r) => r.source)).toHaveLength(1);
  });

  it('leaves nothing uncovered', () => {
    for (const path of ['/', '/admin', '/admin/x', '/admin/band/hero', '/media/a.png']) {
      expect(policyRules.some((rule) => matches(rule, path)), path).toBe(true);
    }
  });
});

describe('the public site', () => {
  it('refuses to be framed, and frames nothing of its own', () => {
    expect(value(site, CSP)).toContain("frame-ancestors 'none'");
    expect(value(site, 'X-Frame-Options')).toBe('DENY');
    // Only the video and map embeds, which load on a visitor's click.
    expect(value(site, CSP)).not.toMatch(/frame-src [^;]*'self'/);
  });
});

describe('the admin', () => {
  it('still refuses to be framed', () => {
    expect(value(admin, CSP)).toContain("frame-ancestors 'none'");
    expect(value(admin, 'X-Frame-Options')).toBe('DENY');
  });

  /* The bug: the panel could not load a page from its own origin, so the
     spacing it measures came back empty and said nothing about why. */
  it('may frame its own origin, which is what the spacing probe needs', () => {
    expect(value(admin, CSP)).toMatch(/frame-src 'self'/);
  });

  it('changes that one directive and nothing else', () => {
    expect(value(admin, CSP).replace("frame-src 'self' ", 'frame-src ')).toBe(value(site, CSP));
  });
});

describe('the spacing probe', () => {
  it('may be framed by this origin and no other', () => {
    expect(value(probe, CSP)).toContain("frame-ancestors 'self'");
    expect(value(probe, 'X-Frame-Options')).toBe('SAMEORIGIN');
  });

  it('changes that one directive and nothing else', () => {
    expect(value(probe, CSP).replace("frame-ancestors 'self'", "frame-ancestors 'none'")).toBe(value(site, CSP));
  });

  /* The exception is about framing. Everything else that makes the response
     safe has to survive it, or a convenience has quietly bought a hole. */
  it('keeps every other protection the site has', () => {
    for (const header of site.headers) {
      if (header.key === CSP || header.key === 'X-Frame-Options') continue;
      expect(value(probe, header.key), header.key).toBe(header.value);
    }
    expect(value(probe, CSP)).toContain("default-src 'self'");
    expect(value(probe, CSP)).toContain("object-src 'none'");
  });
});

describe('the admin stays out of search results', () => {
  it('is noindex wherever it is served from', () => {
    for (const rule of [probe, admin, forSource('/admin')]) {
      expect(value(rule, 'X-Robots-Tag'), rule.source).toBe('noindex, nofollow');
    }
  });
});
