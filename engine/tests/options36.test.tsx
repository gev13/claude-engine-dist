import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { blockSchemas } from '@/lib/blocks';
import { blockStyleSchema } from '@/lib/blockStyle';
import { blockStyleToCss } from '@/lib/blockStyle-css';
import { chromeSchema, resolveChrome } from '@/lib/chrome';

/* 3.6 — details found building a site from its final design: a section's
   eyebrow and card titles styled on their own, "/01" numbers, lists whose
   entries are cards behind a coloured slash, a split hero's picture above
   its text on phones, and the logo after the menu button. All opt-in. */

vi.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => ({ push() {} }) }));
const { BlockRenderer } = await import('@/components/blocks/Renderer');
const css = (file: string) => readFileSync(join(__dirname, '../src/styles', file), 'utf8');
const render = (blocks: unknown[]) => renderToStaticMarkup(<BlockRenderer blocks={blocks as never} />);

describe('a section’s eyebrow and card titles', () => {
  it('write nothing until set', () => {
    const out = blockStyleToCss('s1', blockStyleSchema.parse({}));
    expect(out).not.toContain('he-eyebrow');
  });

  it('style the eyebrow, its marker, and the titles under the heading', () => {
    const out = blockStyleToCss('s1', blockStyleSchema.parse({ typography: { eyebrow: { color: '#e63946', sizeMobile: '13px' }, subheading: { color: '#1e90ff' } } }));
    expect(out).toContain('.he-b-s1 :is(.he-eyebrow .type-eyebrow,.he-ucard__eyebrow,.he-mrows__num,.he-fgrid__eyebrow){color:#e63946}');
    expect(out).toContain('.he-b-s1 .he-eyebrow__rule{background-color:#e63946}');
    expect(out).toContain('.he-b-s1 :is(h3,h4,h5,h6,.he-faq__btn){color:#1e90ff}');
    expect(out).toMatch(/@media \(max-width:\d+px\)\{[^}]*\.he-b-s1 :is\(\.he-eyebrow \.type-eyebrow,[^)]*\)\{font-size:13px\}/);
  });
});

describe('numbers with a slash', () => {
  const cards = [{ title: 'One', body: 'a' }, { title: 'Two', body: 'b' }];
  it('read /01 when chosen, 01 as before', () => {
    expect(render([{ id: 'c1', type: 'cardGrid', props: { cards, numbered: true } }])).toContain('>01<');
    const slashed = render([{ id: 'c2', type: 'cardGrid', props: { cards, numbered: true, numberStyle: 'slash' } }]);
    expect(slashed).toContain('/01');
    expect(slashed).toContain('/02');
  });

  it('apply to picture rows and category lists too', () => {
    const rows = render([{ id: 'c3', type: 'cardGrid', props: { variant: 'mediaRows', numberStyle: 'slash', cards: cards.map((c) => ({ ...c, imageUrl: '/media/x.webp', alt: '' })) } }]);
    expect(rows).toContain('/01');
    expect(blockSchemas.categoryIndex.parse({ numberStyle: 'slash' }).numberStyle).toBe('slash');
    expect(blockSchemas.cardGrid.safeParse({ numberStyle: 'roman' }).success).toBe(false);
  });
});

describe('lists of cards behind a slash', () => {
  const lists = [{ title: 'Covers', accent: '#e63946', items: ['Network', 'Cloud'] }, { title: 'You get', items: ['A report'] }];

  it('put the slash inside each entry’s text, in the list’s colour', () => {
    const html = render([{ id: 'l1', type: 'checkLists', props: { icon: 'slash', layout: 'cards', lists } }]);
    expect(html).toMatch(/<span class="he-ilist__text"><span class="he-ilist__slash" aria-hidden="true">\/<\/span>Network/);
    expect(html).toContain('is-cards');
    expect(html).toContain('--he-ilist-accent:#e63946');
    expect(html).toContain('he-ilist-accent');
  });

  it('take only a colour for a list', () => {
    expect(blockSchemas.checkLists.safeParse({ lists: [{ accent: 'url(x)', items: [] }] }).success).toBe(false);
  });

  it('are cards shaped like the site’s cards', () => {
    expect(css('library-upgrades.css')).toMatch(/\.he-ilist\.is-cards \.he-ilist__item \{[^}]*border-radius: var\(--he-card-radius\); clip-path: var\(--he-card-clip, none\)/);
    // Unlayered, so a section's text colour cannot repaint the slash.
    expect(css('library-upgrades.css')).toMatch(/\n\.he-ilist \.he-ilist__slash \{[^}]*color: var\(--he-ilist-accent/);
  });
});

describe('a split hero on phones', () => {
  it('keeps the picture below the text until told otherwise', () => {
    const base = { variant: 'split', title: 'Hi', imageUrl: '/media/x.webp', alt: '' };
    expect(render([{ id: 'h1', type: 'hero', props: base }])).not.toContain('is-media-first-sm');
    expect(render([{ id: 'h2', type: 'hero', props: { ...base, mediaFirstMobile: true } }])).toContain('is-media-first-sm');
    expect(css('library-blocks.css')).toContain('.he-hero--split.is-media-first-sm .he-hero__visual { order: -1; }');
  });
});

describe('the logo after the menu button', () => {
  it('is a third choice for phones', () => {
    expect(resolveChrome(chromeSchema.parse({ header: { logoMobile: 'afterMenu' } })).header.logoMobile).toBe('afterMenu');
    expect(resolveChrome(undefined).header.logoMobile).toBe('left');
    expect(css('library-chrome.css')).toMatch(/@media \(width <= 768px\) \{\s*\.he-hdr\.is-logo-after \.he-hdr__toggle \{ order: -1; \}/);
  });
});
