import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { blockSchemas } from '@/lib/blocks';

/* 3.4 — four form options found recreating a contact page from a design:
   no "(optional)" marker, an arrow on the send button, the space inside
   the card, and chips sized to their text. Nothing changes until chosen. */

vi.mock('next/navigation', () => ({ usePathname: () => '/contact' }));
vi.mock('@/components/site/Messages', () => ({ useMessages: () => (key: string) => (key === 'form.optional' ? 'optional' : key) }));
vi.mock('@/components/site/Captcha', () => ({ useChallenge: () => ({ field: null, token: async () => '', reset: () => {} }) }));

const { FormBlock } = await import('@/components/blocks/library/FormBlock');

const base = { formName: 'Contact', fields: [{ id: 'name', type: 'text', label: 'Name' }], submitLabel: 'Send' };
const html = (extra: Record<string, unknown> = {}) => renderToStaticMarkup(<FormBlock {...(blockSchemas.form.parse({ ...base, ...extra }) as unknown as Parameters<typeof FormBlock>[0])} />);
const css = readFileSync(new URL('../src/styles/library-forms.css', import.meta.url), 'utf8');

describe('form options 3.4', () => {
  it('are all off until chosen', () => {
    const parsed = blockSchemas.form.parse(base);
    expect(parsed.optionalMark).toBeUndefined();
    expect(parsed.submitArrow).toBeUndefined();
    expect(parsed.cardPadding).toBeUndefined();
    expect(parsed.compactChoices).toBeUndefined();
    const out = html();
    expect(out).toContain('he-fb__opt');
    expect(out).not.toContain('<svg');
    expect(out).not.toContain('--he-fb-pad');
    expect(out).not.toContain('is-compact');
  });

  it('leave the optional marker off', () => {
    expect(html({ optionalMark: false })).not.toContain('he-fb__opt');
  });

  it('put an arrow on the send button', () => {
    expect(html({ submitArrow: true })).toMatch(/<button type="submit"[^>]*><span>Send<\/span><svg/);
  });

  it('set the space inside the card, one or two lengths only', () => {
    expect(html({ cardPadding: '48px 56px' })).toContain('--he-fb-pad:48px 56px');
    expect(blockSchemas.form.safeParse({ ...base, cardPadding: '1px 2px 3px' }).success).toBe(false);
    expect(blockSchemas.form.safeParse({ ...base, cardPadding: 'red' }).success).toBe(false);
    expect(blockSchemas.form.safeParse({ ...base, cardPadding: '' }).success).toBe(true);
    expect(css).toContain('.he-fb.is-card .he-fb__box { padding: var(--he-fb-pad, 32px);');
  });

  it('size the chips to their text', () => {
    expect(html({ compactChoices: true })).toContain('is-compact');
    expect(css).toMatch(/\.he-fb\.is-compact \.he-fb__choice span \{[^}]*line-height: 20px/);
  });

  it('let the card follow the site card corners', () => {
    expect(css).toMatch(/\.he-fb\.is-card \.he-fb__box \{[^}]*border-radius: var\(--he-box-radius, 20px\); clip-path: var\(--he-card-clip, none\)/);
  });
});
