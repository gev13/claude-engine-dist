import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { blockStyleSchema } from '@/lib/blockStyle';
import { HEADINGS, blockStyleToCss } from '@/lib/blockStyle-css';
import { blockSchemas } from '@/lib/blocks';

/* 3.13.1 — the last two per-device gaps from the admin audit: a section's
   line height and letter spacing on tablets and phones (a fixed 50px line
   height stayed 50px under a 28px phone heading), and a form card's padding
   on phones. Unset keeps what was there. */

vi.mock('next/navigation', () => ({ usePathname: () => '/contact' }));
vi.mock('@/components/site/Messages', () => ({ useMessages: () => (key: string) => key }));
vi.mock('@/components/site/Captcha', () => ({ useChallenge: () => ({ field: null, token: async () => '', reset: () => {} }) }));

const { FormBlock } = await import('@/components/blocks/library/FormBlock');

const sectionCss = (typography: Record<string, unknown>) => blockStyleToCss('x', blockStyleSchema.parse({ typography }));

describe('line height and letter spacing per screen', () => {
  it('write nothing new until set', () => {
    const css = sectionCss({ heading: { size: '44px', lineHeight: '50px', sizeMobile: '28px' } });
    expect(css).toContain('@media (max-width:768px)');
    expect(css).not.toMatch(/@media[^{]*\{[^@]*line-height/);
  });

  it('follow the size onto tablets and phones', () => {
    const css = sectionCss({
      heading: { size: '44px', lineHeight: '50px', sizeMobile: '28px', lineHeightMobile: '34px', letterSpacingTablet: '-0.5px' },
    });
    expect(css).toContain(`@media (max-width:1024px){.he-b-x ${HEADINGS}{letter-spacing:-0.5px}}`);
    expect(css).toContain(`@media (max-width:768px){.he-b-x ${HEADINGS}{font-size:28px;line-height:34px}}`);
  });

  it('refuse anything that is not a line height', () => {
    expect(sectionCss({ body: { lineHeightMobile: 'red;color:red' } })).not.toContain('red');
  });
});

describe('a form card on phones', () => {
  const base = { formName: 'Contact', fields: [{ id: 'name', type: 'text', label: 'Name' }], submitLabel: 'Send' };
  const html = (extra: Record<string, unknown> = {}) =>
    renderToStaticMarkup(<FormBlock {...(blockSchemas.form.parse({ ...base, ...extra }) as unknown as Parameters<typeof FormBlock>[0])} />);

  it('carries its own padding, one or two lengths', () => {
    expect(html({ cardPadding: '48px 56px', cardPaddingMobile: '24px 20px' })).toContain('--he-fb-pad:48px 56px;--he-fb-pad-m:24px 20px');
    expect(html({ cardPaddingMobile: '20px' })).toContain('--he-fb-pad-m:20px');
    expect(html()).not.toContain('--he-fb-pad');
    expect(blockSchemas.form.safeParse({ ...base, cardPaddingMobile: '1px 2px 3px' }).success).toBe(false);
  });
});
