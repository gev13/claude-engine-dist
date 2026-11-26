import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { blockSchemas } from '@/lib/blocks';
import { blogSchema } from '@/lib/blog';
import { blogCss } from '@/lib/blogCss';
import { careersCss, careersLookSchema, resolveCareersLook } from '@/lib/careersLook';
import { cardDate, setSiteDates } from '@/lib/dates';
import { FONT_CATALOGUE } from '@/lib/fontCatalogue';
import { headingSpaceCss } from '@/lib/headingSpace';
import { DEFAULT_PERMALINKS } from '@/lib/permalinks';
import { formatDate, siteSettingsSchema } from '@/lib/siteSettings';
import { BRAND_STACKS, FONT_STACKS, themeSchema } from '@/lib/theme';
import { themeToCss } from '@/lib/theme-css';
import { typeRule, typeStyleSchema, typeVars } from '@/lib/typeStyle';

/* 3.37 — posts: the careers advert and its form, the cover card beside a
   post, the post cards and a type style's face. Each off, and drawn as
   before, until set. */

vi.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => ({ push() {} }) }));
const { PostCollection } = await import('@/components/blocks/dynamic');
const { ApplicationForm } = await import('@/components/site/ApplicationForm');

const css = (file: string) => readFileSync(join(__dirname, '../src/styles', file), 'utf8');
const careers = (value: unknown) => careersCss(careersLookSchema.parse(value));
const post = (value: unknown) => blogCss(blogSchema.parse({ look: { post: value } }));
const posts = [0, 1, 2].map((i) => ({ id: `p${i}`, slug: `a${i}`, title: `Title ${i}`, excerpt: 'Words', kind: 'article', publishedAt: null, readingMinutes: 1, coverUrl: null, categoryName: null, categorySlug: null })) as never;
const cards = (card: Record<string, unknown>, variant: 'overlay' | 'list' | 'compact' = 'overlay') => renderToStaticMarkup(<PostCollection posts={posts} variant={variant} permalinks={DEFAULT_PERMALINKS} card={card as never} />);

describe('a type style’s face', () => {
  it('keeps the text’s and the headings’ faces as before', () => {
    expect(typeRule('.x', { font: 'body' })).toEqual(['.x{font-family:var(--he-body-family)}']);
    expect(typeRule('.x', { font: 'display' })).toEqual(['.x{font-family:var(--font-display)}']);
  });
  it('takes the system stack and any catalogue face, as its stack', () => {
    expect(typeRule('.x', typeStyleSchema.parse({ font: 'system' }))).toEqual([`.x{font-family:${BRAND_STACKS.system}}`]);
    const face = FONT_CATALOGUE[0]!;
    expect(typeVars('k', typeStyleSchema.parse({ font: face.key }))).toEqual({ '--he-k-font': FONT_STACKS[face.key] });
  });
  it('refuses a face the site does not have, and a value that would end the rule', () => {
    expect(typeStyleSchema.safeParse({ font: 'Comic Sans' }).success).toBe(false);
    expect(typeStyleSchema.safeParse({ font: 'body;}' }).success).toBe(false);
    expect(typeStyleSchema.safeParse({ font: 'constructor' }).success).toBe(false);
    expect(typeRule('.x', { font: 'nope;}' } as never)).toEqual([]);
  });
  it('reaches the careers cards’ kicker', () => {
    expect(careers({ kickerType: { font: 'system' } })).toContain(`.he-jobc__kicker{font-family:${BRAND_STACKS.system}}`);
  });
});

