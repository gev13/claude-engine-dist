import { describe, expect, it } from 'vitest';
import { checkPasswordPolicy } from '@/server/auth/password';
import { consumeRecoveryCode, generateRecoveryCodes } from '@/server/auth/totp';
import { sanitizeRichText, toPlainText } from '@/server/content/sanitize';
import { toPath, toSlug, uniqueSlug } from '@/lib/slug';
import { parseBlock, parseBlocks } from '@/lib/blocks';

describe('password policy', () => {
  it('requires twelve characters', () => {
    expect(checkPasswordPolicy('Short1!a').ok).toBe(false);
    expect(checkPasswordPolicy('LongEnough1!').ok).toBe(true);
  });

  it('requires three character classes', () => {
    expect(checkPasswordPolicy('alllowercaseletters').ok).toBe(false);
    expect(checkPasswordPolicy('AllLowercaseAndUpper').ok).toBe(false);
    expect(checkPasswordPolicy('AllLower123andUpper').ok).toBe(true);
  });

  it('rejects a password containing the account identifiers', () => {
    expect(checkPasswordPolicy('gevandreasyan123X', { email: 'gevandreasyan@x.com' }).ok).toBe(false);
    expect(checkPasswordPolicy('Correct1Horse2Battery', { email: 'gev@x.com' }).ok).toBe(true);
  });
});

describe('recovery codes', () => {
  it('issues ten codes and stores only hashes', () => {
    const { plain, hashed } = generateRecoveryCodes();
    expect(plain).toHaveLength(10);
    expect(hashed).toHaveLength(10);
    for (const code of plain) expect(hashed).not.toContain(code);
  });

  it('consumes a code exactly once', () => {
    const { plain, hashed } = generateRecoveryCodes();
    const first = plain[0]!;
    const remaining = consumeRecoveryCode(hashed, first);
    expect(remaining).toHaveLength(9);
    expect(consumeRecoveryCode(remaining!, first)).toBeNull();
  });

  it('is insensitive to formatting the user might type', () => {
    const { plain, hashed } = generateRecoveryCodes();
    expect(consumeRecoveryCode(hashed, plain[0]!.replace('-', '').toLowerCase())).toHaveLength(9);
  });
});

describe('rich text sanitisation', () => {
  it('strips script tags', () => {
    expect(sanitizeRichText('<p>Safe</p><script>alert(1)</script>')).toBe('<p>Safe</p>');
  });

  it('strips event handlers and javascript: urls', () => {
    const dirty = '<a href="javascript:alert(1)" onclick="steal()">click</a>';
    const clean = sanitizeRichText(dirty);
    expect(clean).not.toContain('javascript:');
    expect(clean).not.toContain('onclick');
  });

  it('strips inline styles', () => {
    expect(sanitizeRichText('<p style="position:fixed">x</p>')).not.toContain('style');
  });

  it('keeps legitimate editor output intact', () => {
    const html = '<h2>Heading</h2><p><strong>Bold</strong> and <em>italic</em>.</p><ul><li>One</li></ul>';
    expect(sanitizeRichText(html)).toBe(html);
  });

  it('hardens external links', () => {
    const clean = sanitizeRichText('<a href="https://example.com">out</a>');
    expect(clean).toContain('rel="noopener noreferrer nofollow"');
    expect(clean).toContain('target="_blank"');
  });

  it('leaves internal links alone', () => {
    expect(sanitizeRichText('<a href="/about">about</a>')).not.toContain('target');
  });

  it('reduces to plain text for excerpts', () => {
    expect(toPlainText('<h2>Title</h2><p>Body   text</p>')).toBe('Title Body text');
  });
});

describe('slugs and paths', () => {
  it('produces url-safe slugs', () => {
    expect(toSlug('Web Application Penetration Testing')).toBe('web-application-penetration-testing');
    expect(toSlug('APT & Red Teaming')).toBe('apt-and-red-teaming');
    expect(toSlug('   ')).toBe('untitled');
  });

  it('deduplicates against taken slugs', () => {
    expect(uniqueSlug('post', ['post', 'post-2'])).toBe('post-3');
    expect(uniqueSlug('post', [])).toBe('post');
  });

  it('builds nested paths', () => {
    expect(toPath('api-security-testing', '/services')).toBe('/services/api-security-testing');
    expect(toPath('about')).toBe('/about');
    expect(toPath('about', '/')).toBe('/about');
  });
});

describe('block validation', () => {
  it('accepts a well-formed block and fills defaults', () => {
    const parsed = parseBlock({ id: 'a', type: 'hero', props: { title: 'Hello' } });
    expect(parsed).not.toBeNull();
    expect((parsed!.props as { links: unknown[] }).links).toEqual([]);
  });

  it('rejects an unknown block type', () => {
    expect(parseBlock({ id: 'a', type: 'not-a-block', props: {} })).toBeNull();
  });

  it('rejects a block missing a required prop', () => {
    expect(parseBlock({ id: 'a', type: 'hero', props: {} })).toBeNull();
  });

  it('drops bad blocks rather than throwing, so a page still renders', () => {
    const blocks = [
      { id: 'a', type: 'hero', props: { title: 'Good' } },
      { id: 'b', type: 'hero', props: {} },
      { id: 'c', type: 'cta', props: { title: 'Also good' } },
    ];
    expect(parseBlocks(blocks)).toHaveLength(2);
  });
});
