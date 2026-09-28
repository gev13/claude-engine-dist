/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { blockSchemas } from '@/lib/blocks';
import { chromeSchema, resolveChrome } from '@/lib/chrome';
import { themeSchema } from '@/lib/theme';
import { themeToCss } from '@/lib/theme-css';

/* 3.17 — the phone menu mirroring the header, keeping the page still and
   showing its service links in its own type; the space under the hero on
   phones; a card button in a colour of its own; the FAQ box's border along
   its cuts; and button labels centred beside a divided arrow. */

vi.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => ({ push() {} }) }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { BlockRenderer } = await import('@/components/blocks/Renderer');
const theme = (value: unknown) => themeToCss(themeSchema.parse(value));
const upgrades = readFileSync(join(__dirname, '../src/styles/library-upgrades.css'), 'utf8');

describe('the phone menu', () => {
  it('keeps both new options off until chosen', () => {
    const menu = resolveChrome(chromeSchema.parse({})).mobileMenu;
    expect(menu.closeAtToggle).toBe(false);
    expect(menu.servicesLook).toBe('list');
    const chosen = resolveChrome(chromeSchema.parse({ mobileMenu: { closeAtToggle: true, servicesLook: 'rows' } })).mobileMenu;
    expect([chosen.closeAtToggle, chosen.servicesLook]).toEqual([true, 'rows']);
  });

  it('draws the service links in the menu’s own type, and never scrolls the page through', () => {
    expect(upgrades).toContain('.he-menu.is-services-rows .he-menu__services a { font-family: var(--he-h4-family); font-size: 17px; font-weight: 600;');
    expect(upgrades).toContain('.he-menu { overscroll-behavior: contain; }');
  });
});

describe('the header keeps the page still while its menu is open', () => {
  let host: HTMLDivElement | null = null;
  afterEach(() => host?.remove());

  it('pins the body where it was, and puts the page back on close', async () => {
    const { Header } = await import('@/components/site/Header');
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
    Object.defineProperty(window, 'scrollY', { value: 640, configurable: true });
    const to = vi.fn();
    window.scrollTo = to as never;
    host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    const chrome = resolveChrome(chromeSchema.parse({}));
    const cta = { label: 'Contact', href: '/contact' };
    await act(async () =>
      root.render(<Header siteName="Site" chrome={chrome} nav={[]} cta={cta} secondaryCta={cta} primaryServices={[]} secondaryServices={[]} contact={{ social: [] }} />),
    );
    await act(async () => (host!.querySelector('.he-hdr__toggle') as HTMLButtonElement).click());
    expect(document.body.style.position).toBe('fixed');
    expect(document.body.style.top).toBe('-640px');
    await act(async () => (host!.querySelector('.he-menu__close') as HTMLButtonElement).click());
    expect(document.body.style.position).toBe('');
    expect(to).toHaveBeenCalledWith({ top: 640, left: 0, behavior: 'instant' });
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
  });
});

describe('the space under the first section on phones', () => {
  it('is written after the space between sections, for a panel too', () => {
    const out = theme({ layout: { sectionGapMobile: '120px', firstGapMobile: '30px' } });
    expect(out).toMatch(/:where\(#main>\*\+\*\)\{margin-top:120px\}.*:where\(#main>:first-child\+\*\)\{margin-top:30px\}#main>:first-child\+\*\{--he-panel-mt:30px\}/);
    expect(theme({ layout: { sectionGapMobile: '120px' } })).not.toContain(':first-child+*');
  });
});

describe('a card button in a colour of its own', () => {
  it('fills, borders and glows in it', () => {
    const html = renderToStaticMarkup(
      <BlockRenderer blocks={[{ id: 'c', type: 'cardGrid', props: { variant: 'imageCards', cards: [{ title: 'A', button: { label: 'Go', href: '/a', fill: '#ff412e' } }] } }] as never} />,
    );
    expect(html).toContain('class="he-btn he-btn-primary"');
    expect(html).toContain('--he-btn-primary-bg:#ff412e');
    expect(html).toContain('--he-btn-glow-c:color-mix(in srgb, #ff412e 55%, transparent)');
    expect(blockSchemas.cardGrid.safeParse({ cards: [{ title: 'A', button: { label: 'x', href: '/a', fill: 'red;x' } }] }).success).toBe(false);
  });
});

describe('cut shapes and arrows', () => {
  it('draws the contained FAQ’s border along its cuts', () => {
    const out = theme({ shape: { cards: { style: 'cut', size: 24 } } });
    expect(out).toMatch(/\.he-faq\.is-contained\{--he-cut-line:var\(--color-hairline\);background-image:linear-gradient/);
  });

  it('centres a label between the button’s edge and its arrow’s divider', () => {
    expect(theme({ buttons: { icon: 'cell' } })).toContain('max(4px, calc(var(--he-btn-px) - 10px - var(--he-btn-tracking, 0px)))');
  });
});
