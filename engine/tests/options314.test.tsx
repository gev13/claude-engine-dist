import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { blockSchemas } from '@/lib/blocks';
import { buttonPadProps } from '@/lib/buttonPad';

/* 3.14 — one button's own padding, per screen: on the classic blocks'
   buttons, the library blocks' buttons, the Buttons block and a form's send
   button. A button without one renders exactly as before. */

vi.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => ({ push() {} }) }));
vi.mock('@/components/site/Messages', () => ({ useMessages: () => (key: string) => key }));
vi.mock('@/components/site/Captcha', () => ({ useChallenge: () => ({ field: null, token: async () => '', reset: () => {} }) }));

const { BlockRenderer } = await import('@/components/blocks/Renderer');
const { FormBlock } = await import('@/components/blocks/library/FormBlock');

const render = (blocks: unknown[]) => renderToStaticMarkup(<BlockRenderer blocks={blocks as never} />);
const css = readFileSync(join(__dirname, '../src/styles/library-upgrades.css'), 'utf8');
const pad = { y: '10px', yMobile: '8px', xMobile: '14px' };

describe('a button’s own padding', () => {
  it('is nothing until set, and only lengths', () => {
    expect(buttonPadProps(undefined)).toEqual({});
    expect(buttonPadProps({})).toEqual({});
    expect(buttonPadProps(pad)).toEqual({
      className: 'he-own-py he-own-py-m he-own-px-m',
      style: { '--he-own-py': '10px', '--he-own-py-m': '8px', '--he-own-px-m': '14px' },
    });
    expect(blockSchemas.buttons.safeParse({ items: [{ label: 'A', href: '/', pad: { y: 'red' } }] }).success).toBe(false);
  });

  it('reaches a library hero’s buttons, and leaves the others alone', () => {
    const html = render([{ id: 'h', type: 'hero', props: { variant: 'split', title: 'T', links: [{ label: 'Go', href: '/a', pad }, { label: 'More', href: '/b' }] } }]);
    expect(html).toMatch(/class="he-btn he-btn-primary he-own-py he-own-py-m he-own-px-m" style="--he-own-py:10px;--he-own-py-m:8px;--he-own-px-m:14px"/);
    expect(html).toMatch(/class="he-btn he-btn-outline" href="\/b"/);
  });

  it('reaches a band’s buttons, a classic call to action and the Buttons block', () => {
    expect(render([{ id: 'm', type: 'mediaBand', props: { imageUrl: '/media/a.webp', title: 'T', links: [{ label: 'Go', href: '/a', pad: { x: '40px' } }] } }])).toContain('--he-own-px:40px');
    expect(render([{ id: 'c', type: 'cta', props: { title: 'T', links: [{ label: 'Go', href: '/a', pad: { yTablet: '12px' } }] } }])).toContain('he-own-py-t');
    const buttons = render([{ id: 'b', type: 'buttons', props: { items: [{ label: 'Go', href: '/a', pad: { y: '9px' } }] } }]);
    expect(buttons).toMatch(/class="he-cbtn is-primary is-medium he-own-py" style="--he-own-py:9px"/);
  });

  it('reaches a form’s send button', () => {
    const props = blockSchemas.form.parse({ formName: 'C', fields: [{ id: 'n', type: 'text', label: 'N' }], submitLabel: 'Send', submitPad: { yMobile: '12px' } });
    expect(renderToStaticMarkup(<FormBlock {...(props as unknown as Parameters<typeof FormBlock>[0])} />)).toMatch(/<button type="submit" class="he-cbtn is-medium is-primary he-own-py-m" style="--he-own-py-m:12px"/);
  });

  it('redefines the theme’s padding on the button itself, per screen, exactly as typed', () => {
    expect(css).toContain('.he-own-py { --he-btn-py: var(--he-own-py); }');
    expect(css).toMatch(/@media \(width <= 1024px\) \{\s*\.he-own-py-t \{ --he-btn-py: var\(--he-own-py-t\); \}/);
    expect(css).toMatch(/@media \(width <= 768px\) \{\s*\.he-own-py-m \{ --he-btn-py: var\(--he-own-py-m\); \}\s*\.he-own-px-m \{ --he-btn-px: var\(--he-own-px-m\); \}/);
    expect(css).toContain(':not(.is-icon-only, .is-text) { padding: var(--he-btn-py) var(--he-btn-px); }');
  });
});
