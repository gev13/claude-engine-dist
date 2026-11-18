import { describe, expect, it } from 'vitest';
import { blockSchemas, parseBlock } from '@/lib/blocks';
import { rowToCss } from '@/lib/blockStyle-css';
import { FONT_STACKS, themeSchema } from '@/lib/theme';
import { themeToCss } from '@/lib/theme-css';

/* 3.35 — a column held in view while its row scrolls, and one face for every
   text in a language. Each off, and drawn as before, until set. */

const col = (id: string, width: { base: number; laptop?: number; tablet?: number; mobile?: number }, more: Record<string, unknown> = {}) => ({ id, width, ...more }) as Parameters<typeof rowToCss>[0]['columns'][number];
const theme = (value: unknown) => themeToCss(themeSchema.parse(value));

describe('a column held in view', () => {
  const sticky = { at: ['base', 'laptop', 'tablet', 'mobile'], offset: '82px' } as const;
  it('writes nothing until set', () => {
    const out = rowToCss({ id: 'r', columns: [col('a', { base: 5, mobile: 12 }), col('b', { base: 7, mobile: 12 })] });
    expect(out).not.toContain('sticky');
  });
  it('holds the column on the tiers asked for where the columns sit side by side, never where they stack', () => {
    const out = rowToCss({ id: 'r', columns: [col('a', { base: 5, mobile: 12 }, { sticky }), col('b', { base: 7, mobile: 12 })] });
    expect(out).toContain('@media (min-width:1441px){.he-r-r>.he-c-a{position:sticky;top:82px;align-self:start}}');
    expect(out).toContain('@media (min-width:1025px) and (max-width:1440px){.he-r-r>.he-c-a{position:sticky;top:82px;align-self:start}}');
    expect(out).toContain('@media (min-width:769px) and (max-width:1024px){.he-r-r>.he-c-a{position:sticky');
    expect(out).not.toContain('@media (max-width:768px){.he-r-r>.he-c-a{position:sticky');
  });
  it('steps aside for a row that stacks in reverse on phones, or written tracks of one column', () => {
    const reversed = rowToCss({ id: 'r', reverseOnMobile: true, columns: [col('a', { base: 6 }, { sticky }), col('b', { base: 6 })] });
    expect(reversed).not.toContain('(max-width:768px){.he-r-r>.he-c-a{position:sticky');
    const oneTrack = rowToCss({ id: 'r', tracks: { tablet: '1fr' }, columns: [col('a', { base: 6 }, { sticky }), col('b', { base: 6 })] });
    expect(oneTrack).not.toContain('(max-width:1024px){.he-r-r>.he-c-a{position:sticky');
  });
  it('centres its blocks in the visible part, never taller than the row', () => {
    const out = rowToCss({ id: 'r', columns: [col('a', { base: 6 }, { sticky: { at: ['base'], offset: '82px', center: true } }), col('b', { base: 6 })] });
    expect(out).toContain('.he-r-r>.he-c-a{position:sticky;top:82px;align-self:start;min-height:min(100%,calc(100svh - 82px));display:flex;flex-direction:column;justify-content:center}');
  });
  it('wins over the column’s own alignment on its tiers', () => {
    const out = rowToCss({ id: 'r', columns: [col('a', { base: 6 }, { sticky: { at: ['base'] }, alignSelf: { base: 'center' } }), col('b', { base: 6 })] });
    expect(out.indexOf('align-self:center')).toBeLessThan(out.indexOf('position:sticky'));
    expect(out).toContain('top:0px');
  });
  it('turns a clipping row into one that clips without stopping it', () => {
    const out = rowToCss({ id: 'r', clip: true, columns: [col('a', { base: 6 }, { sticky: { at: ['base'] } }), col('b', { base: 6 })] });
    expect(out).toContain('.he-row.he-b-r{overflow:clip}');
    expect(rowToCss({ id: 'r', clip: true, columns: [col('a', { base: 6 }), col('b', { base: 6 })] })).not.toContain('overflow:clip');
  });
  it('is kept between the schema and the stylesheet', () => {
    const parsed = parseBlock({ id: 'r', type: 'row', props: { columns: [col('a', { base: 6 }, { sticky: { at: ['base'], offset: '82px' } }), col('b', { base: 6 })] } });
    expect((parsed!.props as { columns: { sticky?: unknown }[] }).columns[0]!.sticky).toEqual({ at: ['base'], offset: '82px' });
  });
  it('refuses values that could break out of the style element', () => {
    expect(blockSchemas.row.safeParse({ columns: [col('a', { base: 6 }, { sticky: { at: ['base'], offset: '1px;}' } })] }).success).toBe(false);
    expect(blockSchemas.row.safeParse({ columns: [col('a', { base: 6 }, { sticky: { at: ['desk'] } })] }).success).toBe(false);
  });
});

describe('one face for a whole language', () => {
  const key = Object.keys(FONT_STACKS).find((k) => k !== 'inter') as keyof typeof FONT_STACKS;
  const stack = FONT_STACKS[key];
  it('changes nothing without it', () => {
    const before = theme({ localeFonts: { hy: { display: key } } });
    expect(before).not.toContain('!important');
  });
  it('sets every element of that language’s pages, firmly, leaving code alone', () => {
    const out = theme({ localeFonts: { hy: { all: key } } });
    expect(out).toContain(`:root:lang(hy){--font-display:${stack};--font-sans:${stack}}`);
    expect(out).toContain(`:root:lang(hy) :not(code,kbd,pre,samp,code *,kbd *,pre *,samp *){font-family:${stack}!important}`);
  });
  it('keeps a language’s own heading or body face for the variables', () => {
    const other = Object.keys(FONT_STACKS).find((k) => k !== key) as keyof typeof FONT_STACKS;
    const out = theme({ localeFonts: { hy: { all: key, display: other } } });
    expect(out).toContain(`:root:lang(hy){--font-display:${FONT_STACKS[other]};--font-sans:${stack}}`);
  });
  it('takes only faces the site carries', () => {
    expect(themeSchema.safeParse({ localeFonts: { hy: { all: 'Comic;}' } } }).success).toBe(false);
  });
});
