import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { HeldRise } from '@/components/blocks/library/HeldRise';
import { blockSchemas, parseBlock } from '@/lib/blocks';
import { rowToCss } from '@/lib/blockStyle-css';
import { headingSpaceCss } from '@/lib/headingSpace';
import { themeSchema } from '@/lib/theme';
import { themeToCss } from '@/lib/theme-css';
import { typeRule, typeStyleSchema, typeVars } from '@/lib/typeStyle';

/* 3.36 — a held column that rises into the middle, a floor under headings,
   and a line height per tier for type styles. Each off, and drawn as
   before, until set. */

vi.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => ({ push() {} }) }));
const { BlockRenderer } = await import('@/components/blocks/Renderer');
const render = (blocks: unknown[]) => renderToStaticMarkup(<BlockRenderer blocks={blocks as never} />);

const col = (id: string, width: { base: number; laptop?: number; tablet?: number; mobile?: number }, more: Record<string, unknown> = {}) => ({ id, width, ...more }) as Parameters<typeof rowToCss>[0]['columns'][number];
const theme = (value: unknown) => themeToCss(themeSchema.parse(value));
const row = (sticky: Record<string, unknown> | undefined) => ({
  id: 'r',
  type: 'row',
  props: {
    columns: [
      { id: 'a', width: { base: 5, mobile: 12 }, ...(sticky ? { sticky } : {}), blocks: [{ id: 'h', type: 'heading', props: { title: 'Held' } }] },
      { id: 'b', width: { base: 7, mobile: 12 }, blocks: [{ id: 'h2', type: 'heading', props: { title: 'Long' } }] },
    ],
  },
});

describe('a held column that rises into the middle', () => {
  const rise = { at: ['base', 'laptop'], offset: '82px', center: true, rise: true } as const;
  it('starts at its place and holds its middle at the visible part’s, as tall as its blocks', () => {
    const out = rowToCss({ id: 'r', columns: [col('a', { base: 5 }, { sticky: rise }), col('b', { base: 7 })] });
    expect(out).toContain('@media (min-width:1441px){.he-r-r>.he-c-a{position:sticky;top:max(82px,calc(82px + (100svh - 82px - var(--he-hold-h,100svh))/2));align-self:start}}');
    expect(out).not.toContain('min-height');
    expect(out).not.toContain('justify-content:center');
  });
  it('leaves 3.35’s centring as it was', () => {
    const out = rowToCss({ id: 'r', columns: [col('a', { base: 5 }, { sticky: { at: ['base'], offset: '82px', center: true } }), col('b', { base: 7 })] });
    expect(out).toContain('.he-r-r>.he-c-a{position:sticky;top:82px;align-self:start;min-height:min(100%,calc(100svh - 82px));display:flex;flex-direction:column;justify-content:center}');
  });
  it('means nothing without the centring', () => {
    const out = rowToCss({ id: 'r', columns: [col('a', { base: 5 }, { sticky: { at: ['base'], offset: '82px', rise: true } }), col('b', { base: 7 })] });
    expect(out).toContain('.he-r-r>.he-c-a{position:sticky;top:82px;align-self:start}');
  });
  it('holds at the offset with no height measured: the fallback is the whole visible part', () => {
    // top = max(o, o + (100svh − o − 100svh)/2) = max(o, o/2) = o
    const out = rowToCss({ id: 'r', columns: [col('a', { base: 5 }, { sticky: rise }), col('b', { base: 7 })] });
    expect(out).toContain('var(--he-hold-h,100svh)');
  });
  it('never where the columns stack', () => {
    const out = rowToCss({ id: 'r', columns: [col('a', { base: 5, mobile: 12 }, { sticky: { ...rise, at: ['mobile'] } }), col('b', { base: 7, mobile: 12 })] });
    expect(out).not.toContain('position:sticky');
  });
  it('marks the column and measures it only when asked for', () => {
    expect(render([row(undefined)])).not.toContain('data-he-hold');
    expect(render([row({ at: ['base'], center: true })])).not.toContain('data-he-hold');
    const html = render([row({ at: ['base'], center: true, rise: true })]);
    expect(html).toContain('class="he-c-a he-nested" data-he-hold="rise"');
    expect(html).toContain('<span hidden=""></span>');
    expect(renderToStaticMarkup(<HeldRise />)).toBe('<span hidden=""></span>');
  });
  it('is kept between the schema and the stylesheet', () => {
    const parsed = parseBlock(row({ at: ['base'], center: true, rise: true }));
    expect((parsed!.props as { columns: { sticky?: unknown }[] }).columns[0]!.sticky).toEqual({ at: ['base'], center: true, rise: true });
    expect(blockSchemas.row.safeParse({ columns: [col('a', { base: 6 }, { sticky: { at: ['base'], rise: 'yes' } })] }).success).toBe(false);
  });
});