describe('the careers advert', () => {
  it('writes nothing new while unset', () => {
    expect(careersCss(undefined)).toBe('');
    expect(careers({})).toBe('');
    expect(resolveCareersLook(undefined)).toMatchObject({ dateSuffix: 'plain', applyArrow: false, applyFieldOrder: undefined });
  });
  it('spaces the heading: under the line above the title, under the title on phones, its inset there', () => {
    const out = careers({ eyebrowGap: '6px', titleGapMobile: '20px', headInsetMobile: '18px' });
    expect(out).toContain('.he-job :is(.he-job-c__head,section>.shell)>.he-eyebrow{margin-bottom:6px}');
    expect(out).toContain('@media (max-width:768px){.he-job-aside__title{margin-bottom:20px}.he-job-c__head{margin-bottom:20px}}');
    expect(out).toContain('@media (max-width:768px){.he-job-c__head{padding-inline:18px}.he-job-c__head .he-job-c__title{padding-inline:0}.he-job-aside__title{padding-inline:18px}}');
  });
  it('sizes the icons and splits the details’ gaps into rows and columns, on phones too', () => {
    const out = careers({ detailsGap: '16px', iconSize: '22px', iconGap: '6px', detailsRowGap: '12px', detailsColumnGapMobile: '36px', detailsInsetMobile: '20px' });
    expect(out).toContain('.he-job__icon{width:22px;height:22px}');
    expect(out).toContain('.he-job__meta.has-icons>div{gap:6px}');
    // After the shared gap, so the row gap wins over it.
    expect(out.indexOf('.he-job__meta{row-gap:12px}')).toBeGreaterThan(out.indexOf('.he-job__meta{gap:16px}'));
    expect(out).toContain('@media (max-width:768px){.he-job__meta{column-gap:36px;padding-inline:20px}}');
  });
  it('places the cover’s picture in its frame and fades over it, on phones apart', () => {
    const out = careers({ coverPlace: { width: '150%', height: '110%', left: '-10%' }, coverPlaceMobile: { top: '20%' }, coverOverlayMobile: '#123456 30%, rgba(0,0,0,0) 50%' });
    expect(out).toContain('.he-job-aside__cover .he-fill{inset:auto;left:-10%;top:0;width:150%;height:110%;max-width:none}');
    expect(out).toContain('@media (max-width:768px){.he-job-aside__cover .he-fill{inset:auto;left:0;top:20%;width:100%;height:100%;max-width:none}}');
    expect(out).toContain("@media (max-width:768px){.he-job-aside__cover::after{content:'';position:absolute;inset:0;pointer-events:none;background:linear-gradient(to bottom,#123456 30%, rgba(0,0,0,0) 50%)}}");
  });
  it('sets the dates side by side on phones, and the space above them there', () => {
    const out = careers({ datesGap: '30px', datesColumnsMobile: 2, datesGapMobile: '20px' });
    expect(out).toContain('.he-job__dates{margin-top:30px}');
    expect(out).toContain('@media (max-width:768px){.he-job__dates{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}}');
    expect(out).toContain('@media (max-width:768px){.he-job__dates{margin-top:20px}}');
  });
  it('moves the application card on phones, after the padding rule’s own margin', () => {
    const out = careers({ applyPaddingMobile: '20px', applyTopMobile: '20px', applyBleedMobile: '12px' });
    expect(out.indexOf('margin-inline:calc(-1 * 12px)')).toBeGreaterThan(out.indexOf('margin-inline:0'));
    expect(out).toContain('.he-job-aside__apply{margin-top:20px;margin-inline:calc(-1 * 12px)}');
  });
  it('draws the form’s details: no field shadow, the drop zone, the space above the button', () => {
    const out = careers({ applyFieldShadow: 'none', applyActionsGap: '30px', dropPadding: '20px 12px', dropGap: '12px', dropLabelGap: '6px', dropButton: 'standard' });
    expect(out).toContain('.he-job .he-fb__form .he-fb__input{box-shadow:none}');
    expect(out).toContain('.he-job .he-fb__form>.he-fb__actions{margin-top:30px}');
    expect(out).toContain('.he-apply__cv .he-fdrop{padding:20px 12px;gap:12px}');
    expect(out).toContain('.he-apply__cv>.he-fb__label{margin-bottom:6px}');
    expect(out).toContain('.he-apply__cv .he-fdrop__btn{padding:var(--he-btn-py) var(--he-btn-px);font-size:var(--he-btn-size)}');
    expect(careers({ dropButton: 'small' })).toBe('');
  });
  it('refuses what would break out of the style element', () => {
    for (const bad of [{ eyebrowGap: '8px;}' }, { coverPlace: { left: '0;}body{' } }, { coverOverlay: '#000 1%;}' }, { applyFieldOrder: ['name', 'name'] }, { applyFieldOrder: ['cv'] }, { datesColumnsMobile: 3 }, { applyBleedMobile: '-4px' }, { dropButton: 'big' }])
      expect(careersLookSchema.safeParse(bad).success, JSON.stringify(bad)).toBe(false);
    // And again where it is written.
    expect(careersCss({ coverPlace: { left: '0;}' }, iconSize: 'red', coverOverlay: 'x;}' } as never)).toBe('');
  });
  it('orders the form’s short fields, the rest following, and draws the site’s arrow on its button when asked', () => {
    const names = (html: string) => [...html.matchAll(/name="(name|email|phone)"/g)].map((m) => m[1]);
    expect(names(renderToStaticMarkup(<ApplicationForm jobId="j" jobTitle="J" />))).toEqual(['name', 'email', 'phone']);
    expect(names(renderToStaticMarkup(<ApplicationForm jobId="j" jobTitle="J" fieldOrder={['email']} />))).toEqual(['email', 'name', 'phone']);
    expect(names(renderToStaticMarkup(<ApplicationForm jobId="j" jobTitle="J" fieldOrder={['phone', 'email', 'name']} />))).toEqual(['phone', 'email', 'name']);
    const button = (html: string) => html.slice(html.indexOf('<button type="submit"'), html.indexOf('</button>', html.indexOf('<button type="submit"')));
    expect(button(renderToStaticMarkup(<ApplicationForm jobId="j" jobTitle="J" />))).not.toContain('<svg');
    expect(button(renderToStaticMarkup(<ApplicationForm jobId="j" jobTitle="J" arrow />))).toContain('<svg');
  });
  it('spaces the brackets of “how long ago” only when asked', () => {
    const page = readFileSync(join(__dirname, '../src/app/(site)/[locale]/careers/[slug]/page.tsx'), 'utf8');
    expect(page).toContain("look.dateSuffix === 'spaced' ? (\n      `( ${words} )`");
  });
});

