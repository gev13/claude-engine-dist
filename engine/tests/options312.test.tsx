import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { blockStyleSchema } from '@/lib/blockStyle';
import { blockStyleToCss } from '@/lib/blockStyle-css';

/* 3.12 — a picture standing clear of an edge-to-edge hero's top and bottom,
   a section no wider than a set width (a document card), and card labels
   and numbers styled apart from the section's eyebrow. All off until chosen. */

vi.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => ({ push() {} }) }));
const { BlockRenderer } = await import('@/components/blocks/Renderer');
const hero = (props: Record<string, unknown>) =>
  renderToStaticMarkup(<BlockRenderer blocks={[{ id: 'h', type: 'hero', props: { variant: 'split', title: 'Hi', imageUrl: '/media/x.webp', alt: '', bleed: true, ...props } }] as never} />);

describe('an edge-to-edge picture’s inset', () => {
  it('is none until set, and takes a percentage', () => {
    expect(hero({})).not.toContain('has-bleed-inset');
    const html = hero({ bleedInset: '5%' });
    expect(html).toContain('has-bleed-inset');
    expect(html).toContain('--he-bleed-inset:5%');
    expect(readFileSync(join(__dirname, '../src/styles/library-blocks.css'), 'utf8')).toContain('.he-hero--split.is-bleed.has-bleed-inset .he-hero__visualmedia { position: absolute; top: var(--he-bleed-inset); left: 0; width: 100%; height: calc(100% - 2 * var(--he-bleed-inset)); }');
  });
});

describe('a section’s most width', () => {
  it('centres it no wider than set', () => {
    expect(blockStyleToCss('d', blockStyleSchema.parse({ maxWidth: '952px' }))).toContain('max-width:952px;margin-inline:auto');
    expect(blockStyleToCss('d', blockStyleSchema.parse({}))).not.toContain('max-width');
  });
});

describe('card labels and numbers', () => {
  it('can differ from the section’s eyebrow, written after it', () => {
    const css = blockStyleToCss('c', blockStyleSchema.parse({ typography: { eyebrow: { color: '#e63946' }, cardLabel: { color: '#ffffff' } } }));
    const eyebrowAt = css.indexOf('{color:#e63946}');
    // As specific as the eyebrow rule (its :not() adds a class), and written after it.
    const labelAt = css.indexOf('.he-b-c :is(.he-ucard__eyebrow,.he-mrows__num,.he-fgrid__eyebrow):not(.type-eyebrow){color:#ffffff}');
    expect(eyebrowAt).toBeGreaterThan(-1);
    expect(labelAt).toBeGreaterThan(eyebrowAt);
  });
});
