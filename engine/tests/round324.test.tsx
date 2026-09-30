import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ImageBlock } from '@/components/blocks';
import { CardGridVariant } from '@/components/blocks/library/content';
import { blockSchemas } from '@/lib/blocks';
import { blogSchema, titleClamp } from '@/lib/blog';
import { chromeSchema, resolveChrome } from '@/lib/chrome';
import { cookieNoticeSchema } from '@/lib/cookies';
import { projectCardLook, projectCardSchema } from '@/lib/projectCard';
import { projectTemplateSchema } from '@/lib/projects';
import { themeSchema } from '@/lib/theme';
import { linkHoverCss, themeToCss } from '@/lib/theme-css';

/* 3.24 — round 5 of the parity list: linked pictures, project cards, the
   pointer over them, card grid spacing, the menus, the cookie notice, link
   hovers, short card titles and card sliders. Every option is off, or as
   before, until chosen — checked here first. */

vi.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => ({ push() {} }) }));

const styles = join(__dirname, '../src/styles');
const css = (file: string) => readFileSync(join(styles, file), 'utf8');
const theme = (value: unknown) => themeToCss(themeSchema.parse(value));

describe('N1 — a picture can be a link', () => {
  const base = blockSchemas.image.parse({ url: '/media/a.jpg', alt: 'A' });

  it('renders an unlinked picture exactly as before', () => {
    const html = renderToStaticMarkup(<ImageBlock {...base} />);
    expect(html).not.toContain('he-img-link');
    expect(html).not.toContain('<a ');
  });

  it('links the whole picture, opening an outside address in a new tab', () => {
    const inside = renderToStaticMarkup(<ImageBlock {...blockSchemas.image.parse({ url: '/media/a.jpg', alt: 'A', href: '/studio', hover: 'zoom' })} />);
    expect(inside).toMatch(/<a [^>]*href="\/studio"/);
    expect(inside).toContain('class="he-img-link is-zoom"');
    expect(inside).not.toContain('target=');
    const outside = renderToStaticMarkup(<ImageBlock {...blockSchemas.image.parse({ url: '/media/a.jpg', alt: 'A', href: 'https://example.com' })} />);
    expect(outside).toContain('target="_blank"');
    expect(outside).toContain('rel="noopener noreferrer"');
  });

  it('refuses a script address', () => {
    expect(blockSchemas.image.safeParse({ url: '/media/a.jpg', href: 'javascript:alert(1)' }).success).toBe(false);
  });
});

describe('N2 — project cards', () => {
  it('draws nothing new for an untouched card', () => {
    expect(projectCardLook(undefined)).toEqual({ className: [], style: {} });
    expect(projectCardLook({})).toEqual({ className: [], style: {} });
  });

  it('writes the shape, corners, zoom and line colour as properties', () => {
    const look = projectCardLook({ ratio: '1/1', radius: 10, categoryStyle: 'plain', reveal: 'link', revealColor: '#2255cc', zoom: 1.06 });
    expect(look.className).toEqual(['has-ratio', 'has-radius', 'is-cats-plain', 'has-reveal']);
    expect(look.style).toEqual({ '--he-proj-ratio': '1 / 1', '--he-proj-radius': '10px', '--he-proj-reveal': '#2255cc', '--he-proj-zoom': 1.06 });
    expect(projectCardLook({ ratio: 'auto' }).className).toEqual(['is-ratio-auto']);
  });

  it('checks the options on the block and on the archives', () => {
    expect(projectCardSchema.safeParse({ revealColor: 'red;x' }).success).toBe(false);
    expect(projectCardSchema.safeParse({ zoom: 2 }).success).toBe(false);
    expect(blockSchemas.projects.safeParse({ card: { ratio: '1/1', reveal: 'link', revealLabel: 'Show project' } }).success).toBe(true);
    expect(projectTemplateSchema.parse({}).archive.card).toBeUndefined();
    expect(projectTemplateSchema.safeParse({ archive: { card: { ratio: '1/1', radius: 10 } } }).success).toBe(true);
  });

  it('keeps the zoom at 1.05 unless a card says otherwise', () => {
    expect(css('library-showcase.css')).toContain('scale(var(--he-proj-zoom, 1.05))');
  });
});