describe('the cover card beside a post', () => {
  it('writes nothing new while unset', () => {
    expect(post({})).toBe('');
  });
  it('keeps one or two margins as the sides, and takes three or four as the whole box (a fix)', () => {
    expect(post({ asidePanelMargin: '10px' })).toBe('.he-post-aside-sec{margin-inline:10px}');
    expect(post({ asidePanelMargin: '10px 20px' })).toBe('.he-post-aside-sec{margin-inline:10px 20px}');
    expect(post({ asidePanelMargin: '10px 10px 0' })).toBe('.he-post-aside-sec{margin:10px 10px 0}');
    expect(post({ asidePanelMarginMobile: '0' })).toBe('@media (max-width:1024px){.he-post-aside-sec{margin:0}}');
  });
  it('spaces the stacked columns and the article where they stack', () => {
    const out = post({ asideGapMobile: '20px', asideBodyPaddingMobile: '0 12px', asideCardPadding: '30px', asideCardPaddingMobile: '20px' });
    expect(out).toContain('@media (max-width:1024px){.he-post-aside{gap:20px}}');
    expect(out).toContain('@media (max-width:1024px){.he-post-aside__body{padding:0 12px}}');
    expect(out).toContain('.he-post-aside__card{padding:30px}');
    expect(out).toContain('@media (max-width:1024px){.he-post-aside__card{padding:20px}}');
  });
  it('draws the excerpt and the date line in types of their own, and tints on phones apart', () => {
    const out = post({ asideLead: { size: '15px', color: 'rgba(0,0,0,.5)' }, asideMeta: { size: '12px' }, asideMetaGap: '10px', asideTintStopsMobile: 'rgba(0,0,0,0.2) 3%, #123456 90%' });
    expect(out).toContain('.he-post-aside__text>:is(h1,h2)+p:not(.he-post-aside__meta){font-size:15px;color:rgba(0,0,0,.5)}');
    expect(out).toContain('.he-post-aside__meta{font-size:12px}');
    expect(out).toContain('.he-post-aside__meta{gap:10px}');
    expect(out).toContain('@media (max-width:1024px){.he-post-aside__card::after{background:linear-gradient(to bottom,rgba(0,0,0,0.2) 3%, #123456 90%)}}');
  });
  it('gives the article’s first block no top margin, outside the layer the utility beat', () => {
    const sheet = css('library-blog.css');
    const layer = sheet.slice(sheet.indexOf('/* 3.29 — Cover card'), sheet.indexOf('/* 3.37 — outside the layer'));
    expect(layer).not.toContain('.he-post-aside__body > :first-child');
    expect(sheet.slice(sheet.indexOf('/* 3.37 — outside the layer'))).toMatch(/^[^@]*\n\.he-post-aside__body > :first-child \{ margin-top: 0; \}/);
  });
  it('keys its one text gap and its round dot to classes only those options write', () => {
    const sheet = css('library-blog.css');
    expect(sheet).toContain('.he-post-aside__text.has-tg { gap: var(--he-aside-tg); }');
    expect(sheet).toContain('.he-post-aside__dot {');
    const article = readFileSync(join(__dirname, '../src/components/site/blog/PostArticle.tsx'), 'utf8');
    expect(article).toContain("asideTextGap ? 'he-post-aside__text has-tg' : 'he-post-aside__text'");
    expect(article).toContain("look.asideMetaDot === 'dot' ? <span className=\"he-post-aside__dot\" aria-hidden=\"true\" /> : <span aria-hidden=\"true\">•</span>");
  });
  it('refuses what would break out of the style element', () => {
    for (const bad of [{ asidePanelMarginMobile: '0;}' }, { asideTextGap: 'x' }, { asideTintStopsMobile: '#000 1%);}' }, { asideMetaDot: 'star' }, { asideLead: { size: '1px;}' } }])
      expect(blogSchema.safeParse({ look: { post: bad } }).success, JSON.stringify(bad)).toBe(false);
    expect(blogCss({ look: { post: { asideGapMobile: '1px;}', asideTintStopsMobile: '#000 1%;}' } } } as never)).toBe('');
  });
});

