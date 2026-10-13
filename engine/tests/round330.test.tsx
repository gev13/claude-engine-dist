import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { CardGridVariant, MediaBand, StatsFigures } from '@/components/blocks/library/content';
import { blockSchemas } from '@/lib/blocks';
import { careersCss, careersLookSchema, resolveCareersLook } from '@/lib/careersLook';
import { chromeSchema } from '@/lib/chrome';
import { chromeCss } from '@/lib/chromeCss';
import { cookieNoticeSchema } from '@/lib/cookies';
import { themeSchema } from '@/lib/theme';
import { richTextCss, themeToCss } from '@/lib/theme-css';

/* 3.30 — the options a brand site still needed to match its design without
   custom CSS. Every one is off, and draws what it drew before, until set. */

vi.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => ({ push() {} }) }));

const theme = (value: unknown) => themeToCss(themeSchema.parse(value));
const css = (file: string) => readFileSync(join(__dirname, '../src/styles', file), 'utf8');

describe('careers type', () => {
  it('writes nothing until a value is set', () => {
    expect(careersCss(undefined)).toBe('');
    expect(careersCss({ list: 'cards', page: 'aside' })).toBe('');
    expect(theme({ careers: { list: 'cards' } })).toBe('');
    expect(resolveCareersLook(undefined)).not.toHaveProperty('cardTitle');
  });
  it('gives a role’s title and the advert’s headings a face, size and colour of their own', () => {
    const out = careersCss(
      careersLookSchema.parse({
        cardTitle: { font: 'body', size: '26px', weight: '400', color: 'rgba(10,20,30,0.9)' },
        headings: { font: 'body', size: '26px', sizeMobile: '22px', line: '1.1', tracking: '-0.2px' },
      }),
    );
    expect(out).toContain(':is(.he-jobc__title,.he-job-card__title){font-family:var(--he-body-family);font-size:26px;font-weight:400;color:rgba(10,20,30,0.9)}');
    // A colour of its own still lights up under the pointer.
    expect(out).toContain('.he-jobc:hover .he-jobc__title{color:var(--color-flare)}');
    expect(out).toContain('.he-job__section>h2{font-family:var(--he-body-family);font-size:26px;line-height:1.1;letter-spacing:-0.2px}');
    expect(out).toContain('@media (max-width:768px){.he-job__section>h2{font-size:22px}}');
  });
  it('puts space under the application form’s heading, in both layouts', () => {
    expect(careersCss(careersLookSchema.parse({ applyGap: '32px' }))).toBe('.he-job__applytitle{margin-bottom:32px}');
    const page = readFileSync(join(__dirname, '../src/app/(site)/[locale]/careers/[slug]/page.tsx'), 'utf8');
    expect(page.match(/he-job__applytitle/g)).toHaveLength(2);
  });
  it('refuses a value that could break out of the style element', () => {
    expect(careersLookSchema.safeParse({ cardTitle: { color: 'red;}body{' } }).success).toBe(false);
    expect(careersLookSchema.safeParse({ headings: { size: '26px}' } }).success).toBe(false);
    expect(careersLookSchema.safeParse({ applyGap: 'calc(1px)' }).success).toBe(false);
    // And drops one that reached it anyway.
    expect(careersCss({ cardTitle: { color: 'red;}' } } as never)).toBe('');
  });
});

describe('stats figures: the numbers’ weight and colour', () => {
  const figures = (extra: Record<string, unknown> = {}) =>
    renderToStaticMarkup(<StatsFigures {...blockSchemas.stats.parse({ variant: 'figures', items: [{ value: '15', label: 'Years' }], ...extra })} />);
  it('draws as before when unset', () => {
    const html = figures();
    expect(html).not.toContain('--he-figs-weight');
    expect(html).not.toContain('has-value-color');
    expect(css('library-content.css')).toContain('font-weight: var(--he-figs-weight, 700)');
  });
  it('carries a weight and a colour of their own', () => {
    const html = figures({ valueWeight: '400', valueColor: '#123456' });
    expect(html).toContain('--he-figs-weight:400');
    expect(html).toContain('--he-figs-color:#123456');
    expect(html).toContain('has-value-color');
  });
  it('takes only real weights and colours', () => {
    expect(blockSchemas.stats.safeParse({ variant: 'figures', valueWeight: '450', items: [] }).success).toBe(false);
    expect(blockSchemas.stats.safeParse({ variant: 'figures', valueColor: 'red;}', items: [] }).success).toBe(false);
  });
});

