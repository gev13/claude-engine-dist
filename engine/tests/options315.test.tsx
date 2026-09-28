import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { blockStyleSchema } from '@/lib/blockStyle';
import { blockStyleToCss } from '@/lib/blockStyle-css';
import { blockSchemas } from '@/lib/blocks';
import { CUT_BUTTON_FILL, CUT_BUTTON_RING } from '@/lib/shape';
import { themeSchema } from '@/lib/theme';
import { themeToCss } from '@/lib/theme-css';

/* 3.15 — the phone pass: a picture of its own on phones, buttons laid out
   for phones, the phone layout rules, ruled figures as a cross, and two fixes
   — picture rows that collapsed in WebKit, and see-through cut buttons that
   showed their edge colour across the whole button. */

vi.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => ({ push() {} }) }));
const { BlockRenderer } = await import('@/components/blocks/Renderer');
const { SiteImg } = await import('@/components/ui/SiteImg');

const render = (blocks: unknown[]) => renderToStaticMarkup(<BlockRenderer blocks={blocks as never} />);
const css = (name: string) => readFileSync(join(__dirname, `../src/styles/${name}`), 'utf8');
const theme = (value: unknown) => themeToCss(themeSchema.parse(value));

describe('a picture of its own on phones', () => {
  it('is a plain <img> until set, and a <picture> with a phone source when set', () => {
    const plain = renderToStaticMarkup(<SiteImg src="/media/a.webp" alt="" />);
    expect(plain).toContain('<img src="/media/a.webp" alt=""/>');
    expect(plain).not.toContain('<picture');
    expect(renderToStaticMarkup(<SiteImg src="/media/a.webp" mobileSrc="/media/p.webp" alt="" />)).toContain(
      '<picture class="he-pic"><source media="(max-width: 768px)" srcSet="/media/p.webp"/><img src="/media/a.webp" alt=""/></picture>',
    );
    expect(css('library-upgrades.css')).toContain('.he-pic { display: contents; }');
  });

  it('reaches a split hero, with its box shape on phones', () => {
    const html = render([{ id: 'h', type: 'hero', props: { variant: 'split', title: 'T', imageUrl: '/media/a.webp', imageUrlMobile: '/media/p.webp', mediaRatioMobile: '366/324' } }]);
    expect(html).toContain('<source media="(max-width: 768px)" srcSet="/media/p.webp"/>');
    expect(html).toContain('has-mobile-media');
    expect(html).toContain('--he-hero-ratio-m:366 / 324');
    expect(render([{ id: 'h', type: 'hero', props: { variant: 'split', title: 'T', imageUrl: '/media/a.webp' } }])).not.toMatch(/<picture|has-mobile-media|--he-hero-ratio-m/);
    expect(blockSchemas.hero.safeParse({ title: 'T', mediaRatioMobile: '1/1;color:red' }).success).toBe(false);
    expect(css('library-blocks.css')).toContain('aspect-ratio: var(--he-hero-ratio-m, 1 / 1)');
  });

  it('reaches picture rows and a media band; the band drops its fade there', () => {
    const rows = render([{ id: 'r', type: 'cardGrid', props: { variant: 'mediaRows', mediaRatioMobile: '326/154', cards: [{ title: 'A', imageUrl: '/media/a.webp', imageUrlMobile: '/media/p.webp' }] } }]);
    expect(rows).toContain('--he-mrows-ratio-m:326 / 154');
    expect(rows).toContain('srcSet="/media/p.webp"');
    const band = render([{ id: 'b', type: 'mediaBand', props: { imageUrl: '/media/a.webp', imageUrlMobile: '/media/p.webp', title: 'T', fade: { side: 'left', text: 'dark' } } }]);
    expect(band).toContain('has-mobile-media');
    expect(css('library-upgrades.css')).toContain('.he-band.has-mobile-media.has-fade::after { background: none; }');
  });
});

describe('picture rows in WebKit', () => {
  it('size the picture from its own width on phones, not from its (empty) grid row', () => {
    expect(css('library-sections.css')).toContain('.he-mrows__media { min-height: 0; align-self: start; width: 100%; aspect-ratio: var(--he-mrows-ratio-m, 50 / 33); }');
  });
});