describe('rich text on some tiers only', () => {
  it('hides an element carrying he-hide-<tier> on that tier alone, inside rich text', () => {
    const sheet = css('library-details.css');
    expect(sheet).toContain('@media (width > 90rem) { .prose-edge .he-hide-base { display: none; } }');
    expect(sheet).toContain('@media (64rem < width <= 90rem) { .prose-edge .he-hide-laptop { display: none; } }');
    expect(sheet).toContain('@media (48rem < width <= 64rem) { .prose-edge .he-hide-tablet { display: none; } }');
    expect(sheet).toContain('@media (width <= 48rem) { .prose-edge .he-hide-mobile { display: none; } }');
  });
});

describe('post cards', () => {
  it('draw as before while unset', () => {
    const html = cards({ reveal: true, tint: '#123456' });
    for (const added of ['has-tg', 'has-excerpt', 'has-stops', 'is-shown-', 'has-ibox', 'has-hs-m', '--he-plst-tg', '--he-plst-hi', '--he-plst-stops']) expect(html).not.toContain(added);
  });
  it('space the words’ parts and cut the excerpt, in every layout', () => {
    const html = cards({ textGap: '12px', textGapMobile: '10px', excerptLines: 2, excerptWidth: '280px' }, 'list');
    expect(html).toContain('has-tg has-tg-m has-excerpt-lines has-excerpt-w');
    expect(html).toContain('--he-plst-tg:12px;--he-plst-tg-m:10px;--he-plst-el:2;--he-plst-ew:280px');
    const sheet = css('library-details.css');
    expect(sheet).toContain('.he-plst.has-tg .he-plst__text { gap: var(--he-plst-tg); }');
    expect(sheet).toContain('-webkit-line-clamp: var(--he-plst-el)');
  });
  it('keep the heading floor’s sum with their own gap, on phones too', () => {
    expect(headingSpaceCss({ min: '20px', at: ['base'] })).toContain('.he-plst.has-tg .he-plst__text>.he-plst__title:has(+ .he-plst__excerpt){margin-bottom:max(0px,calc(20px - var(--he-plst-tg)))}');
    expect(headingSpaceCss({ min: '20px', at: ['base'] })).not.toContain('has-tg-m');
    const phone = headingSpaceCss({ min: '20px', at: ['mobile'] });
    expect(phone.indexOf('.he-plst.has-tg-m')).toBeGreaterThan(phone.indexOf('.he-plst.has-tg '));
    // The compact layout's own 4px gives way to the set gap: it is written after it.
    expect(phone.indexOf('.he-plst.has-tg ')).toBeGreaterThan(phone.indexOf('.he-plst.is-compact'));
    expect(headingSpaceCss({ min: '20px', at: ['base'] })).toContain('.he-post-aside__text.has-tg>:is(h1,h2,h3,h4,h5,h6):has(+ p){margin-bottom:max(0px,calc(20px - var(--he-aside-tg)))}');
  });
  it('tint the overlay cards from stops, place their picture, and give each its own height on phones', () => {
    const html = cards({ tintStops: 'rgba(0,0,0,0.2) 30%, #123456 90%', imageBox: { width: '400px', height: '500px' }, imageBoxMobile: { width: '100%' }, heightsMobile: ['400px', '500px'] });
    expect(html).toContain('has-stops has-ibox has-ibox-m has-hs-m');
    expect(html).toContain('--he-plst-stops:rgba(0,0,0,0.2) 30%, #123456 90%');
    expect(html).toContain('--he-plst-iw:400px;--he-plst-ih:500px;--he-plst-iw-m:100%');
    const heights = [...html.matchAll(/--he-plst-hi:(\d+px)/g)].map((m) => m[1]);
    expect(heights).toEqual(['400px', '500px', '500px']);
    // Not the layouts without a picture behind the words.
    expect(cards({ tintStops: 'rgba(0,0,0,0.2) 30%, #123456 90%', imageBox: { width: '1px' }, heightsMobile: ['1px'] }, 'list')).not.toMatch(/has-stops|has-ibox|--he-plst-hi/);
  });
  it('show the revealed words at rest on the tiers not listed', () => {
    expect(cards({ reveal: true, revealAt: ['base', 'laptop', 'tablet'] })).toContain('is-reveal is-shown-mobile');
    expect(cards({ reveal: true, revealAt: ['base'] })).toContain('is-shown-laptop is-shown-tablet is-shown-mobile');
    expect(cards({ revealAt: ['base'] })).not.toContain('is-shown-');
    const sheet = css('library-details.css');
    expect(sheet).toContain('@media (hover: hover) and (width <= 48rem) {\n    .he-plst.is-reveal.is-shown-mobile .he-plst__link::after');
  });
  it('are one option set for the post list block and the blog’s own cards', () => {
    const card = { textGap: '12px', excerptLines: 3, tintStops: 'rgba(0,0,0,0.2) 30%, #000 90%', revealAt: ['mobile'], imageBox: { height: '50%' }, heightsMobile: ['1px'] };
    expect(blogSchema.safeParse({ card }).success).toBe(true);
    expect(blockSchemas.postList.safeParse({ card }).success).toBe(true);
  });
  it('refuse what would break out of the style attribute or the style element', () => {
    for (const bad of [{ textGap: '1px;}' }, { excerptLines: 7 }, { tintStops: 'red 1%, blue 2%;}' }, { revealAt: ['desk'] }, { revealAt: ['base', 'base'] }, { imageBox: { width: '1px;}' } }, { heightsMobile: ['1px', 'x'] }, { heightsMobile: [] }])
      expect(blogSchema.safeParse({ card: bad }).success, JSON.stringify(bad)).toBe(false);
    // Checked again where the attribute is written.
    expect(cards({ textGap: '1px;}', tintStops: '#000 1%;}', heightsMobile: ['x;'], imageBox: { width: 'x' } })).not.toMatch(/has-tg|has-stops|has-hs-m|has-ibox/);
  });
});

describe('the date on cards and posts', () => {
  it('takes the short month, day first or month first, from Settings', () => {
    const day = new Date('2026-09-09T12:00:00Z');
    expect(formatDate(day, { dateFormat: 'MMM d, yyyy', timeZone: 'UTC' })).toBe('Sep 9, 2026');
    expect(formatDate(day, { dateFormat: 'd MMM yyyy', timeZone: 'UTC' })).toBe('9 Sept 2026');
    setSiteDates('MMM d, yyyy', 'UTC');
    expect(cardDate(day)).toBe('Sep 9, 2026');
    setSiteDates(undefined, undefined);
    expect(cardDate(day)).toBe('09 Sept 2026');
    expect(siteSettingsSchema.shape.dateFormat.safeParse('MMM d;}').success).toBe(false);
  });
});

describe('the theme', () => {
  it('carries the new options through the theme schema to its CSS', () => {
    const out = themeToCss(themeSchema.parse({ careers: { iconSize: '22px' }, blog: { look: { post: { asideGapMobile: '20px' } } } }));
    expect(out).toContain('.he-job__icon{width:22px;height:22px}');
    expect(out).toContain('@media (max-width:1024px){.he-post-aside{gap:20px}}');
  });
});