describe('cookie notice: the button’s colours', () => {
  it('takes colours and refuses anything else', () => {
    expect(cookieNoticeSchema.parse({ buttonBackground: '#ffffff', buttonText: '#123456', buttonHoverBackground: 'rgba(255,255,255,0.8)' })).toMatchObject({ buttonBackground: '#ffffff' });
    expect(cookieNoticeSchema.safeParse({ buttonText: 'red;}' }).success).toBe(false);
    expect(cookieNoticeSchema.parse({})).not.toHaveProperty('buttonBackground');
  });
  it('reaches the filled button only when set', () => {
    const sheet = css('library-careers.css');
    expect(sheet).toContain(".he-cookie[style*='--he-cookie-btn-bg'] .he-btn--primary { background-color: var(--he-cookie-btn-bg); }");
    expect(sheet).toContain(".he-cookie[style*='--he-cookie-btn-text'] .he-btn--primary { color: var(--he-cookie-btn-text); }");
    const notice = readFileSync(join(__dirname, '../src/components/site/CookieNotice.tsx'), 'utf8');
    expect(notice).toContain("'--he-cookie-btn-bg'");
  });
});

describe('the classic header’s links at the right', () => {
  it('stays centred until asked', () => {
    expect(chromeCss(chromeSchema.parse({ header: { variant: 'classic' } }))).not.toContain('justify-self');
  });
  it('moves them beside the buttons on the classic header only', () => {
    expect(chromeCss(chromeSchema.parse({ header: { navPlace: 'end' } }))).toContain('.he-hdr--classic .he-hdr__nav{justify-self:end}');
    expect(chromeCss(chromeSchema.parse({ header: { variant: 'pill', navPlace: 'end' } }))).not.toContain('justify-self');
    expect(chromeSchema.safeParse({ header: { navPlace: 'left' } }).success).toBe(false);
  });
});

describe('card grid: where the words sit on tablets and phones', () => {
  const grid = (card: Record<string, unknown>) =>
    renderToStaticMarkup(<CardGridVariant {...blockSchemas.cardGrid.parse({ variant: 'overlay', cards: [{ title: 'Northwind', ...card }] })} />);
  it('adds no class until set', () => {
    expect(grid({ textPlace: 'right' })).not.toMatch(/is-text-[tm]-/);
  });
  it('marks each tier’s place', () => {
    const html = grid({ textPlace: 'right', textPlaceTablet: 'left', textPlaceMobile: 'bottom' });
    expect(html).toContain('is-text-right');
    expect(html).toContain('is-text-t-left');
    expect(html).toContain('is-text-m-bottom');
  });
  it('has a rule for every place on both tiers, and refuses others', () => {
    const sheet = css('library-variants.css');
    for (const tier of ['t', 'm']) for (const place of ['bottom', 'top', 'center']) expect(sheet).toContain(`.he-ocard.is-text-${tier}-${place} {`);
    expect(blockSchemas.cardGrid.safeParse({ variant: 'overlay', cards: [{ title: 'x', textPlaceMobile: 'middle' }] }).success).toBe(false);
  });
});

describe('media band: the text centred on phones', () => {
  const band = (extra: Record<string, unknown> = {}) =>
    renderToStaticMarkup(<MediaBand {...blockSchemas.mediaBand.parse({ position: 'center', title: 'Northwind', ...extra })} />);
  it('goes bottom left on phones, as before, until set', () => {
    expect(band()).not.toContain('is-m-');
    expect(band({ positionMobile: 'bottomLeft' })).not.toContain('is-m-');
  });
  it('centres it at the bottom or in the middle', () => {
    expect(band({ positionMobile: 'center' })).toContain('is-m-center');
    expect(band({ positionMobile: 'bottomCenter' })).toContain('is-m-bottomCenter');
    expect(css('library-content.css')).toContain('.he-band.is-m-center .he-band__inner { align-items: center; justify-content: center; text-align: center; }');
  });
});

describe('rich text: the headings’ own type', () => {
  it('writes nothing for an untouched theme', () => {
    expect(richTextCss(undefined)).toBe('');
    expect(richTextCss({})).toBe('');
  });
  it('sets the face, size, weight and colour apart from the h2 role, after the scale', () => {
    const out = richTextCss(themeSchema.parse({ richText: { headingScale: 0.5, headingFont: 'body', headingSize: '26px', headingWeight: '400', headingColor: 'rgba(10,20,30,0.8)' } }).richText);
    const own = '.prose-edge :is(h2,h3){font-family:var(--he-body-family);font-size:26px;font-weight:400;color:rgba(10,20,30,0.8)}';
    expect(out).toContain(own);
    expect(out.indexOf(own)).toBeGreaterThan(out.indexOf('.prose-edge h2{font-size:calc'));
  });
  it('refuses a colour that is not one', () => {
    expect(themeSchema.safeParse({ richText: { headingColor: 'red;}' } }).success).toBe(false);
    expect(themeSchema.safeParse({ richText: { headingFont: 'serif' } }).success).toBe(false);
  });
});
