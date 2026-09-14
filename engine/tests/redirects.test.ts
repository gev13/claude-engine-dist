import { describe, expect, it } from 'vitest';
import { isSafeTarget, normalisePath } from '@/server/content/redirects';

describe('redirect paths', () => {
  it('normalises to a leading slash and no trailing slash', () => {
    expect(normalisePath('/about/')).toBe('/about');
    expect(normalisePath('about')).toBe('/about');
    expect(normalisePath('/')).toBe('/');
    expect(normalisePath('')).toBe('/');
    expect(normalisePath('/a/b///')).toBe('/a/b');
  });

  it('drops the query and hash, so one entry covers a path', () => {
    expect(normalisePath('/about?utm=x')).toBe('/about');
    expect(normalisePath('/about#team')).toBe('/about');
    expect(normalisePath('/about/?a=1#b')).toBe('/about');
  });

  /* A target is handed to `redirect()`, which will send a visitor anywhere,
     so the grammar is an allowlist rather than a sanity check. */
  it('accepts a site path or a full http(s) URL', () => {
    for (const v of ['/new', '/a/b?x=1', 'https://example.com/x', 'http://example.com']) {
      expect(isSafeTarget(v), v).toBe(true);
    }
  });

  it('refuses a scheme that could execute or exfiltrate', () => {
    for (const v of ['javascript:alert(1)', 'data:text/html,x', 'vbscript:x', '//evil.com', 'ftp://x', '']) {
      expect(isSafeTarget(v), v).toBe(false);
    }
  });

  /* `//evil.com` and `/\evil.com` look like site paths but are
     protocol-relative: a browser follows them to another origin. Allowing one
     would make the redirect table an open-redirect gadget. */
  it('refuses a protocol-relative URL, which silently changes origin', () => {
    for (const v of ['//evil.example', '//evil.example/path', '/\\evil.example', '///evil.example']) {
      expect(isSafeTarget(v), v).toBe(false);
    }
  });
});
