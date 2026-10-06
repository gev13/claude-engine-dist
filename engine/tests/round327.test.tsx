import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { Footer } from '@/components/site/Footer';
import { blockSchemas } from '@/lib/blocks';
import { BODY } from '@/lib/blockStyle-css';
import { chromeSchema, resolveChrome } from '@/lib/chrome';
import { navigationSchema } from '@/lib/navigation';
import { LABEL_ROLES, TYPE_ROLES, themeSchema } from '@/lib/theme';
import { themeToCss } from '@/lib/theme-css';

/* 3.27 — round 8: pictures with their size, sliders in columns and their
   slides, the form's labels, fields and button, the footer's head column,
   stacked menus, text roles and phone layout, and the menus' last details.
   Every option is off, or as before, until chosen. */

vi.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => ({ push() {} }) }));

const styles = join(__dirname, '../src/styles');
const css = (file: string) => readFileSync(join(styles, file), 'utf8');
const theme = (value: unknown) => themeToCss(themeSchema.parse(value));

describe('D1 — an image block takes the picture’s stored size', () => {
  it('is rendered through a server wrapper that fills width and height from the library', () => {
    const renderer = readFileSync(join(__dirname, '../src/components/blocks/Renderer.tsx'), 'utf8');
    expect(renderer).toContain('image: ImageSource,');
    const wrapper = readFileSync(join(__dirname, '../src/components/blocks/ImageSource.tsx'), 'utf8');
    expect(wrapper).toContain('mediaShape(p.url)');
  });
});

describe('D2/D5 — sliders in columns, and their controls', () => {
  it('starts a slider at the column’s edge only with flush columns', () => {
    expect(theme({})).toBe('');
    expect(theme({ layout: { nestedFlush: true } })).toContain(':where(.he-nested) .he-car__viewport:not(.is-edge) .he-car__track{--pad:0px}');
  });
  it('keeps a block’s body type off the indicator, arrows and pause button', () => {
    expect(BODY).toContain('.he-ind *');
    expect(BODY).toContain('.he-arrows *');
    expect(BODY).toContain('.he-pause *');
  });
});

describe('D3/D4 — card slides', () => {
  const slides = [{ title: 'Alex', body: 'Lead' }, { title: 'Sam' }];
  it('takes padding per side, the title gap, the picture width and a bare picture box', () => {
    expect(blockSchemas.carousel.safeParse({ slides, slidePadding: '36px 20px 42px', slideTitleGap: '22px', slideImageWidth: '250px', slideImageBox: 'none' }).success).toBe(true);
    expect(blockSchemas.carousel.safeParse({ slides, slidePadding: '1px 2px 3px 4px 5px' }).success).toBe(false);
    expect(blockSchemas.carousel.safeParse({ slides, slidePadding: '20px;x' }).success).toBe(false);
    expect(css('library-blocks.css')).toContain('.he-car.has-title-gap .he-card__title');
  });
});

describe('D6 — the form', () => {
  it('keeps labels and the main button until told otherwise', () => {
    const parsed = blockSchemas.form.parse({ formName: 'Quote', fields: [{ id: 'name', type: 'text', label: 'Name' }] });
    expect(parsed.labels).toBeUndefined();
    expect(parsed.submitStyle).toBeUndefined();
  });
  it('sizes the fields from Appearance', () => {
    const out = theme({ fields: { height: '44px', radius: '8px', paddingInline: '16px', textareaHeight: '160px' } });
    expect(out).toContain('height:44px;padding-block:0');
    expect(out).toContain('border-radius:8px;padding-inline:16px');
    expect(out).toContain('textarea.he-fb__input{min-height:160px;height:160px}');
    expect(themeSchema.safeParse({ fields: { height: '44px;x' } }).success).toBe(false);
  });
});

describe('D7 — the footer', () => {
  const base = { siteName: 'Northwind', tagline: 'Built well', columns: [], social: [{ network: 'linkedin' as const, href: 'https://example.com/in' }] };
  it('keeps the footer as it was', () => {
    const f = resolveChrome(undefined).footer;
    expect(f.tagline).toBe(true);
    expect(f.socialPlace).toBe('below');
    expect(f.accordionMobile).toBe(true);
    expect(f.bottomAlignMobile).toBe('left');
    const html = renderToStaticMarkup(<Footer {...base} />);
    expect(html).toContain('he-ftr__socialrow');
    expect(html).not.toContain('he-ftr__stack');
  });
  it('puts the social links in the head column, stacks menus and opens lists', () => {
    const columns = [
      { id: 'a', title: 'Sitemap', items: [{ id: 'a1', label: 'Home', href: '/' }] },
      { id: 'b', title: 'Operations', items: [{ id: 'b1', label: 'CRM', href: '/crm' }] },
      { id: 'c', title: 'Consulting', stack: true, items: [{ id: 'c1', label: 'Audit', href: '/audit' }] },
    ];
    const html = renderToStaticMarkup(<Footer {...base} columns={columns} socialInHead openLists bottomCentred />);
    expect(html).not.toContain('he-ftr__socialrow');
    expect(html).toMatch(/he-ftr__lead.*he-ftr__social/);
    expect(html).toContain('--he-footer-cols:2');
    expect(html).toContain('he-ftr__stack');
    expect(html).toContain('he-ftr__col is-static');
    expect(html).toContain('is-open-lists');
    expect(html).toContain('is-bottom-centred');
    expect(navigationSchema.safeParse({ footer: columns }).success).toBe(true);
  });
  it('gives the footer two text roles that start empty', () => {
    expect(TYPE_ROLES).toContain('footerText');
    expect(LABEL_ROLES).toContain('footerSocial');
    expect(theme({ typography: { footerText: { base: { size: '14.8px', color: '#ffffff' } } } })).toContain('--he-footer-text-size:14.8px');
    expect(css('library.css')).toContain('font-size: var(--he-footer-text-size, 14px)');
  });
});

describe('D8 — the menus’ last details', () => {
  it('takes a dim colour and space above the phone list, checked as values', () => {
    expect(resolveChrome(undefined).mobileMenu.dimColor).toBeUndefined();
    expect(chromeSchema.safeParse({ mobileMenu: { dimColor: '#161519', onPhones: { variant: 'drawer', listTop: '48px' } } }).success).toBe(true);
    expect(chromeSchema.safeParse({ mobileMenu: { dimColor: 'red;x' } }).success).toBe(false);
    expect(chromeSchema.safeParse({ mobileMenu: { onPhones: { listTop: 'far' } } }).success).toBe(false);
  });
});
