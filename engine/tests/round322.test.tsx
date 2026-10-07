import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { blockSchemas } from '@/lib/blocks';
import { blockStyleSchema } from '@/lib/blockStyle';
import { blockStyleToCss } from '@/lib/blockStyle-css';
import { blogSchema, eyebrowAroundCategory, resolveBlog } from '@/lib/blog';
import { bodyImageUrls, rewriteBodyImages } from '@/lib/bodyImages';
import { chromeSchema, resolveChrome } from '@/lib/chrome';
import { pageNumberHop, DEFAULT_PERMALINKS } from '@/lib/permalinks';
import { customNodes } from '@/lib/seo/jsonld';
import { roleVar, themeSchema } from '@/lib/theme';
import { PALETTE_FOLLOWERS, themeToCss } from '@/lib/theme-css';
import { pageAppearanceCss } from '@/lib/pageAppearance';

/* 3.22 — round 3 of the parity list: labels, widths per tier, swipe on every
   grid, logos, headings over lines, the FAQ, the post and blog templates,
   the overlay menu, the header, video, duplicate, URLs and imports. Every
   option is off, or as before, until chosen — checked here first. */

vi.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => ({ push() {} }) }));

const styles = join(__dirname, '../src/styles');
const css = (file: string) => readFileSync(join(styles, file), 'utf8');
const theme = (value: unknown) => themeToCss(themeSchema.parse(value));

describe('R1 — labels read Appearance → Labels, and look as before until it is set', () => {
  it('writes the three label roles as properties, in kebab case', () => {
    expect(roleVar('footerTitle')).toBe('footer-title');
    const out = theme({ typography: { label: { base: { family: 'system', transform: 'none', size: '15px' }, mobile: { size: '14px' } }, footerTitle: { base: { weight: '700' } }, cardLink: { base: { color: '#ff0000' } } } });
    expect(out).toContain('--he-label-transform:none');
    expect(out).toContain('--he-label-size:15px');
    expect(out).toContain('--he-footer-title-weight:700');
    expect(out).toContain('--he-card-link-color:#ff0000');
    expect(out).toMatch(/@media \(max-width:768px\)\{:root\{[^}]*--he-label-size:14px/);
    expect(theme({})).toBe('');
  });

  it('leaves no mono capitals in a stylesheet that the role cannot reach', () => {
    for (const file of readdirSync(styles).filter((f) => f.endsWith('.css') && !f.startsWith('fonts'))) {
      const text = css(file);
      // A rule that says both, literally, is a label nothing can restyle.
      for (const rule of text.split('}')) {
        const literalMono = /font-family:\s*var\(--font-mono\)/.test(rule);
        const literalUpper = /text-transform:\s*uppercase/.test(rule);
        expect(literalMono && literalUpper, `${file}: ${rule.trim().slice(0, 120)}`).toBe(false);
      }
    }
  });

  it('keeps an element’s own weight and line height while the role says nothing', () => {
    // `revert-layer`, not `inherit`: a heading used as a label keeps the heading's weight (it was 800, and `inherit` made it 400).
    expect(css('globals.css')).toContain('font-weight: var(--he-label-weight, revert-layer);');
    expect(css('globals.css')).not.toMatch(/--he-label-(weight|line), inherit\)/);
  });

  it('draws the section eyebrow from Labels until its own role is set', () => {
    expect(css('globals.css')).toContain('--he-eyebrow-transform: var(--he-label-transform, uppercase);');
  });

  it('has no mono capitals left in the components, but the skip link', () => {
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : e.name.endsWith('.tsx') ? [join(dir, e.name)] : []));
    const files = [...walk(join(__dirname, '../src/components')), ...walk(join(__dirname, '../src/app/(site)'))].filter((f) => !f.includes('/admin/'));
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      for (const [className] of text.matchAll(/['"`][^'"`]*font-mono[^'"`]*['"`]/g)) {
        if (/focus:uppercase/.test(className)) continue;
        expect(/\buppercase\b/.test(className), `${file}: ${className}`).toBe(false);
      }
    }
  });
});

