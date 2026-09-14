import { describe, expect, it } from 'vitest';
import { DEMO_ANIMATIONS } from '../src/content/demo/animations';
import { DEMO_IMAGES } from '../src/content/demo/images';
import { demoNavigation } from '../src/content/demo/navigation';
import { demoLibraryPages, demoPages } from '../src/content/demo/pages';
import { demoPosts } from '../src/content/demo/posts';
import { type AnyBlock, blockTypes, parseBlocks } from '../src/lib/blocks';
import { describeBlock } from '../src/lib/blockNames';
import { navigationSchema } from '../src/lib/navigation';

type Loose = { type: string; props: Record<string, unknown>; style?: unknown };

function flatten(blocks: readonly AnyBlock[]): Loose[] {
  return (blocks as unknown as Loose[]).flatMap((block) =>
    block.type === 'row'
      ? [block, ...((block.props.columns as { blocks: AnyBlock[] }[]) ?? []).flatMap((c) => flatten(c.blocks))]
      : [block],
  );
}

/** Mirrors how the page renders: which blocks put out an h1. */
function headingOnes(blocks: readonly AnyBlock[]): number {
  return flatten(blocks).filter((b) => {
    if (b.type === 'hero') return (b.props.titleAs ?? 'h1') === 'h1';
    if (b.type === 'stackedPanels' || (b.type === 'carousel' && b.props.mode === 'hero')) return b.props.titleAs === 'h1';
    return b.props.titleAs === 'h1';
  }).length;
}