describe('N3/N5/N6 — the pointer and the menus, off until chosen', () => {
  it('keeps the pointer and the menu as they were', () => {
    const c = resolveChrome(undefined);
    expect(c.cursor.linkedMedia).toBe('off');
    expect(c.mobileMenu.columnWidth).toBeUndefined();
    expect(c.mobileMenu.verticalAlign).toBe('top');
    expect(c.mobileMenu.expandAt).toBe('end');
    expect(c.mobileMenu.hideHeader).toBe(false);
    expect(c.mobileMenu.socialNetworks).toBeUndefined();
    expect(c.mobileMenu.onPhones).toBeUndefined();
  });

  it('gives phones their own menu only when a style is chosen', () => {
    expect(resolveChrome({ mobileMenu: { onPhones: { width: '320px' } } } as never).mobileMenu.onPhones).toBeUndefined();
    const phones = resolveChrome({ mobileMenu: { variant: 'fullscreen', side: 'left', onPhones: { variant: 'drawer', width: '320px', itemSize: '18px', itemWeight: '400', ctaInList: true } } } as never).mobileMenu.onPhones;
    expect(phones).toEqual({ variant: 'drawer', upTo: 'mobile', side: 'left', width: '320px', itemSize: '18px', itemWeight: '400', source: 'main', ctaInList: true });
  });

  it('checks sizes, colours and networks as values', () => {
    expect(chromeSchema.safeParse({ cursor: { linkedMedia: 'arrow', discSize: 60, discColor: 'rgba(255,255,255,0.2)' } }).success).toBe(true);
    expect(chromeSchema.safeParse({ cursor: { discColor: 'red;x' } }).success).toBe(false);
    expect(chromeSchema.safeParse({ mobileMenu: { columnWidth: '380px', socialNetworks: ['linkedin', 'behance', 'instagram'], phoneLabel: 'Ph:' } }).success).toBe(true);
    expect(chromeSchema.safeParse({ mobileMenu: { columnWidth: '380px;x' } }).success).toBe(false);
    expect(chromeSchema.safeParse({ mobileMenu: { onPhones: { width: 'wide' } } }).success).toBe(false);
  });
});

describe('N4 — card grid spacing, title and link mark', () => {
  const grid = (extra: Record<string, unknown>) =>
    renderToStaticMarkup(<CardGridVariant {...blockSchemas.cardGrid.parse({ variant: 'icons', cards: [{ title: 'Studio', body: 'Text', href: '/studio', buttonLabel: 'Learn more' }], ...extra })} />);

  it('draws the chevron and no spacing of its own until asked', () => {
    const html = grid({});
    expect(html).toContain('Learn more ›');
    expect(html).not.toContain('has-pg');
    expect(html).not.toContain('no-title-line');
  });

  it('spaces the parts per tier, keeps the title still and uses the theme arrow', () => {
    const html = grid({ partGap: '40px', partGapMobile: '24px', titleHover: 'none', moreArrow: 'theme' });
    expect(html).toContain('has-pg');
    expect(html).toContain('has-pg-m');
    expect(html).not.toContain('has-pg-t');
    expect(html).toContain('--he-fgrid-pg:40px');
    expect(html).toContain('no-title-line');
    expect(html).toContain('he-more__icon');
    expect(blockSchemas.cardGrid.safeParse({ partGap: '40px;x' }).success).toBe(false);
  });
});

describe('N7 — the cookie notice', () => {
  it('keeps the old notice and takes the icon, the plain ✕ and the link weight', () => {
    expect(cookieNoticeSchema.safeParse({}).success).toBe(true);
    expect(cookieNoticeSchema.safeParse({ icon: 'cookie', closeStyle: 'plain', linkWeight: '700' }).success).toBe(true);
    expect(cookieNoticeSchema.safeParse({ linkWeight: 'bold' }).success).toBe(false);
  });
});

describe('N8 — link hovers', () => {
  it('writes nothing for the colour change the site already had', () => {
    expect(theme({})).toBe('');
    expect(linkHoverCss(undefined)).toBe('');
    expect(linkHoverCss({ hover: 'color' })).toBe('');
  });

  it('underlines, or sweeps a line out and back — and holds it still for reduced motion', () => {
    expect(linkHoverCss({ hover: 'underline', lineWidth: '0.18em' })).toContain('text-decoration-thickness:0.18em');
    const sweep = theme({ links: { hover: 'sweep', lineWidth: '0.18em' } });
    expect(sweep).toContain('--he-sweep-w:0.18em');
    expect(sweep).toContain('@keyframes he-link-sweep');
    expect(sweep).toContain('.he-hdr__link:hover');
    expect(sweep).toContain('.he-reduce-motion .he-hdr__link:hover,');
    expect(sweep).toContain('prefers-reduced-motion:reduce');
    expect(themeSchema.safeParse({ links: { lineWidth: '1px;x' } }).success).toBe(false);
  });
});

describe('N9 — card titles cut to a few lines', () => {
  it('adds a class only when asked', () => {
    expect(titleClamp(undefined)).toEqual({ style: {} });
    expect(titleClamp({ titleLines: 2 })).toEqual({ className: 'has-title-lines', style: { '--he-card-lines': 2 } });
    expect(blogSchema.safeParse({ card: { titleLines: 2 } }).success).toBe(true);
    expect(blogSchema.safeParse({ card: { titleLines: 4 } }).success).toBe(false);
    expect(blockSchemas.postList.safeParse({ card: { titleLines: 3 } }).success).toBe(true);
    expect(css('library-blog.css')).toContain('-webkit-line-clamp: var(--he-card-lines)');
  });
});

describe('N10 — card sliders', () => {
  it('puts the arrows under the slides and takes the slides’ own look', () => {
    const slides = [{ title: 'One' }, { title: 'Two' }];
    expect(blockSchemas.carousel.safeParse({ slides, arrows: 'bottom', slideRatio: '1/1', slideRadius: 10, slideAlign: 'center', slidePlain: true }).success).toBe(true);
    expect(blockSchemas.carousel.parse({ slides }).arrows).toBe('corner');
    const blocks = css('library-blocks.css');
    expect(blocks).toContain('.he-car__foot.has-arrows');
    expect(blocks).toContain('.he-car.is-slide-center .he-card__body');
  });
});
