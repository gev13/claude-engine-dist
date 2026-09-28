/** @vitest-environment jsdom */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { blockSchemas } from '@/lib/blocks';
import { themeSchema } from '@/lib/theme';
import { themeToCss } from '@/lib/theme-css';

/* 3.16 — each part of a section entering on its own; an edge-to-edge hero
   picture keeping its shape on short screens; a card's own button. */

vi.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => ({ push() {} }) }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { SiteReveal } = await import('@/components/blocks/library/RevealObserver');
const { BlockRenderer } = await import('@/components/blocks/Renderer');
const css = readFileSync(join(__dirname, '../src/styles/library-upgrades.css'), 'utf8');
const render = (blocks: unknown[]) => renderToStaticMarkup(<BlockRenderer blocks={blocks as never} />);

class FakeObserver {
  static made: FakeObserver[] = [];
  seen: Element[] = [];
  constructor(public cb: IntersectionObserverCallback) {
    FakeObserver.made.push(this);
  }
  observe(el: Element) {
    this.seen.push(el);
  }
  unobserve() {}
  disconnect() {}
}

let host: HTMLDivElement | null = null;
afterEach(() => {
  host?.remove();
  document.getElementById('main')?.remove();
  document.documentElement.className = '';
  FakeObserver.made = [];
});

describe('each part entering on its own', () => {
  it('is a site setting, off until chosen', () => {
    expect(themeSchema.parse({ reveal: 'rise' }).revealItems).toBeUndefined();
    expect(themeSchema.parse({ reveal: 'rise', revealItems: true }).revealItems).toBe(true);
  });

  it('tags the outermost parts of each section, not the sections, and leaves a section with its own entrance alone', async () => {
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
    Object.defineProperty(window, 'innerHeight', { value: 0, configurable: true });
    const main = document.createElement('main');
    main.id = 'main';
    main.innerHTML =
      '<section id="a"><div class="shell"><h2>Title</h2><p>Text</p><ul class="he-fgrid"><li class="he-fgrid__item"><h3>Card</h3><p>Body</p></li></ul></div></section>' +
      '<section id="b" class="he-reveal"><p>Own entrance</p></section>';
    document.body.append(main);
    host = document.createElement('div');
    document.body.append(host);
    await act(async () => createRoot(host!).render(<SiteReveal effect="rise" items />));

    const tagged = [...main.querySelectorAll('.he-ri')].map((el) => el.textContent);
    expect(tagged).toEqual(['Title', 'Text', 'CardBody']);
    expect(main.querySelector('#a')!.classList.contains('he-reveal')).toBe(false);
    expect(main.querySelector('#b p')!.classList.contains('he-ri')).toBe(false);
    expect(main.querySelector('h2')!.classList.contains('he-ri--rise')).toBe(true);
    // jsdom lays everything out at the top: on screen when the page opens, so shown at once, never animated.
    expect([...main.querySelectorAll('.he-ri')].every((el) => el.classList.contains('is-in') && !el.classList.contains('is-anim'))).toBe(true);
    expect(document.documentElement.classList.contains('he-reveal-on')).toBe(true);
    vi.unstubAllGlobals();
  });

  it('waits for parts below the fold, then brings those arriving together in one after another', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
    const below = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ top: 5000, bottom: 5100, left: 0, right: 0, width: 0, height: 100, x: 0, y: 5000, toJSON() {} } as DOMRect);
    const main = document.createElement('main');
    main.id = 'main';
    main.innerHTML = '<section><h2>One</h2><p>Two</p></section>';
    document.body.append(main);
    host = document.createElement('div');
    document.body.append(host);
    await act(async () => createRoot(host!).render(<SiteReveal effect="fade" items />));
    const observer = FakeObserver.made.at(-1)!;
    expect(observer.seen).toHaveLength(2);
    const [h2, p] = [main.querySelector('h2')!, main.querySelector('p')!];
    expect(h2.classList.contains('is-in')).toBe(false);
    observer.cb([p, h2].map((target) => ({ target, isIntersecting: true })) as never, observer as never);
    vi.advanceTimersByTime(0);
    expect(h2.classList.contains('is-anim')).toBe(true);
    expect(p.classList.contains('is-in')).toBe(false);
    vi.advanceTimersByTime(80);
    expect(p.classList.contains('is-anim')).toBe(true);
    below.mockRestore();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('animates the individual translate, so a part keeps its own transform and transitions', () => {
    expect(css).toContain('@keyframes he-ri-rise { from { opacity: 0; translate: 0 28px; } }');
    expect(css).toContain('.he-reveal-on .he-ri:not(.is-in) { opacity: 0; }');
    expect(css).toContain('.he-reduce-motion .he-ri { opacity: 1 !important; animation: none !important; }');
  });
});

describe('an edge-to-edge hero picture keeping its shape', () => {
  it('writes the shape only when set, and only wider than a phone', () => {
    const hero = (extra: Record<string, unknown>) => render([{ id: 'h', type: 'hero', props: { variant: 'split', bleed: true, title: 'T', imageUrl: '/media/a.webp', ...extra } }]);
    expect(hero({})).not.toContain('has-bleed-ratio');
    const html = hero({ bleedRatio: '1002/960' });
    expect(html).toContain('has-bleed-ratio');
    expect(html).toContain('--he-bleed-ratio:1002 / 960');
    expect(blockSchemas.hero.safeParse({ title: 'T', bleedRatio: 'wide' }).success).toBe(false);
    expect(css).toMatch(/@media \(width > 48rem\) \{\s*\.he-hero--split\.is-bleed\.has-bleed-ratio \.he-hero__visual \{ width: auto; aspect-ratio: var\(--he-bleed-ratio\); max-width: min\(var\(--he-bleed-w, 72%\), 1100px\); \}/);
  });
});

describe('a card’s own button', () => {
  it('sits under the text, and an outside address opens in a new tab', () => {
    const html = render([
      { id: 'c', type: 'cardGrid', props: { variant: 'imageCards', cards: [{ title: 'A', body: 'Text', button: { label: 'Visit A', href: 'https://example.com', variant: 'ghost', arrow: true } }, { title: 'B' }] } },
    ]);
    expect(html).toMatch(/<p class="he-fgrid__body">Text<\/p><div class="he-fgrid__actions"><a href="https:\/\/example.com" rel="noopener noreferrer" target="_blank" class="he-btn he-btn-ghost">Visit A<svg/);
    expect(html.match(/he-fgrid__actions/g)).toHaveLength(1);
    expect(blockSchemas.cardGrid.safeParse({ cards: [{ title: 'A', button: { label: 'x', href: 'javascript:alert(1)' } }] }).success).toBe(false);
  });
});

describe('phone spacing', () => {
  it('puts the same space under a list’s title', () => {
    expect(themeToCss(themeSchema.parse({ layout: { itemGapMobile: '30px' } }))).toContain('.he-ilist__title{margin-bottom:30px}');
  });
});
