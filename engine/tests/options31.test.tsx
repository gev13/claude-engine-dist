import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Footer } from '@/components/site/Footer';
import { Actions } from '@/components/blocks/library/content';
import { LibraryHero } from '@/components/blocks/library/heroes';
import { blockSchemas } from '@/lib/blocks';
import { chromeSchema, resolveChrome } from '@/lib/chrome';
import { themeSchema } from '@/lib/theme';
import { themeToCss } from '@/lib/theme-css';

/* 3.1 — four options found building a site from a design: the uploaded
   logo and a panel for the footer, a split hero whose picture runs to the
   section's edges, an arrow per button, and no lines between sections.
   Each is nothing until chosen. */

const footer = (extra: Partial<Parameters<typeof Footer>[0]> = {}) =>
  renderToStaticMarkup(<Footer siteName="Northfold" columns={[]} social={[]} {...extra} />);

describe('the footer', () => {
  it('keeps the mark and the name, and no panel, until told otherwise', () => {
    expect(resolveChrome(undefined).footer).toMatchObject({ logo: 'mark', panel: false });
    const html = footer();
    expect(html).toContain('he-ftr__mark');
    expect(html).not.toContain('is-panel');
  });

  it('shows the uploaded logo, at its own height, when chosen', () => {
    const html = footer({ logo: { kind: 'image', url: '/media/logo.svg', height: 48 } });
    expect(html).toMatch(/<img[^>]*src="\/media\/logo\.svg"[^>]*alt="Northfold"/);
    expect(html).toContain('--he-ftr-logo-h:48px');
    expect(html).not.toContain('he-ftr__mark');
  });

  it('can show nothing at its head, and can be a panel', () => {
    expect(footer({ logo: { kind: 'none' } })).not.toContain('he-ftr__brand');
    expect(footer({ panel: true })).toContain('is-panel');
  });

  it('takes only the choices it knows', () => {
    expect(chromeSchema.safeParse({ footer: { logo: 'banner' } }).success).toBe(false);
    expect(chromeSchema.safeParse({ footer: { logoHeight: 500 } }).success).toBe(false);
    expect(chromeSchema.safeParse({ footer: { logo: 'image', logoHeight: 48, panel: true } }).success).toBe(true);
  });
});

describe('the split hero, to the edges', () => {
  const hero = (extra: object) =>
    renderToStaticMarkup(<LibraryHero {...blockSchemas.hero.parse({ variant: 'split', title: 'T', imageUrl: '/media/a.webp', ...extra })} />);

  it('is the framed visual until chosen', () => {
    expect(blockSchemas.hero.parse({ title: 'T' }).bleed).toBeUndefined();
    expect(hero({})).not.toContain('is-bleed');
  });

  it('runs to the edges, at the height chosen', () => {
    expect(hero({ bleed: true, height: 'screen' })).toMatch(/he-hero--split[^"]*is-bleed[^"]*is-h-screen/);
  });
});

describe('an arrow per button', () => {
  it('draws one only where asked', () => {
    const plain = renderToStaticMarkup(<Actions links={[{ label: 'Go', href: '/contact' }]} />);
    const arrow = renderToStaticMarkup(<Actions links={[{ label: 'Go', href: '/contact', arrow: true }]} />);
    expect(plain).not.toContain('<svg');
    expect(arrow).toContain('<svg');
  });

  it('is stored only when chosen, on the older links and the library ones', () => {
    expect(blockSchemas.cta.parse({ title: 'T', links: [{ label: 'A', href: '/a' }] }).links[0]).not.toHaveProperty('arrow');
    expect(blockSchemas.cta.parse({ title: 'T', links: [{ label: 'A', href: '/a', arrow: false }] }).links[0]!.arrow).toBe(false);
    expect(blockSchemas.mediaBand.parse({ links: [{ label: 'A', href: '/a', arrow: true }] }).links[0]!.arrow).toBe(true);
  });
});

describe('lines between sections', () => {
  it('stay unless switched off', () => {
    expect(themeToCss(themeSchema.parse({}))).not.toContain('border-bottom-width:0');
    expect(themeToCss(themeSchema.parse({ layout: { sectionRules: true } }))).not.toContain('border-bottom-width:0');
    const off = themeToCss(themeSchema.parse({ layout: { sectionRules: false } }));
    expect(off).toContain('#main>*,#main>[class*="he-b-"]>*,.he-ftr{border-bottom-width:0}');
    expect(off).toContain('.he-ftr{border-top-width:0}');
  });
});

describe('the width of section headings', () => {
  it('is each block’s own until set', () => {
    expect(themeToCss(themeSchema.parse({}))).not.toContain('--he-title-measure');
    expect(themeToCss(themeSchema.parse({ layout: { titleWidth: '820px' } }))).toContain('--he-title-measure:820px');
    expect(themeSchema.safeParse({ layout: { titleWidth: 'wide' } }).success).toBe(false);
  });
});

describe('the width of an edge-to-edge picture (3.3.2)', () => {
  const hero = (extra: object) =>
    renderToStaticMarkup(<LibraryHero {...blockSchemas.hero.parse({ variant: 'split', title: 'T', imageUrl: '/media/a.webp', bleed: true, ...extra })} />);
  it('is the drawn 72% until set, and only takes 30–90', () => {
    expect(hero({})).not.toContain('--he-bleed-w');
    expect(hero({ bleedWidth: 55 })).toContain('--he-bleed-w:55%');
    expect(blockSchemas.hero.safeParse({ title: 'T', bleedWidth: 95 }).success).toBe(false);
  });
});

describe('the edge-to-edge picture’s fit and the hero’s least height (3.3.3)', () => {
  const hero = (extra: object) =>
    renderToStaticMarkup(<LibraryHero {...blockSchemas.hero.parse({ variant: 'split', title: 'T', imageUrl: '/media/a.webp', bleed: true, ...extra })} />);
  it('fill the box and follow Height until set', () => {
    const html = hero({});
    expect(html).not.toContain('is-fit-contain');
    expect(html).not.toContain('min-height');
  });
  it('show the whole picture and hold the height when chosen', () => {
    const html = hero({ bleedFit: 'contain', bleedMinHeight: '640px' });
    expect(html).toContain('is-fit-contain');
    expect(html).toContain('min-height:640px');
    expect(blockSchemas.hero.safeParse({ title: 'T', bleedMinHeight: '640 px;' }).success).toBe(false);
  });
});
