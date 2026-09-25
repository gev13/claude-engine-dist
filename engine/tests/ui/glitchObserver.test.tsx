// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GlitchObserver } from '@/components/blocks/library/GlitchObserver';

/* 3.0 — the observer hands the chosen headings their words, the colour
   behind them and the class the stylesheet waits for — and nothing else. */

beforeEach(() => {
  (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = class {
    observe() {}
    disconnect() {}
  };
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

const page = (html: string) => {
  document.body.innerHTML = html;
  render(<GlitchObserver />);
};

describe('the glitch observer', () => {
  it('arms the first heading of a glitching block, with its words and its backdrop', () => {
    page(`<section style="background-color: rgb(1, 2, 3)"><div class="he-glitch he-glitch--noise"><h2>Signal <em>lost</em></h2><h3>Second</h3></div></section>`);
    const [first, second] = document.querySelectorAll('h2, h3');
    expect(first!.classList.contains('he-glitch-t')).toBe(true);
    expect((first as HTMLElement).dataset.glitchText).toBe('Signal lost');
    expect((first as HTMLElement).style.getPropertyValue('--he-glitch-bg')).toBe('rgb(1, 2, 3)');
    expect(second!.classList.contains('he-glitch-t')).toBe(false);
  });

  it('arms every heading when asked to', () => {
    page(`<div class="he-glitch" data-glitch="all"><h2>One</h2><h3>Two</h3></div>`);
    expect(document.querySelectorAll('.he-glitch-t')).toHaveLength(2);
  });

  it('leaves the copies clear over a picture, which no flat colour can match', () => {
    page(`<section style="background-image: url(/media/a.webp)"><div class="he-glitch"><h2>Over a picture</h2></div></section>`);
    expect(document.querySelector<HTMLElement>('h2')!.style.getPropertyValue('--he-glitch-bg')).toBe('transparent');
  });

  it('leaves headings outside glitching blocks alone', () => {
    page(`<div><h2>Plain</h2></div>`);
    expect(document.querySelector('.he-glitch-t')).toBeNull();
    expect(document.querySelector('[data-glitch-text]')).toBeNull();
  });
});