describe('demo pages', () => {
  it('have unique paths', () => {
    const paths = demoPages.map((p) => p.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('lose no block to validation, at the top level or inside rows', () => {
    for (const page of demoPages) {
      expect(parseBlocks(page.blocks).length, page.path).toBe(page.blocks.length);
      for (const row of flatten(page.blocks).filter((b) => b.type === 'row')) {
        for (const column of row.props.columns as { blocks: AnyBlock[] }[]) {
          expect(parseBlocks(column.blocks).length, `${page.path} row`).toBe(column.blocks.length);
        }
      }
    }
  });

  it('each have exactly one h1', () => {
    for (const page of demoPages) expect(headingOnes(page.blocks), page.path).toBe(1);
  });

  it('show every block type in the block library', () => {
    const used = new Set(demoLibraryPages.flatMap((p) => flatten(p.blocks).map((b) => b.type)));
    for (const type of blockTypes) expect(used, type).toContain(type);
  });

  it('show every variant of the blocks that have them', () => {
    const shown = new Set(demoLibraryPages.flatMap((p) => flatten(p.blocks).map((b) => describeBlock(b.type, b.props).key)));
    const expected = [
      ...['classic', 'mediaCenter', 'mediaBottomLeft', 'split', 'statementFrame', 'shaped'].map((v) => `hero · variant: ${v}`),
      ...['cards', 'products', 'heroCards', 'hero', 'media', 'coverflow'].map((v) => `carousel · mode: ${v}`),
      ...['cards', 'tiles', 'icons', 'imageCards'].map((v) => `cardGrid · variant: ${v}`),
      'stats · variant: figures', 'faq · variant: media', 'postList · variant: news', 'image · captionStyle: lead',
      'cta · variant: big', 'cta · variant: card', 'contactForm · layout: split', 'heading · size: lede', 'prose · variant: footnotes',
      'marquee · kind: quotes', 'marquee · kind: chips',
      'windowFrame · chrome: app', 'windowFrame · chrome: terminal', 'overlayCard · placement: insideLeft',
      // Package 2
      'heading · size: display', 'heading · size: medium',
      ...['success', 'warning', 'danger'].map((v) => `notice · kind: ${v}`),
      'progress · kind: rings', 'countdown · style: plain', 'countdown · style: inline',
      ...['plain', 'filled', 'text', 'boxed'].map((v) => `socialLinks · style: ${v}`),
      'pricing · layout: contained', 'team · variant: overlay', 'team · variant: split',
      'compare · orientation: vertical', 'video · display: button', 'gallery · layout: masonry', 'gallery · layout: metro',
      ...['overlay', 'minimal', 'metro', 'list'].map((v) => `projects · layout: ${v}`),
      'map · layout: split', 'map · layout: full', 'mediaBand · position: left',
      'numberedList · variant: steps', 'numberedList · variant: timeline',
      'cardGrid · variant: rows', 'cardGrid · variant: overlay', 'stats · variant: counters', 'cta · variant: inline',
      ...['list', 'minimal', 'overlay', 'compact', 'wide'].map((v) => `postList · variant: ${v}`),
      'carousel · mode: quotes', 'marquee · kind: text', 'newsletter · layout: centered', 'contactForm · layout: centered',
      // Package 3
      ...['bar', 'line', 'area', 'pie', 'doughnut'].map((v) => `chart · kind: ${v}`),
      'hotspots · marker: number', 'hotspots · marker: plus', 'flipBox · effect: slide', 'flipBox · effect: fade',
      'priceList · layout: columns', 'priceList · layout: cards', 'businessHours · style: card', 'businessHours · style: compact',
      ...['icons', 'outlined', 'text'].map((v) => `share · style: ${v}`),
      'reviews · layout: masonry', 'reviews · layout: list', 'toc · style: list', 'toc · style: numbered',
      'breadcrumbs · style: pill', 'breadcrumbs · style: boxed', 'textPath · shape: arc', 'textPath · shape: wave',
      ...['pill', 'underline', 'minimal'].map((v) => `search · style: ${v}`),
      ...['plain', 'inline', 'grid'].map((v) => `checkLists · layout: ${v}`),
      ...['dashed', 'dotted', 'double', 'wave', 'zigzag'].map((v) => `spacer · lineStyle: ${v}`),
      'postList · variant: carousel', 'postList · variant: featured', 'projects · layout: carousel', 'marquee · kind: photos',
      'form · layout: plain',
      ...['once', 'hover', 'scroll'].map((v) => `lottie · play: ${v}`),
      // Package 4
      'carousel · mode: splitScreen', 'carousel · mode: filmstrip', 'hero · variant: layered',
    ];
    for (const key of expected) expect(shown, key).toContain(key);
  });

  it('keep library pages on the library template and out of search', () => {
    for (const page of demoLibraryPages) {
      expect(page.template).toBe('library');
      expect(page.seo.robots).toMatch(/noindex/);
    }
  });

  it('only use images the demo seed creates', () => {
    const known = new Set(DEMO_IMAGES.map((i) => `/media/demo/${i.name}.${i.format}`));
    const used = JSON.stringify({ demoPages, demoNavigation }).match(/\/media\/demo\/[a-z0-9-]+\.(?:webp|png)/g) ?? [];
    expect(used.length).toBeGreaterThan(20);
    for (const url of used) expect(known, url).toContain(url);
    for (const post of demoPosts) expect(DEMO_IMAGES.some((i) => i.name === post.cover), post.slug).toBe(true);
  });

  it('only use animations the demo seed creates', () => {
    const known = new Set(DEMO_ANIMATIONS.map((a) => `/media/demo/${a.name}.json`));
    const used = JSON.stringify(demoPages).match(/\/media\/demo\/[a-z0-9-]+\.json/g) ?? [];
    expect(used.length).toBeGreaterThanOrEqual(4);
    for (const url of used) expect(known, url).toContain(url);
  });
});

describe('demo images and menus', () => {
  it('are self-contained SVG with no external references', () => {
    for (const image of DEMO_IMAGES) {
      expect(image.svg.startsWith('<svg'), image.name).toBe(true);
      expect(image.svg, image.name).not.toMatch(/href=|url\((?!#)/);
    }
  });

  it('ship menus that pass the navigation schema', () => {
    expect(navigationSchema.safeParse(demoNavigation).success).toBe(true);
  });
});
