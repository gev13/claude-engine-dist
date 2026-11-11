import { describe, expect, it } from 'vitest';
import { blockStyleSchema } from '@/lib/blockStyle';
import { blockStyleToCss } from '@/lib/blockStyle-css';
import { cornerShapeSchema, cutLegs, leafRadii } from '@/lib/shape';

/* 3.34.2 — a block's corners with a size per corner and on phones, so nested
   panels can keep concentric curves. Unset, the corners are drawn as before. */

const style = (value: unknown) => blockStyleToCss('a', blockStyleSchema.parse(value));
const shape = (value: unknown) => cornerShapeSchema.parse(value);

describe('corner sizes', () => {
  it('draw as before with only a size', () => {
    expect(leafRadii(shape({ style: 'leaf', size: 60 }), 64)).toBe('0px 60px 0px 60px');
    expect(cutLegs(shape({ style: 'cut', size: 20, corners: ['tl'] }), 28)).toEqual({ tl: 20, tr: 0, br: 0, bl: 0 });
    expect(style({ corners: { style: 'leaf', size: 60 } })).toBe('.he-b-a{clip-path:inset(0 round 0px 60px 0px 60px)}');
  });
  it('take a size per corner over the size, a corner given one shaped too', () => {
    expect(leafRadii(shape({ style: 'leaf', size: 40, sizes: { tr: 60, bl: 50 } }), 64)).toBe('0px 60px 0px 50px');
    expect(leafRadii(shape({ style: 'leaf', size: 40, sizes: { tl: 10 } }), 64)).toBe('10px 40px 0px 40px');
    expect(leafRadii(shape({ style: 'leaf', sizes: { tr: 0 } }), 64)).toBe('0px 0px 0px 64px');
  });
  it('on phones: the corner’s phone size, the phone size, its own, the size', () => {
    const s = shape({ style: 'leaf', size: 60, sizeMobile: 40, sizes: { bl: 50 }, sizesMobile: { tr: 30 } });
    expect(leafRadii(s, 64)).toBe('0px 60px 0px 50px');
    expect(leafRadii(s, 64, true)).toBe('0px 30px 0px 40px');
  });
  it('keep a cut’s legs to 96, a longer one falling back to the size', () => {
    expect(cornerShapeSchema.safeParse({ style: 'cut', sizes: { tr: 150 } }).success).toBe(true);
    expect(cutLegs(shape({ style: 'cut', size: 20, sizes: { tr: 150 } }), 28)).toEqual({ tl: 0, tr: 20, br: 0, bl: 20 });
  });
  it('refuse sizes out of bounds', () => {
    expect(cornerShapeSchema.safeParse({ style: 'leaf', sizeMobile: -1 }).success).toBe(false);
    expect(cornerShapeSchema.safeParse({ style: 'leaf', sizes: { tr: 999 } }).success).toBe(false);
    expect(cornerShapeSchema.safeParse({ style: 'leaf', sizes: { tr: '1px;}' } }).success).toBe(false);
  });
});

describe('a block’s corners per corner and on phones', () => {
  it('write the clip and the radius, and the phone ones in their own rule', () => {
    const out = style({ corners: { style: 'leaf', size: 60, sizeMobile: 40 } });
    expect(out).toContain('.he-b-a{clip-path:inset(0 round 0px 60px 0px 60px);border-radius:0px 60px 0px 60px}');
    expect(out).toContain('@media (max-width:768px){.he-b-a{clip-path:inset(0 round 0px 40px 0px 40px);border-radius:0px 40px 0px 40px}}');
  });
  it('clip a cut on phones too', () => {
    expect(style({ corners: { style: 'cut', size: 28, sizeMobile: 12 } })).toContain('@media (max-width:768px){.he-b-a{clip-path:polygon(0px 0,calc(100% - 12px) 0,100% 12px');
  });
  it('win over the theme’s panel corners on a panel, and step aside for a panel set aside on phones', () => {
    const out = style({ panel: true, panelMobile: 'off', corners: { style: 'leaf', sizes: { tr: 60, bl: 50 }, sizeMobile: 40 } });
    const main = out.slice(0, out.indexOf('}') + 1);
    expect(main.indexOf('clip-path:var(--he-panel-clip,none)')).toBeLessThan(main.indexOf('clip-path:inset(0 round 0px 60px 0px 50px)'));
    expect(out.indexOf('round 0px 40px 0px 40px')).toBeLessThan(out.indexOf('clip-path:none'));
  });
  it('write no phone rule and no radius without the new sizes', () => {
    const out = style({ panel: true, corners: { style: 'leaf', size: 60 } });
    expect(out).not.toContain('border-radius');
    expect(out).not.toContain('@media (max-width:768px){.he-b-a{clip-path');
  });
});
