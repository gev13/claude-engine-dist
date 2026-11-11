import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { blockSchemas } from '@/lib/blocks';
import { blogSchema, resolveBlog } from '@/lib/blog';
import { JOB_META } from '@/lib/careers';
import { DETAIL_KEYS, careersCss, careersLookSchema, orderDetails, resolveCareersLook } from '@/lib/careersLook';
import { chromeSchema, resolveChrome } from '@/lib/chrome';
import { chromeCss } from '@/lib/chromeCss';

/* 3.33.1 — the last details: each off, and drawn as before, until set. */

const css = (value: unknown) => chromeCss(chromeSchema.parse(value));
const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');

describe('the blog index’s category bar', () => {
  it('stays until switched off', () => {
    expect(resolveBlog(undefined).indexBar).toBe(true);
    expect(resolveBlog(blogSchema.parse({ indexBar: false })).indexBar).toBe(false);
  });
  it('is read in both of the index’s layouts', () => {
    expect(read('src/components/site/blog/BlogViews.tsx').match(/blog\.indexBar/g)).toHaveLength(2);
  });
});

describe('the full-screen menu’s links', () => {
  it('write nothing until set', () => expect(css({ mobileMenu: {} })).toBe(''));
  it('take a face and capitals, outbidding the centred menu’s own', () => {
    const out = css({ mobileMenu: { itemFont: 'body', itemTransform: 'none' } });
    expect(out).toContain('.he-menu.is-fullscreen .he-menu__row{font-family:var(--he-body-family);text-transform:none}');
  });
  it('let the letter spacing beat the centred menu’s', () => {
    expect(read('src/styles/library-chrome.css')).toContain('.he-menu.is-fullscreen.has-item-tracking .he-menu__row { letter-spacing: var(--he-menu-tracking); }');
  });
});

describe('the footer', () => {
  it('writes nothing until set', () => {
    expect(css({ footer: {} })).toBe('');
    expect(resolveChrome(chromeSchema.parse({})).languages.footerPlaceMobile).toBeUndefined();
  });
  it('sizes the links, pads the footer, sizes the icons', () => {
    const out = css({ footer: { linkSize: '16px', padding: '60px', paddingMobile: '40px 24px', socialSize: '24px', socialBox: '24px', socialGap: '16px', languagesGap: '24px', gapMobile: '60px' } });
    expect(out).toContain('.he-ftr .he-ftr__links a{font-size:16px}');
    expect(out).toContain('.he-ftr>.shell{padding:60px}.he-ftr .he-ftr__grid{padding-block:0}');
    expect(out).toContain('@media (max-width:768px){.he-ftr>.shell{padding:40px 24px}');
    expect(out).toContain('.he-ftr .he-ftr__social a svg{width:24px;height:24px}');
    expect(out).toContain('.he-ftr .he-ftr__social{gap:16px}');
    expect(out).toContain('.he-ftr.has-langrow .he-ftr__grid{row-gap:24px}');
  });
  it('rides the wordmark up without catching the pointer', () => {
    const out = css({ footer: { wordmarkPull: '80px', wordmarkPullMobile: '40px' } });
    expect(out).toContain('.he-ftr .he-ftr__wm{margin-top:calc(-1 * 80px);pointer-events:none}');
    expect(out).toContain('@media (max-width:768px){.he-ftr .he-ftr__wm{margin-top:calc(-1 * 40px);pointer-events:none}}');
  });
  it('refuses a value that could break out of the style element', () => {
    expect(chromeSchema.safeParse({ footer: { padding: '1px;}' } }).success).toBe(false);
    expect(chromeSchema.safeParse({ footer: { wordmarkPull: '1px;}' } }).success).toBe(false);
  });
});

describe('the advert', () => {
  it('names the same six details as the careers list', () => {
    expect([...DETAIL_KEYS].sort()).toEqual(JOB_META.map(([key]) => key).sort());
  });
  it('keeps the usual order until asked', () => {
    expect(orderDetails(JOB_META, undefined)).toEqual([...JOB_META]);
    expect(resolveCareersLook(undefined).detailsOrder).toBeUndefined();
  });
  it('puts the details asked for first and keeps the rest', () => {
    const keys = orderDetails(JOB_META, ['contractType', 'location']).map(([key]) => key);
    expect(keys.slice(0, 2)).toEqual(['contractType', 'location']);
    expect(keys).toHaveLength(6);
  });
  it('refuses a repeat or an unknown detail', () => {
    expect(careersLookSchema.safeParse({ detailsOrder: ['location', 'location'] }).success).toBe(false);
    expect(careersLookSchema.safeParse({ detailsOrder: ['salary'] }).success).toBe(false);
  });
  it('writes nothing until set, then the button and the drop zone', () => {
    expect(careersCss({ detailsOrder: ['location'] })).toBe('');
    const out = careersCss(careersLookSchema.parse({ applySubmitWidthMobile: 'own', dropBorder: '1.5px dashed #123456', dropFill: 'transparent', dropText: '#123456', dropRadius: '0 16px 0 16px', dropLabelType: { size: '16px' } }));
    expect(out).toContain('.he-apply__actions>*{flex:none;width:auto}');
    expect(out).toContain('.he-apply__cv .he-fdrop:not(.has-file){border:1.5px dashed #123456;background-color:transparent}');
    expect(out).toContain('.he-apply__cv .he-fb__label{text-transform:none;letter-spacing:0}');
  });
  it('refuses an edge that could break out', () => {
    expect(careersLookSchema.safeParse({ dropBorder: '1px solid red;}' }).success).toBe(false);
  });
});

describe('link rows', () => {
  it('take a link colour, checked', () => {
    expect(blockSchemas.checkLists.safeParse({ layout: 'linkRows', linkColor: '#123456', lists: [] }).success).toBe(true);
    expect(blockSchemas.checkLists.safeParse({ layout: 'linkRows', linkColor: 'red;}', lists: [] }).success).toBe(false);
  });
});