describe('a floor under headings', () => {
  const at = (tiers: string[]) => ({ layout: { headingSpace: { min: '20px', at: tiers } } });
  it('writes nothing unset, with no tiers, or with a value that isn’t a length', () => {
    expect(theme({})).not.toContain('::after{content:""');
    expect(theme(at([]))).not.toContain('::after{content:""');
    expect(headingSpaceCss({ min: '20px;}', at: ['base'] })).toBe('');
    expect(themeSchema.safeParse(at(['desk'])).success).toBe(false);
    expect(themeSchema.safeParse({ layout: { headingSpace: { min: 'x', at: ['base'] } } }).success).toBe(false);
  });
  it('acts on the tiers asked for and no other', () => {
    const out = theme(at(['base', 'laptop']));
    expect(out).toContain('@media (min-width:1441px){:where(h1,h2,h3,h4,h5,h6)');
    expect(out).toContain('@media (min-width:1025px) and (max-width:1440px){:where(h1,h2,h3,h4,h5,h6)');
    expect(out).not.toContain('@media (min-width:769px) and (max-width:1024px){:where(h1');
    expect(out).not.toContain('@media (max-width:768px){:where(h1');
  });
  it('adds a floor to the margins in the flow, never replacing one, so a larger gap stays', () => {
    const out = headingSpaceCss({ min: '20px', at: ['base'] });
    expect(out).toContain(':where(:has(+ :is(p,.prose-edge,.he-ucard__body)))::after{content:"";display:block;margin-bottom:20px}');
    // Nothing in the flow rule touches the heading's or the text's own margins.
    const flow = out.slice(out.indexOf(':where(h1'), out.indexOf('margin-bottom:20px}') + 19);
    expect(flow).not.toMatch(/margin-top|:has\(\+ [^)]*\)\{margin/);
  });
  it('makes up only the shortfall in a column, where margins add', () => {
    const out = headingSpaceCss({ min: '20px', at: ['base'] });
    expect(out).toContain('.he-plst__text>.he-plst__title:has(+ .he-plst__excerpt){margin-bottom:max(0px,calc(20px - 8px))}');
    expect(out).toContain('.he-team__grid.is-portrait .he-team__member>.he-team__name:has(+ .he-team__role){margin-bottom:max(0px,calc(20px - 10px))}');
    expect(out).toContain('.he-car.has-title-gap .he-card__body>.he-card__title:has(+ .he-card__text){margin-bottom:max(calc(var(--he-car-title-gap) - 8px),calc(20px - 8px))}');
    // A column is left out of the flow rule, so the two never add up.
    expect(out).toContain(':not(.he-plst__text>*,.he-jobc>*');
  });
  it('follows the careers cards’ own gap between their parts', () => {
    expect(headingSpaceCss({ min: '20px', at: ['base'] }, '14px')).toContain('.he-jobc>.he-jobc__title:has(+ .he-jobc__excerpt){margin-bottom:max(0px,calc(20px - 14px))}');
    expect(theme({ ...at(['base']), careers: { cardPartGap: '14px' } })).toContain('calc(20px - 14px)');
  });
  it('takes each tier’s own column gap where a block sets one', () => {
    const tablet = headingSpaceCss({ min: '20px', at: ['tablet'] });
    expect(tablet).toContain('.he-fgrid.has-pg-t .he-fgrid__item>.he-fgrid__title');
    expect(tablet).not.toContain('has-pg-m');
    expect(tablet).toContain('.he-band.is-group-center');
    const phone = headingSpaceCss({ min: '20px', at: ['mobile'] });
    expect(phone.indexOf('has-pg-t')).toBeLessThan(phone.indexOf('has-pg-m'));
    // A centred group is a column only from tablets up.
    expect(phone).not.toContain('is-group-center .he-band__text>:is(h1');
  });
  it('leaves a heading’s own drawn pseudo-elements alone, flooring its margin with no weight instead', () => {
    const out = headingSpaceCss({ min: '20px', at: ['base'] });
    expect(out).toContain(',.he-glitch-t,.he-story__title)):where(:has(');
    expect(out).toContain(':where(h1,h2,h3,h4,h5,h6):where(.he-glitch-t):where(:not(');
    expect(out).toMatch(/:where\(\.he-glitch-t\)[^{]*\{margin-bottom:20px\}/);
  });
  it('leaves out a heading beside its text and a card’s folded-away text', () => {
    const out = headingSpaceCss({ min: '20px', at: ['base'] });
    expect(out).toContain('.he-proj.is-minimal .he-proj__text>*');
    expect(out).toContain('.he-fgrid.is-expand-reveal .he-ocard__text>*');
  });
});

describe('a line height per tier', () => {
  it('writes the wider tiers’ rules exactly as before when unset', () => {
    expect(typeRule('.x', { size: '24px', sizeMobile: '20px', line: '1.2' })).toEqual(['.x{font-size:24px;line-height:1.2}', '@media (max-width:768px){.x{font-size:20px}}']);
    expect(typeVars('t', { size: '24px', line: '1.2' })).toEqual({ '--he-t-size': '24px', '--he-t-line': '1.2' });
  });
  it('sets tablets and phones apart, each falling back to the wider tier', () => {
    expect(typeRule('.x', { line: '1.3', lineTablet: '1.2', sizeMobile: '20px', lineMobile: '1.1' })).toEqual([
      '.x{line-height:1.3}',
      '@media (max-width:1024px){.x{line-height:1.2}}',
      '@media (max-width:768px){.x{font-size:20px;line-height:1.1}}',
    ]);
    expect(typeRule('.x', { line: '1.3', lineMobile: '1.1' })).toEqual(['.x{line-height:1.3}', '@media (max-width:768px){.x{line-height:1.1}}']);
    expect(typeVars('t', { lineTablet: '1.2', lineMobile: '24px' })).toEqual({ '--he-t-line-t': '1.2', '--he-t-line-m': '24px' });
  });
  it('reaches the theme’s type styles', () => {
    const out = theme({ careers: { titleType: { line: '1.05', lineTablet: '1.1', lineMobile: '1.15' } } });
    expect(out).toContain('@media (max-width:1024px){');
    expect(out).toContain('line-height:1.15');
  });
  it('reads the post cards’ variables on each tier, falling back to the wider one', () => {
    const css = readFileSync(join(__dirname, '../src/styles/library-details.css'), 'utf8');
    expect(css).toContain('line-height: var(--he-plst-t-line-t, var(--he-plst-t-line, revert-layer))');
    expect(css).toContain('line-height: var(--he-plst-t-line-m, var(--he-plst-t-line-t, var(--he-plst-t-line, revert-layer)))');
  });
  it('refuses what isn’t a line height', () => {
    expect(typeStyleSchema.safeParse({ lineTablet: '1;}' }).success).toBe(false);
    expect(typeStyleSchema.safeParse({ lineMobile: 'red' }).success).toBe(false);
  });
});
