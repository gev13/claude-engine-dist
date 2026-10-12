import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { Footer } from '@/components/site/Footer';
import { LanguageSwitcher } from '@/components/site/LanguageSwitcher';
import { blockSchemas } from '@/lib/blocks';
import { blockStyleSchema } from '@/lib/blockStyle';
import { blockStyleToCss } from '@/lib/blockStyle-css';
import { JOB_META } from '@/lib/careers';
import { resolveCareersLook } from '@/lib/careersLook';
import { chromeSchema, resolveChrome } from '@/lib/chrome';
import { validateAnswers, type FormField } from '@/lib/forms';
import { MESSAGES } from '@/lib/messages';
import { formatAmount } from '@/lib/relativeDate';
import { leafClip, leafRadii } from '@/lib/shape';
import { themeSchema } from '@/lib/theme';
import { themeToCss } from '@/lib/theme-css';

/* 3.29 — what a design with rounded corners on two sides, three languages,
   a careers section and a footer wordmark needed. Every option is off, or as
   before, until chosen. */

vi.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => ({ push() {} }) }));

const theme = (value: unknown) => themeToCss(themeSchema.parse(value));

describe('corners rounded on chosen corners only (leaf)', () => {
  it('writes the radii in border-radius order, top right and bottom left by default', () => {
    expect(leafRadii({ style: 'leaf', size: 48 }, 20)).toBe('0px 48px 0px 48px');
    expect(leafRadii({ style: 'leaf', corners: ['tl', 'br'] }, 30)).toBe('30px 0px 30px 0px');
    expect(leafRadii({ style: 'cut', size: 48 }, 20)).toBeNull();
    expect(leafRadii(undefined, 20)).toBeNull();
    expect(leafClip('0px 48px 0px 48px')).toBe('inset(0 round 0px 48px 0px 48px)');
  });
  it('reaches cards through their variables, and buttons, fields and panels directly', () => {
    const css = theme({ shape: { cards: { style: 'leaf', size: 40 }, buttons: { style: 'leaf', size: 14 } }, panel: { shape: { style: 'leaf', size: 80 } } });
    expect(css).toContain('--he-card-radius:0px 40px 0px 40px');
    expect(css).toContain('--he-card-clip:inset(0 round 0px 40px 0px 40px)');
    expect(css).toContain('border-radius:0px 14px 0px 14px');
    expect(css).toContain('--he-panel-clip:inset(0 round 0px 80px 0px 80px)');
  });
  it('adds nothing to an untouched theme or a rounded shape', () => {
    expect(theme({})).toBe('');
    expect(theme({ shape: { cards: { style: 'rounded' } } })).toBe('');
  });
  it('clips a section and a card of their own', () => {
    expect(blockStyleToCss('b1', blockStyleSchema.parse({ corners: { style: 'leaf', size: 60 } }))).toContain('clip-path:inset(0 round 0px 60px 0px 60px)');
  });
  it('refuses a radius past its cap', () => {
    expect(themeSchema.safeParse({ shape: { cards: { style: 'leaf', size: 201 } } }).success).toBe(false);
  });
});

describe('the language switcher in a row', () => {
  it('stays the menu it was until asked', () => {
    expect(resolveChrome(undefined).languages).toMatchObject({ look: 'menu', inMenu: false, inFooter: 'off' });
    const html = renderToStaticMarkup(<LanguageSwitcher locales={['en', 'ru']} current="en" defaultLocale="en" />);
    expect(html).toContain('he-lang he-keep');
  });
  it('draws the codes in the chosen order and labels, the current one marked', () => {
    const look = resolveChrome(chromeSchema.parse({ languages: { look: 'inline', labels: { ru: 'РУ' }, order: ['ru', 'en'] } })).languages;
    const html = renderToStaticMarkup(<LanguageSwitcher locales={['en', 'ru']} current="en" defaultLocale="en" look={look} />);
    expect(html.indexOf('РУ')).toBeLessThan(html.indexOf('>EN<'));
    expect(html).toMatch(/aria-current="true"[^>]*>EN</);
  });
  it('refuses a label longer than a short code', () => {
    expect(chromeSchema.safeParse({ languages: { labels: { ru: 'Русский язык и ещё' } } }).success).toBe(false);
  });
});

