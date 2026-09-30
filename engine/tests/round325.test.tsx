import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { blockSchemas } from '@/lib/blocks';
import { chromeSchema, resolveChrome } from '@/lib/chrome';
import { navigationSchema } from '@/lib/navigation';

/* 3.25 — round 6: the project card's line inside its card, card sliders
   without a link line and with bare arrows, the menu column's page and
   contact row, the phone drawer's details and a Phone menu in Menus. Every
   option is off, or as before, until chosen. */

const styles = join(__dirname, '../src/styles');
const css = (file: string) => readFileSync(join(styles, file), 'utf8');

describe('B7 — the project card’s line stays inside its card', () => {
  it('lays a card with a line out as one column, the link at its own height', () => {
    const showcase = css('library-showcase.css');
    expect(showcase).toContain('.he-proj__item:has(> .he-proj__line) { display: flex; flex-direction: column; }');
    expect(showcase).toContain('.he-proj__item:has(> .he-proj__line) > .he-proj__link { flex: 0 0 auto; height: auto; }');
    expect(showcase).toContain('.he-proj__line { position: relative; margin-top: 0.4rem;');
  });
});

describe('N11 — card sliders', () => {
  const slides = [{ title: 'One', href: '/one' }, { title: 'Two' }];
  it('keeps the link line and the circled arrows until told otherwise', () => {
    const parsed = blockSchemas.carousel.parse({ slides });
    expect(parsed.slideMore).toBeUndefined();
    expect(parsed.arrowStyle).toBeUndefined();
  });
  it('takes the link line off and bare arrows at a size', () => {
    expect(blockSchemas.carousel.safeParse({ slides, slideMore: false, arrowStyle: 'plain', arrowSize: 24 }).success).toBe(true);
    expect(blockSchemas.carousel.safeParse({ slides, arrowSize: 200 }).success).toBe(false);
    expect(css('library-blocks.css')).toContain('.he-arrows.is-plain .he-arrow');
  });
});

describe('N12/N13 — the menus', () => {
  it('keeps the column, the contact row and the phone menu as they were', () => {
    const m = resolveChrome(undefined).mobileMenu;
    expect(m.dim).toBeUndefined();
    expect(m.columnPanel).toBe('panel');
    expect(m.contactEmphasis).toBe('value');
    expect(m.socialLook).toBe('circle');
    const phones = resolveChrome({ mobileMenu: { onPhones: { variant: 'drawer' } } } as never).mobileMenu.onPhones!;
    expect(phones.logo).toBe(true);
    expect(phones.dividers).toBe(true);
    expect(phones.expandIcon).toBe('chevron');
  });

  it('checks the new values', () => {
    expect(chromeSchema.safeParse({ mobileMenu: { dim: 85, columnPanel: 'none', contactEmphasis: 'title', socialLook: 'plain' } }).success).toBe(true);
    expect(chromeSchema.safeParse({ mobileMenu: { dim: 120 } }).success).toBe(false);
    expect(chromeSchema.safeParse({ mobileMenu: { onPhones: { variant: 'drawer', source: 'phone', logo: false, dividers: false, expandIcon: 'plus' } } }).success).toBe(true);
  });

  it('has a Phone menu in Menus, left out until one is saved', () => {
    expect(navigationSchema.safeParse({ phone: [{ id: 'p1', label: 'Projects', href: '/projects' }] }).success).toBe(true);
    expect(navigationSchema.parse({}).phone).toBeUndefined();
  });
});