describe('cut buttons', () => {
  const out = theme({ shape: { buttons: { style: 'cut' } } });

  it('paint the fill as one shape, so a see-through fill shows no seam or cross (3.15.1)', () => {
    expect(CUT_BUTTON_FILL).toMatch(/^polygon\(max\(0px,var\(--he-cut-tl,0px\) - var\(--he-bw,0px\) \* \.4142\) 0,/);
    expect(out).toContain(`:is(.he-btn,.he-cbtn:not(.is-text))::after{content:'';position:absolute;inset:0;z-index:-1;background:var(--he-bf);clip-path:${CUT_BUTTON_FILL}`);
    expect(out).not.toContain('linear-gradient(135deg,transparent');
  });

  it('draw the edge as a ring behind the label, as thick as the real border', () => {
    expect(CUT_BUTTON_RING).toMatch(/^polygon\(evenodd,/);
    expect(out).toContain('position:relative;isolation:isolate;--he-bx:var(--he-bw,0px)');
    expect(out).toContain('.he-cbtn:not(.is-text){--he-bx:2px}');
    expect(out).toContain(`:is(.he-btn,.he-cbtn:not(.is-text))::before{content:'';position:absolute;inset:calc(-1 * var(--he-bx,0px));z-index:-1;background:var(--he-bl);clip-path:${CUT_BUTTON_RING}`);
  });
});

describe('a section’s buttons on phones', () => {
  it('write nothing until chosen', () => {
    expect(blockStyleToCss('x', blockStyleSchema.parse({ panel: true }))).not.toContain(':has(');
  });

  it('stack as wide as their labels, or full width with the arrow at the end', () => {
    const fit = blockStyleToCss('x', blockStyleSchema.parse({ buttonsMobile: 'fit' }));
    expect(fit).toContain('@media (max-width:768px){.he-b-x :where(div,section):has(>:is(.he-btn,.he-cbtn)){flex-direction:column;align-items:flex-start;gap:12px}');
    const full = blockStyleToCss('x', blockStyleSchema.parse({ buttonsMobile: 'full' }));
    expect(full).toContain('width:100%;justify-content:space-between;text-align:left;white-space:normal;line-height:1.35');
  });
});

describe('the phone layout', () => {
  it('writes nothing until set, and a shell keeps its 20px', () => {
    expect(theme({})).not.toContain('--he-gutter-m');
    expect(css('globals.css')).toContain('padding-inline: var(--he-gutter-m, 20px);');
  });

  it('sets the sides, the space between sections and between a section’s parts', () => {
    const out = theme({ layout: { gutterMobile: '32px', sectionGapMobile: '120px', itemGapMobile: '30px' } });
    expect(out).toContain('@media (max-width:768px){:root{--he-gutter-m:32px}');
    expect(out).toContain(':where(#main>*+*){margin-top:120px}');
    expect(out).toContain(':where(#main>:not(.he-panel)),:where(#main>:not(.he-panel)>section),:where(#main>:not(.he-panel)>.shell),:where(#main>:not(.he-panel)>section>.shell){padding-block:0}');
    expect(out).toContain('.he-cols2>:first-child>:last-child{margin-bottom:0}');
    expect(out).toContain('#main>*{--he-panel-mt:120px;--he-panel-mb:0px}');
    expect(out).toContain(':root{--he-gap:30px;--he-intro-gap:30px}.he-head{margin-bottom:0}.he-head+*{margin-top:30px}');
  });

  it('leaves the cards’ gap to a phone gap set on its own', () => {
    expect(theme({ gapMobile: '20px', layout: { itemGapMobile: '30px' } })).toContain(':root{--he-intro-gap:30px}');
  });

  it('reaches a panel through its margins, which read the same values as before', () => {
    expect(blockStyleToCss('p', blockStyleSchema.parse({ panel: true }))).toContain('margin-top:var(--he-panel-mt,min(var(--he-panel-gap,24px),3vw));margin-bottom:var(--he-panel-mb,min(var(--he-panel-gap,24px),3vw))');
  });
});

describe('ruled figures on phones', () => {
  const stats = (extra: Record<string, unknown>) =>
    render([{ id: 's', type: 'stats', props: { variant: 'figures', dividers: true, items: [{ value: '1', label: 'a' }, { value: '2', label: 'b' }], ...extra } }]);

  it('drop their rules there as before, or keep a cross when chosen', () => {
    expect(stats({})).not.toContain('is-cross-sm');
    expect(stats({ dividersMobile: 'cross' })).toContain('is-cross-sm');
    expect(css('library-upgrades.css')).toContain('.has-dividers.is-cross-sm :is(.he-figs__item, .he-counter):nth-child(n + 3) { border-top: 1px solid var(--color-hairline); }');
  });
});
