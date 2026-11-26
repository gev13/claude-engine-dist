import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { blockSchemas } from '@/lib/blocks';
import { cardDate, setSiteDates } from '@/lib/dates';
import { dropShadowFilter, isDropShadows } from '@/lib/dropShadow';
import { formatDate, siteSettingsSchema } from '@/lib/siteSettings';
import { richTextCss, themeToCss } from '@/lib/theme-css';
import { themeSchema } from '@/lib/theme';

/* 3.38.2 — dates in the page's language, card shadows outside their
   corners, the arrow's line in screen pixels, list markers and a picture's
   shadow. Each off, and drawn as before, until set. */

vi.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => ({ push() {} }) }));
vi.mock('@/components/site/Messages', () => ({ useMessages: () => (k: string) => k }));

const theme = (value: unknown) => themeToCss(themeSchema.parse(value));
const date = new Date('2026-08-15T10:00:00Z');
const settings = (dateFormat: string) => siteSettingsSchema.parse({ dateFormat, timeZone: 'UTC' });

describe('dates in the page’s language', () => {
  afterEach(() => setSiteDates(undefined, undefined));
  it('English, or no language, is written exactly as before', () => {
    expect(formatDate(date, settings('MMM d, yyyy'))).toBe('Aug 15, 2026');
    expect(formatDate(date, settings('MMM d, yyyy'), 'en')).toBe('Aug 15, 2026');
    expect(formatDate(date, settings('d MMM yyyy'), 'en-GB')).toBe(formatDate(date, settings('d MMM yyyy')));
  });
  it('another language names the month in its own words, order and punctuation', () => {
    const ru = formatDate(date, settings('MMM d, yyyy'), 'ru');
    expect(ru).toBe(new Intl.DateTimeFormat('ru', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' }).format(date));
    expect(ru).not.toMatch(/Aug/);
    expect(formatDate(date, settings('d MMMM yyyy'), 'hy')).toBe(new Intl.DateTimeFormat('hy', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' }).format(date));
  });
  it('the all-number patterns stay as written, and a language that is not one is ignored', () => {
    expect(formatDate(date, settings('dd/MM/yyyy'), 'ru')).toBe('15/08/2026');
    expect(formatDate(date, settings('yyyy-MM-dd'), 'hy')).toBe('2026-08-15');
    expect(formatDate(date, settings('MMM d, yyyy'), 'x;}')).toBe('Aug 15, 2026');
  });
  it('a card’s date follows its post’s language, with Settings’ format or without one', () => {
    expect(cardDate(date)).toBe(cardDate(date, 'en'));
    expect(cardDate(date, 'ru')).toBe(date.toLocaleDateString('ru', { day: '2-digit', month: 'short', year: 'numeric' }));
    setSiteDates('MMM d, yyyy', 'UTC');
    expect(cardDate(date, 'en')).toBe('Aug 15, 2026');
    expect(cardDate(date, 'ru')).toBe(formatDate(date, settings('MMM d, yyyy'), 'ru'));
  });
});

describe('a card’s shadow outside its corners', () => {
  const shadow = '12px 10px 40px rgba(0,0,0,0.1)';
  it('writes nothing for square or rounded cards', () => {
    const out = theme({ careers: { cardShadow: shadow } });
    expect(out).not.toContain('overflow:clip');
    expect(out).not.toContain('drop-shadow');
  });
  it('a leaf is drawn by the radius on a card with a shadow, the clip dropped', () => {
    const out = theme({ shape: { cards: { style: 'leaf', corners: ['tr'] } }, careers: { cardShadow: shadow } });
    expect(out).toMatch(/\.he-jobcards>\.he-jobc,[^{]*\{clip-path:none;overflow:clip;border-radius:var\(--he-card-radius\)\}/);
    expect(theme({ shape: { cards: { style: 'leaf', corners: ['tr'] } } })).not.toContain('.he-jobcards>.he-jobc');
  });
  it('cut cards take the shadow from their list, which a clip cannot cut', () => {
    const out = theme({ shape: { cards: { style: 'cut' } }, careers: { cardShadow: shadow } });
    expect(out).toContain(`.he-jobcards{filter:drop-shadow(${shadow})}`);
    expect(out).toContain('.he-jobcards>.he-jobc{box-shadow:none}');
    // A spread has no drop-shadow form; that shadow stays as it was.
    expect(theme({ shape: { cards: { style: 'cut' } }, careers: { cardShadow: '0 4px 20px 2px rgba(0,0,0,0.1)' } })).not.toContain('drop-shadow');
  });
});

describe('the arrow’s line in screen pixels', () => {
  it('writes nothing unset', () => {
    expect(theme({ buttons: { arrowSize: '10px' } })).not.toContain('vector-effect');
  });
  it('keeps its thickness at any size, on every arrow button', () => {
    const out = theme({ buttons: { arrowSize: '10px', arrowLine: 1.5 } });
    expect(out).toContain('.he-btn>svg:last-child>*,.he-cbtn:not(.is-icon-only)>svg:last-child:not(:first-child)>*,.he-jobc__btn>svg:last-child>*{stroke-width:1.5;vector-effect:non-scaling-stroke}');
    expect(themeSchema.safeParse({ buttons: { arrowLine: 9 } }).success).toBe(false);
  });
});

describe('list markers', () => {
  const lists = (props: Record<string, unknown>) => {
    const parsed = blockSchemas.checkLists.parse({ icon: 'dot', lists: [{ items: ['One'] }], ...props });
    return import('@/components/blocks/index').then(({ CheckListsBlock }) => renderToStaticMarkup(<CheckListsBlock {...parsed} />));
  };
  it('an icon list’s marker, sized and coloured only when asked', async () => {
    expect(await lists({})).not.toMatch(/has-mk|--he-ilist-mk/);
    const html = await lists({ markerSize: '4px', markerColor: '#999999' });
    expect(html).toContain('has-mk-size has-mk-color');
    expect(html).toContain('--he-ilist-mk:4px;--he-ilist-mkc:#999999');
    expect(blockSchemas.checkLists.safeParse({ lists: [], markerColor: 'red;}' }).success).toBe(false);
  });
  it('rich text bullets: a coloured disc keeps its own marker, a sized one is drawn', () => {
    expect(richTextCss({ listMarker: 'disc', listMarkerColor: '#999999' })).toContain('.prose-edge ul>li::marker{color:#999999}');
    const drawn = richTextCss({ listMarker: 'disc', listMarkerSize: '4px', listMarkerColor: '#999999' });
    expect(drawn).toContain('.prose-edge ul>li::before{content:\'\';position:absolute;left:calc(1.2em / -2 - 4px / 2);top:calc(0.5lh - 4px / 2);width:4px;height:4px;border-radius:50%;background:#999999}');
    expect(richTextCss({ listMarkerColor: '#999999' })).toContain('.prose-edge ul>li::before{background:#999999}');
    expect(richTextCss({ listMarker: 'disc' })).not.toContain('::marker');
  });
});

describe('a picture’s own shadow', () => {
  it('takes up to four drop shadows, nothing that could break out', () => {
    expect(isDropShadows('4px 6px 16px rgba(0,0,0,.3), 20px 24px 32px rgba(0,0,0,.2)')).toBe(true);
    expect(isDropShadows('0 4px 20px 2px #000')).toBe(false);
    expect(isDropShadows('1px 1px 1px #000; x')).toBe(false);
    expect(isDropShadows(Array(5).fill('1px 1px 1px #000').join(','))).toBe(false);
    expect(dropShadowFilter('4px 6px 16px rgba(0,0,0,.3),  2px 2px 4px #000')).toBe('drop-shadow(4px 6px 16px rgba(0,0,0,.3)) drop-shadow(2px 2px 4px #000)');
  });
  it('wraps the picture only when set', async () => {
    const { ImageBlock } = await import('@/components/blocks/index');
    const image = (props: Record<string, unknown>) => renderToStaticMarkup(<ImageBlock {...blockSchemas.image.parse({ url: '/media/a.png', ...props })} />);
    expect(image({})).not.toContain('he-img-shadow');
    expect(image({ shadow: '4px 6px 16px rgba(0,0,0,0.3)' })).toContain('<span class="he-img-shadow" style="filter:drop-shadow(4px 6px 16px rgba(0,0,0,0.3))">');
  });
});