describe('R2 — the content column per tier', () => {
  it('writes each tier’s width only when set', () => {
    const out = theme({ layout: { containerWidth: '86vw', containerWidthMobile: '100%' } });
    expect(out).toContain('--container-shell:86vw');
    expect(out).toMatch(/@media \(max-width:768px\)\{:root\{[^}]*--container-shell:100%/);
    expect(out).not.toMatch(/max-width:1024px\)\{:root\{[^}]*--container-shell/);
  });
});

describe('R3/R5/R6/R7/R10/R16/R22 — block options', () => {
  it('parses every new option and leaves stored blocks as they were', () => {
    expect(blockSchemas.cardGrid.parse({ variant: 'icons', iconSize: '200px', mediaRatio: 'auto', mediaFit: 'contain', mediaMaxHeight: '220px', cards: [] }).iconSize).toBe('200px');
    expect(blockSchemas.logoWall.parse({ logos: [{ name: 'A' }] }).greyscale).toBeUndefined();
    expect(blockSchemas.faq.parse({ items: [] }).layout).toBeUndefined();
    expect(blockSchemas.heading.parse({ title: 'x', size: 'theme' }).size).toBe('theme');
    expect(blockSchemas.mediaBand.safeParse({ heightCustom: 'tall' }).success).toBe(false);
    expect(blockSchemas.carousel.parse({ slides: [{ title: 'a' }], counter: { pad: false, separator: 'line' } }).counter).toEqual({ pad: false, separator: 'line' });
    expect(blockSchemas.hero.parse({ title: 'Image.', highlight: '.' }).highlight).toBe('.');
  });

  it('keeps a typed line break in a heading', () => {
    expect(css('library-blocks.css')).toContain('.he-site :is(p, li, dd, blockquote, figcaption, h1, h2, h3, h4, h5, h6):not(.prose-edge, .prose-edge *)');
  });

  it('draws the logos at a height, in colour, at an opacity of their own', async () => {
    const { LogoWall } = await import('@/components/blocks/library/content');
    const html = renderToStaticMarkup(<LogoWall {...blockSchemas.logoWall.parse({ logos: [{ name: 'A' }], logoHeight: '111px', greyscale: false, opacity: 1, logoHover: 'none', columnsMobile: 3 })} />);
    expect(html).toContain('--he-logo-h:111px');
    expect(html).toContain('--he-logo-f:none');
    expect(html).toContain('--he-logo-o:1');
    expect(html).toContain('--cols-m:3');
    expect(html).toContain('is-hover-none');
    const plain = renderToStaticMarkup(<LogoWall {...blockSchemas.logoWall.parse({ logos: [{ name: 'A' }] })} />);
    expect(plain).not.toContain('--he-logo');
  });
});

describe('R4 — "swipe on phones" reaches every block that lays items out in a grid', () => {
  const style = blockStyleSchema.parse({ swipeOn: 'mobile', swipeWidth: 82, swipeArrows: 'belowRight' });
  const rules = blockStyleToCss('b1', style);

  it('aims at the library grids by their shared class, with the card width and room for arrows', () => {
    expect(rules).toContain('.he-b-b1 :is(.he-swipe-track,[class*="grid-cols-"]:not(.he-swipe-track *))');
    expect(rules).toContain('flex:0 0 82%');
    expect(rules).toContain('margin-bottom:64px');
    // Unset: the width it always had, and no room for arrows.
    const plain = blockStyleToCss('b1', blockStyleSchema.parse({ swipeOn: 'mobile' }));
    expect(plain).toContain('flex:0 0 84%');
    expect(plain).not.toContain('margin-bottom:64px');
  });

  /* The acceptance test: each grid-type block, rendered, has an element the
     generated selector matches — a `he-swipe-track`, or a `grid-cols-*` grid. */
  const matchesTrack = (html: string) => /class="[^"]*\bhe-swipe-track\b/.test(html) || /class="[^"]*\bgrid-cols-/.test(html);

  it.each([
    ['cardGrid cards', async () => (await import('@/components/blocks/index')).CardGridBlock, 'cardGrid', { cards: [{ title: 'A' }] }],
    ['cardGrid bento', async () => (await import('@/components/blocks/index')).CardGridBlock, 'cardGrid', { pattern: '2-3', cards: [{ title: 'A' }, { title: 'B' }, { title: 'C' }] }],
    ...(['tiles', 'mosaic', 'icons', 'imageCards', 'rows', 'overlay', 'mediaRows'] as const).map(
      (variant) => [`cardGrid ${variant}`, async () => (await import('@/components/blocks/index')).CardGridBlock, 'cardGrid', { variant, cards: [{ title: 'A' }] }] as const,
    ),
    ['logoWall', async () => (await import('@/components/blocks/library/content')).LogoWall, 'logoWall', { logos: [{ name: 'A' }] }],
    ['stats tiles', async () => (await import('@/components/blocks/index')).StatsBlock, 'stats', { items: [{ value: '1', label: 'A' }] }],
    ['stats figures', async () => (await import('@/components/blocks/index')).StatsBlock, 'stats', { variant: 'figures', items: [{ value: '1', label: 'A' }] }],
    ['stats counters', async () => (await import('@/components/blocks/index')).StatsBlock, 'stats', { variant: 'counters', items: [{ value: '1', label: 'A' }] }],
    ['reviews', async () => (await import('@/components/blocks/library/widgets')).ReviewsBlock, 'reviews', { items: [{ name: 'A', text: 'Good' }] }],
    ['reviews masonry', async () => (await import('@/components/blocks/library/widgets')).ReviewsBlock, 'reviews', { layout: 'masonry', items: [{ name: 'A', text: 'Good' }] }],
    ['gallery', async () => (await import('@/components/blocks/library/showcase')).GalleryBlock, 'gallery', { images: [{ url: '/media/a.webp' }] }],
    ['team', async () => (await import('@/components/blocks/library/elements')).TeamBlock, 'team', { members: [{ name: 'A' }] }],
    ['pricing', async () => (await import('@/components/blocks/library/elements-client')).PricingBlock, 'pricing', { plans: [{ name: 'A', price: '1' }] }],
    ['projects', async () => (await import('@/components/blocks/library/showcase')).ProjectsBlock, 'projects', { items: [{ title: 'A' }] }],
  ] as const)('%s', async (_name, load, type, props) => {
    const Component = (await load()) as (p: unknown) => React.ReactElement;
    const parsed = (blockSchemas as unknown as Record<string, { parse: (v: unknown) => unknown }>)[type]!.parse(props);
    expect(matchesTrack(renderToStaticMarkup(<Component {...(parsed as object)} />))).toBe(true);
  });

  it('includes the post list layouts', async () => {
    const { PostCollection } = await import('@/components/blocks/dynamic');
    const post = { id: 'p', slug: 'a', title: 'A', excerpt: '', kind: 'article', publishedAt: null, readingMinutes: 1, coverUrl: null, categoryName: null, categorySlug: null } as never;
    for (const variant of ['list', 'minimal', 'overlay', 'compact', 'wide'] as const) {
      expect(matchesTrack(renderToStaticMarkup(<PostCollection posts={[post]} variant={variant} permalinks={DEFAULT_PERMALINKS} />)), variant).toBe(true);
    }
  });
});

