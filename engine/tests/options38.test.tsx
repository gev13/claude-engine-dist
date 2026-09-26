import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { blockStyleSchema } from '@/lib/blockStyle';
import { blockStyleToCss } from '@/lib/blockStyle-css';
import { themeSchema } from '@/lib/theme';
import { themeToCss } from '@/lib/theme-css';

/* 3.8 — what a close comparison with a finished design asked of the engine:
   headings that fill their lines, the introduction's gap and width, a solid
   line before a button's arrow and the label's weight, card eyebrows and
   bodies a section can style, rows with a set picture width, image-card
   shapes, dividers between cards, figure sizes, and a band's dark text.
   All off until chosen; two fixes are not. */

vi.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => ({ push() {} }) }));
const { BlockRenderer } = await import('@/components/blocks/Renderer');
const render = (blocks: unknown[]) => renderToStaticMarkup(<BlockRenderer blocks={blocks as never} />);
const read = (...p: string[]) => readFileSync(join(__dirname, '..', ...p), 'utf8');
const theme = (t: unknown) => themeToCss(themeSchema.parse(t));

describe('theme options', () => {
  it('write nothing until chosen', () => {
    const css = theme({});
    expect(css).not.toContain('text-wrap:wrap');
    expect(css).not.toContain('--he-intro-gap');
    expect(css).not.toContain('2px solid currentColor');
  });

  it('let headings fill their lines, space the introduction, and firm up the buttons', () => {
    const css = theme({ layout: { titleWrap: 'wrap', introGap: '40px', introWidth: '680px' }, buttons: { icon: 'cell', divider: 'solid', weight: '500' } });
    expect(css).toContain(':is(h1,h2,h3,h4){text-wrap:wrap}');
    expect(css).toContain('--he-intro-gap:40px');
    expect(css).toContain('--he-intro-measure:680px');
    expect(css).toContain('border-left:2px solid currentColor');
    expect(css).toMatch(/:is\(\.he-btn,\.he-cbtn\)\{font-weight:500\}/);
    expect(read('src/components/blocks/parts.tsx')).toContain('mt-[var(--he-intro-gap,16px)] max-w-[var(--he-intro-measure,62ch)]');
  });
});

describe('a section’s typography', () => {
  it('reaches card eyebrows, numbers and bodies', () => {
    const css = blockStyleToCss('s', blockStyleSchema.parse({ typography: { eyebrow: { color: '#123456' }, body: { size: '16px' } } }));
    expect(css).toContain('.he-b-s :is(.he-eyebrow .type-eyebrow,.he-ucard__eyebrow,.he-mrows__num,.he-fgrid__eyebrow){color:#123456}');
    expect(css).toContain('.he-b-s :is(p,li,td,span,.he-ucard__body):not(.type-eyebrow,.he-ilist__slash,.he-title-after){font-size:16px}');
  });

  it('no longer sets the eyebrow in the body’s size (a fix)', () => {
    const css = blockStyleToCss('s', blockStyleSchema.parse({ typography: { body: { size: '24px' } } }));
    expect(css).toMatch(/:not\(\.type-eyebrow/);
  });
});

describe('block options', () => {
  const cards = [{ title: 'One', body: 'a', imageUrl: '/media/x.webp', alt: '' }];
  it('set a row’s picture width, an image card’s shape and a line between cards', () => {
    expect(render([{ id: 'r', type: 'cardGrid', props: { variant: 'mediaRows', mediaWidth: '400px', cards } }])).toMatch(/class="he-mrows [^"]*has-media-width" style="--he-mrows-media:400px"/);
    expect(render([{ id: 'i', type: 'cardGrid', props: { variant: 'imageCards', mediaRatio: '5/4', cards } }])).toContain('--he-icard-ratio:5 / 4');
    expect(render([{ id: 'c', type: 'cardGrid', props: { dividers: true, cards: [{ title: 'A' }, { title: 'B' }] } }])).toContain('he-cgrid-dividers');
    expect(read('src/styles/library-sections.css')).toContain('.he-mrows.has-media-width .he-mrows__item { grid-template-columns: minmax(0, 1fr); }');
  });

  it('size the figures, and colour a band’s dark text and its main arrow', () => {
    expect(render([{ id: 's', type: 'stats', props: { variant: 'figures', valueSize: '56px', items: [{ value: '1', label: 'x' }] } }])).toContain('--he-figs-size:56px');
    const band = render([{ id: 'b', type: 'mediaBand', props: { title: 'T', imageUrl: '/media/x.webp', fade: { text: 'dark', ink: '#262626', accentArrow: true } } }]);
    expect(band).toContain('--he-fade-ink:#262626');
    expect(band).toContain('is-arrow-accent');
  });

  it('put the form’s send label in its own element, so the arrow compartment applies (a fix)', () => {
    expect(read('src/components/blocks/library/FormBlock.tsx')).toMatch(/<span>\{state === 'sending'/);
  });
});

describe('a section’s own heading width', () => {
  it('sets the measure its heading reads', () => {
    expect(blockStyleToCss('h', blockStyleSchema.parse({ titleWidth: '1100px' }))).toContain('--he-title-measure:1100px');
    expect(blockStyleToCss('h', blockStyleSchema.parse({}))).not.toContain('--he-title-measure');
  });
});