describe('the footer’s sign-up, middle column and wordmark', () => {
  const base = { siteName: 'Northwind', columns: [], social: [] };
  it('renders as before with nothing chosen', () => {
    const html = renderToStaticMarkup(<Footer {...base} />);
    expect(html).not.toContain('he-ftr__wm');
    expect(html).not.toContain('he-ftr__nl');
    expect(html).toContain('he-ftr__bottom');
    expect(resolveChrome(undefined).footer).toMatchObject({ newsletter: false, wordmark: 'off', bottomRow: true, linksFirstMobile: false, linksRowMobile: false });
  });
  it('draws the name as a wordmark sized to its letters, and can leave the bottom row out', () => {
    const html = renderToStaticMarkup(<Footer {...base} bottomRow={false} wordmark={{ crop: 45, align: 'center' }} />);
    expect(html).toContain('he-ftr__wmname');
    expect(html).toContain('--he-wm-chars:9');
    expect(html).not.toContain('he-ftr__bottom');
  });
});

describe('careers', () => {
  it('draws the pages as before until a look is chosen', () => {
    expect(resolveCareersLook(undefined)).toMatchObject({ list: 'rows', page: 'standard', icons: false, form: 'labels', dropZone: false, doneButtons: false });
  });
  it('has a translatable word for every detail it shows', () => {
    for (const [key, label] of JOB_META) expect(MESSAGES[`careers.meta.${key}` as keyof typeof MESSAGES]).toBe(label);
  });
  it('counts a deadline in days, up to two months', () => {
    const now = new Date('2026-10-12T10:00:00Z');
    expect(formatAmount(new Date('2026-10-24T10:00:00Z'), 'en', now)).toBe('12 days');
    expect(formatAmount(new Date('2026-10-01T10:00:00Z'), 'en', now)).toBe('');
  });
  it('writes no English into the components that a visitor reads', () => {
    const form = readFileSync(join(__dirname, '../src/components/site/ApplicationForm.tsx'), 'utf8');
    expect(form).not.toContain('Send application');
    expect(form).not.toContain('he-btn--primary');
  });
});

describe('forms', () => {
  const fields = [{ id: 'name', type: 'text', label: 'Name', required: true, width: 'full', options: [] }] as unknown as FormField[];
  it('names the question that failed', () => {
    expect(validateAnswers(fields, {})).toMatchObject({ ok: false, field: 'name' });
  });
  it('takes buttons after the thanks, #again among them, and nothing unsafe', () => {
    const form = (successButtons: unknown) => blockSchemas.form.safeParse({ formName: 'Contact', fields: [{ id: 'name', type: 'text', label: 'Name' }], successButtons }).success;
    expect(form([{ label: 'Send another', href: '#again' }, { label: 'Home', href: '/' }])).toBe(true);
    expect(form([{ label: 'x', href: 'javascript:alert(1)' }])).toBe(false);
  });
});

describe('blocks', () => {
  it('lets a card take a twelfths span and up to three rows, no more', () => {
    const grid = (card: Record<string, unknown>) => blockSchemas.cardGrid.safeParse({ variant: 'overlay', cards: [{ title: 'x', ...card }] }).success;
    expect(grid({ span: 8, rowSpan: 2, textPlace: 'right', imagePosition: 'top left' })).toBe(true);
    expect(grid({ span: 13 })).toBe(false);
    expect(grid({ rowSpan: 4 })).toBe(false);
  });
  it('has a portrait team with a show-all, and figures as staggered cards', () => {
    expect(blockSchemas.team.safeParse({ variant: 'portrait', initial: 3, members: [{ name: 'A' }] }).success).toBe(true);
    expect(blockSchemas.stats.safeParse({ variant: 'figures', cards: true, labelFirst: true, stagger: '40px', items: [] }).success).toBe(true);
    expect(blockSchemas.stats.safeParse({ variant: 'figures', stagger: 'calc(1px)', items: [] }).success).toBe(false);
  });
  it('keeps a frosted panel’s colour a colour', () => {
    expect(blockSchemas.mediaBand.safeParse({ textPanel: 'glass', panelColor: 'red;}' }).success).toBe(false);
  });
  it('lets a block slide at every width', () => {
    const css = blockStyleToCss('b2', blockStyleSchema.parse({ swipeOn: 'always' }));
    expect(css).toContain('@media (max-width:100000px)');
    expect(css).toContain('scroll-snap-type:x mandatory');
  });
});