describe('R9/R13 — the post and the blog index', () => {
  it('resolves every new option to what the blog already did', () => {
    const blog = resolveBlog(undefined);
    expect(blog.eyebrowStyle).toBe('rule');
    expect(blog.meta).toEqual({ show: true, author: true, readingTime: true, categories: true });
    expect([blog.excerpt, blog.searchOff, blog.toolbar, blog.browseLabel]).toEqual([true, false, false, true]);
    expect(blog.related.cards).toBe('text');
    expect(blog.upNext).toMatchObject({ phones: false, dismiss: 'visit' });
    expect(blogSchema.safeParse({ share: { position: 'beside' } }).success).toBe(true);
  });

  it('splits the line above the title around its category, for the chip', () => {
    expect(eyebrowAroundCategory('{category} · {minutes} {minRead}', { date: '', minutes: 17, minRead: 'min read' })).toEqual({ before: '', after: '· 17 min read' });
    expect(eyebrowAroundCategory(undefined, { date: '', minutes: 1, minRead: 'min read' })).toEqual({ before: '', after: '' });
    expect(eyebrowAroundCategory('{minutes} min', { date: '', minutes: 1, minRead: '' })).toBeNull();
  });

  it('gives a post’s pictures their size, and a srcset with responsive images on', () => {
    const html = '<p><img src="/media/2026/01/a.webp" alt="A" loading="lazy" decoding="async"><img src="https://elsewhere.test/b.png" alt=""></p>';
    expect(bodyImageUrls(html)).toEqual(['/media/2026/01/a.webp']);
    const shapes = new Map([['/media/2026/01/a.webp', { width: 1600, height: 900 }]]);
    const off = rewriteBodyImages(html, shapes, false);
    expect(off).toContain('width="1600" height="900"');
    expect(off).not.toContain('srcset');
    const on = rewriteBodyImages(html, shapes, true);
    expect(on).toContain('srcset="/media/2026/01/a.webp?w=480 480w');
    expect(on).toContain('/media/2026/01/a.webp 1600w"');
    expect(on).toContain('https://elsewhere.test/b.png" alt="">');
  });
});

