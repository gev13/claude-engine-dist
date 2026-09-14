import { describe, expect, it } from 'vitest';
import { DEMO_ANIMATIONS } from '../src/content/demo/animations';
import { blockSchemas } from '../src/lib/blocks';
import { LOTTIE_PATH, checkLottie, scrollProgress } from '../src/lib/lottie';

const minimal = { v: '5.7.4', fr: 30, ip: 0, op: 60, w: 400, h: 300, layers: [{ ty: 4 }] };

describe('checkLottie', () => {
  it('accepts every demo animation and reads its size and length', () => {
    for (const animation of DEMO_ANIMATIONS) {
      const result = checkLottie(JSON.parse(JSON.stringify(animation.data)));
      expect(result.ok, animation.name).toBe(true);
      if (result.ok) {
        expect(result.info.width).toBe(animation.data.w);
        expect(result.info.frames).toBe(animation.data.op);
      }
    }
  });

  it('reads a minimal file', () => {
    expect(checkLottie(minimal)).toEqual({ ok: true, info: { width: 400, height: 300, frames: 60, fps: 30 } });
  });

  it('refuses JSON that is not an animation the player can draw', () => {
    const bad: unknown[] = [
      null,
      [],
      'lottie',
      {},
      { ...minimal, v: 5 },
      { ...minimal, layers: [] },
      { ...minimal, layers: 'x' },
      { ...minimal, w: 0 },
      { ...minimal, h: 99999 },
      { ...minimal, fr: 0 },
      { ...minimal, op: 0 },
      { ...minimal, layers: Array.from({ length: 501 }, () => ({})) },
    ];
    for (const data of bad) expect(checkLottie(data).ok, JSON.stringify(data)?.slice(0, 60)).toBe(false);
  });
});

describe('the lottie block', () => {
  const parse = (url: string) => blockSchemas.lottie.safeParse({ url }).success;

  it('takes a same-site .json path, or nothing yet', () => {
    expect(parse('')).toBe(true);
    expect(parse('/media/2026/09/V1StGXR8_Z5jdHi6.json')).toBe(true);
    expect(parse('/media/demo/lottie-orbit.json')).toBe(true);
  });

  it('refuses other origins, other files and odd paths', () => {
    for (const url of ['https://example.com/a.json', '//example.com/a.json', '/media/a.png', '/media/a.json?x=1', '/media/../secret.json', 'javascript:alert(1)//.json', 'media/a.json']) {
      expect(LOTTIE_PATH.test(url), url).toBe(false);
      expect(parse(url), url).toBe(false);
    }
  });

  it('defaults to a loop at normal speed from the first frame', () => {
    const result = blockSchemas.lottie.parse({ url: '/media/a.json' });
    expect(result).toMatchObject({ play: 'loop', speed: 1, still: 'first', color: 'original', size: 'medium', align: 'center' });
  });
});

describe('scrollProgress', () => {
  it('runs from 0 as the element enters at the bottom to 1 as it leaves at the top', () => {
    expect(scrollProgress(800, 400, 800)).toBe(0);
    expect(scrollProgress(1200, 400, 800)).toBe(0);
    expect(scrollProgress(200, 400, 800)).toBe(0.5);
    expect(scrollProgress(-400, 400, 800)).toBe(1);
    expect(scrollProgress(-900, 400, 800)).toBe(1);
  });
});
