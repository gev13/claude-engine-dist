/** @vitest-environment jsdom */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { blockStyleSchema } from '@/lib/blockStyle';
import { themeSchema } from '@/lib/theme';

/* 3.5 — an entrance for every section, chosen once for the site; a glitch
   in bursts every few seconds; and glitch colours that show. All off until
   chosen. */

vi.mock('next/navigation', () => ({ usePathname: () => '/' }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { SiteReveal } = await import('@/components/blocks/library/RevealObserver');
const { GlitchObserver } = await import('@/components/blocks/library/GlitchObserver');
const { BlockRenderer } = await import('@/components/blocks/Renderer');

const glitchCss = readFileSync(join(__dirname, '../src/styles/library-glitch.css'), 'utf8');

describe('the site-wide entrance', () => {
  it('is nothing until chosen, and only an entrance', () => {
    expect(themeSchema.parse({}).reveal).toBeUndefined();
    expect(themeSchema.parse({ reveal: 'rise' }).reveal).toBe('rise');
    expect(themeSchema.safeParse({ reveal: 'spin' }).success).toBe(false);
  });

  it('lets a section stay still', () => {
    expect(blockStyleSchema.parse({ reveal: 'none' }).reveal).toBe('none');
    const html = renderToStaticMarkup(<BlockRenderer blocks={[{ id: 'h1', type: 'heading', props: { title: 'Hi' }, style: { reveal: 'none' } }] as never} />);
    expect(html).toContain('he-noreveal');
    expect(html).not.toContain('he-reveal');
  });

  describe('in the browser', () => {
    let host: HTMLDivElement;
    beforeEach(() => {
      window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as never;
      document.body.innerHTML = `<main id="main"><div id="a"></div><div id="b" class="he-noreveal"></div><div id="c" class="he-reveal he-reveal--fade"></div><style></style></main><div id="host"></div>`;
      host = document.getElementById('host') as HTMLDivElement;
    });
    afterEach(() => {
      document.body.innerHTML = '';
    });

    it('gives each top-level section the entrance, except those with their own or none', async () => {
      await act(async () => createRoot(host).render(<SiteReveal effect="rise" />));
      expect(document.getElementById('a')!.className).toContain('he-reveal he-reveal--rise');
      expect(document.getElementById('b')!.className).toBe('he-noreveal');
      expect(document.getElementById('c')!.className).not.toContain('he-reveal--rise');
      expect(document.querySelector('style')!.className).toBe('');
      // No IntersectionObserver here, as for an old browser: everything is shown.
      expect(document.getElementById('a')!.classList.contains('is-in')).toBe(true);
    });

    it('tags a section that arrives later', async () => {
      await act(async () => createRoot(host).render(<SiteReveal effect="fade" />));
      const late = document.createElement('section');
      await act(async () => {
        document.getElementById('main')!.appendChild(late);
        await Promise.resolve();
      });
      expect(late.className).toContain('he-reveal--fade');
    });
  });
});

describe('the glitch in bursts', () => {
  it('takes timings within bounds', () => {
    const ok = blockStyleSchema.parse({ glitch: { effect: 'noise', trigger: 'interval', every: 5, burst: 1.5 } }).glitch;
    expect(ok).toMatchObject({ trigger: 'interval', every: 5, burst: 1.5 });
    expect(blockStyleSchema.safeParse({ glitch: { effect: 'noise', every: 0.5 } }).success).toBe(false);
    expect(blockStyleSchema.safeParse({ glitch: { effect: 'noise', burst: 30 } }).success).toBe(false);
  });

  it('carries its timing to the page', () => {
    const html = renderToStaticMarkup(
      <BlockRenderer blocks={[{ id: 'g1', type: 'heading', props: { title: 'Hi' }, style: { glitch: { effect: 'split', trigger: 'interval', every: 3 } } }] as never} />,
    );
    expect(html).toContain('he-glitch--interval');
    expect(html).toContain('data-glitch-every="3"');
    expect(html).toContain('data-glitch-burst="1"');
  });

  it('glitches on screen once every few seconds, for the length of a burst', async () => {
    vi.useFakeTimers();
    let seen: (entries: { target: Element; isIntersecting: boolean }[]) => void = () => {};
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(cb: typeof seen) {
          seen = cb;
        }
        observe() {}
        disconnect() {}
      },
    );
    document.body.innerHTML = `<div class="he-glitch he-glitch--noise he-glitch--interval" data-glitch-every="5" data-glitch-burst="1"><h2>Title</h2></div><div id="host"></div>`;
    await act(async () => createRoot(document.getElementById('host')!).render(<GlitchObserver />));
    const heading = document.querySelector('h2')!;
    act(() => seen([{ target: heading, isIntersecting: true }]));
    expect(heading.classList.contains('he-glitch-live')).toBe(true);
    act(() => vi.advanceTimersByTime(1000));
    expect(heading.classList.contains('he-glitch-live')).toBe(false);
    act(() => vi.advanceTimersByTime(4000));
    expect(heading.classList.contains('he-glitch-live')).toBe(true);
    act(() => seen([{ target: heading, isIntersecting: false }]));
    act(() => vi.advanceTimersByTime(20000));
    expect(heading.classList.contains('he-glitch-live')).toBe(false);
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
});

describe('glitch colours that show', () => {
  it('can paint the copies in the chosen colours', () => {
    expect(blockStyleSchema.parse({ glitch: { effect: 'noise', tint: 'fill' } }).glitch?.tint).toBe('fill');
    const html = renderToStaticMarkup(<BlockRenderer blocks={[{ id: 'g2', type: 'heading', props: { title: 'Hi' }, style: { glitch: { effect: 'noise', tint: 'fill' } } }] as never} />);
    expect(html).toContain('he-glitch--fill');
    for (const effect of ['noise', 'split', 'psycho']) {
      expect(glitchCss).toMatch(new RegExp(`\\.he-glitch--fill\\.he-glitch--${effect} \\.he-glitch-live::before \\{ color: var\\(--he-glitch-`));
      expect(glitchCss).toMatch(new RegExp(`\\.he-glitch--fill\\.he-glitch--${effect} \\.he-glitch-live::after \\{ color: var\\(--he-glitch-`));
    }
  });
});