describe('R11/R12/R14/R18/R19/R21 — the chrome, off until chosen', () => {
  it('keeps every new chrome option at what the site already did', () => {
    const c = resolveChrome(chromeSchema.parse({}));
    expect(c.mobileMenu).toMatchObject({ services: true, expandIcon: 'circle', contactPosition: 'column', contactEmail: true, contactAddress: true, contactSocial: true });
    expect(c.mobileMenu.itemSize).toBeUndefined();
    expect(c.header).toMatchObject({ glassSaturate: 120, border: true, under: false, ctaStyle: 'primary', ctaColors: {} });
    expect(c.footer).toMatchObject({ socialSeparator: 'none', contactLinks: [] });
    expect(c.transition).toMatchObject({ style: 'off', preloader: false, firstLoad: false, leave: 'fade' });
    expect(c.videoControls).toBe(true);
  });

  it('checks the menu’s sizes and colours as values, never as free text', () => {
    expect(chromeSchema.safeParse({ mobileMenu: { itemSize: '40px;color:red' } }).success).toBe(false);
    expect(chromeSchema.safeParse({ mobileMenu: { background: 'red' } }).success).toBe(false);
    expect(chromeSchema.safeParse({ header: { ctaColors: { text: '#fff' } } }).success).toBe(true);
    expect(resolveChrome(chromeSchema.parse({ rails: { enabled: true, orientation: 'row', separator: 'slash' } })).rails).toMatchObject({ orientation: 'row', separator: 'slash', position: 'center', font: 'label' });
  });
});

describe('R22 — a section or a page in another palette takes every colour with it', () => {
  it('re-points the colours that name a palette token, as globals.css declares them', () => {
    const globals = css('globals.css');
    const declared = [...globals.matchAll(/^\s+(--he-[a-z0-9-]+):\s*(.*var\(--color-[^;]*);/gm)].map(([, name, value]) => [name, value]);
    expect(PALETTE_FOLLOWERS).toEqual(declared);
  });

  it('writes the second palette as its own class, and on a page', () => {
    const t = themeSchema.parse({ colorsAlt2: { background: '#f4f1ec', textPrimary: '#111111' }, typography: { h2: { base: { color: '#ff0000' } } } });
    const out = themeToCss(t);
    expect(out).toMatch(/\.he-scheme-alt2\{--color-ink:#f4f1ec;--color-bone:#111111;color:var\(--color-bone\);[^}]*--he-h1-color:var\(--color-bone\)/);
    // A colour the site set outright is not re-pointed.
    expect(out).not.toMatch(/\.he-scheme-alt2\{[^}]*--he-h2-color/);
    expect(pageAppearanceCss({ scheme: 'alt2' }, t)).toBe(':root{--color-ink:#f4f1ec;--color-bone:#111111}');
  });
});

describe('R23 — addresses', () => {
  it('sends page 1 and a padded page number to their one spelling, and leaves page 0 to 404', () => {
    expect(pageNumberHop('/blog/page/1', 'page')).toBe('/blog');
    expect(pageNumberHop('/page/1', 'page')).toBe('/');
    expect(pageNumberHop('/blog/page/02/', 'page')).toBe('/blog/page/2');
    expect(pageNumberHop('/blog/page/0', 'page')).toBeNull();
    expect(pageNumberHop('/blog/page/2', 'page')).toBeNull();
  });

  it('keeps a pasted @graph document, and a @type that is a list', () => {
    const nodes = customNodes([{ '@context': 'https://schema.org', '@graph': [{ '@type': 'Organization', name: 'A' }, { '@type': ['LocalBusiness', 'Store'], name: 'B' }, { name: 'untyped' }] }]);
    expect(nodes).toEqual([{ '@type': 'Organization', name: 'A' }, { '@type': ['LocalBusiness', 'Store'], name: 'B' }]);
  });
});
