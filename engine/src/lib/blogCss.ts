import type { ArchiveLook, BlogSettings, CardLook, PostLook } from './blog';

/* ═══════════════════════════════════════════════════════════════════════════
   3.28 — the blog's last details, as CSS
   ───────────────────────────────────────────────────────────────────────────
   Appearance → Blog → Details: the archive cards (`.he-pcards`), an
   archive's head, bar and pager (`.he-arch-*`), and a post page (`.he-post`).
   Every rule is written only when its value is set, so an untouched blog
   gets an empty string. Unlayered, like the rest of the theme, so they beat
   the utilities the blog's markup is drawn with. Every value is checked again
   here: it lands in a <style> element.
   ═══════════════════════════════════════════════════════════════════════════ */

const LENGTH = /^(0|-?\d*\.?\d+(px|rem|em|vw|vh|%))$/;
const COLOR = /^(#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})|(rgb|rgba|hsl|hsla)\(\s*[0-9.,%\s/deg-]+\))$/i;
const BOX = /^(0|-?\d*\.?\d+(px|rem|em|%))(\s+(0|-?\d*\.?\d+(px|rem|em|%))){0,3}$/;
const LINE = /^(\d*\.?\d+|\d*\.?\d+(px|rem|em))$/;
const len = (v: unknown) => (typeof v === 'string' && LENGTH.test(v.trim()) ? v.trim() : undefined);
const col = (v: unknown) => (typeof v === 'string' && COLOR.test(v.trim()) ? v.trim() : undefined);
const box = (v: unknown) => (typeof v === 'string' && BOX.test(v.trim()) ? v.trim().replace(/\s+/g, ' ') : undefined);
const line = (v: unknown) => (typeof v === 'string' && LINE.test(v.trim()) ? v.trim() : undefined);
const weight = (v: unknown) => (typeof v === 'string' && /^[3-8]00$/.test(v) ? v : undefined);
const face = (v: unknown) => (v === 'display' ? 'var(--font-display)' : v === 'body' ? 'var(--he-body-family)' : undefined);

type Decls = [string, string | number | undefined][];
function rule(selector: string, list: Decls): string {
  const body = list
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([p, v]) => `${p}:${v}`)
    .join(';');
  return body ? `${selector}{${body}}` : '';
}
const media = (query: string, css: string) => (css ? `@media ${query}{${css}}` : '');
const TABLET = '(max-width:1024px)';
const PHONE = '(max-width:768px)';

/** 7.1 — the archive cards. */
function cardCss(c: CardLook): string[] {
  const out: string[] = [];
  const cards = '.he-pcards';
  const card = `${cards} .he-ucard`;
  const panel = col(c.panel);
  const pad = box(c.padding);
  if (c.style === 'contained') {
    // The picture flush with the card's edges: it gives back the card's padding above and at the sides.
    out.push(
      rule(card, [
        ['padding', pad ?? '20px 24px'],
        ['background-color', panel],
        ['border-radius', len(c.radius)],
        ['overflow', 'hidden'],
      ]),
      `${card} .he-ucard__media{margin-top:calc(-1 * var(--he-pc-pt));margin-inline:calc(-1 * var(--he-pc-px));border-radius:0;clip-path:none}`,
      rule(card, [
        ['--he-pc-pt', (pad ?? '20px 24px').split(' ')[0]],
        ['--he-pc-px', (pad ?? '20px 24px').split(' ')[1] ?? (pad ?? '20px').split(' ')[0]],
      ]),
    );
    const padM = box(c.paddingMobile);
    if (padM) {
      out.push(media(PHONE, rule(card, [['padding', padM], ['--he-pc-pt', padM.split(' ')[0]], ['--he-pc-px', padM.split(' ')[1] ?? padM.split(' ')[0]]])));
    }
  } else {
    out.push(rule(card, [['padding', pad], ['background-color', panel], ['border-radius', len(c.radius)]]));
  }
  if (c.still) out.push(`${cards} a:hover .he-ucard{background-color:${panel ?? 'var(--color-surface)'}}`);
  const cols = c.columnsTablet;
  if (typeof cols === 'number' && cols >= 1 && cols <= 3) out.push(`@media (48rem < width <= 64rem){${cards}{grid-template-columns:repeat(${cols},minmax(0,1fr))}}`);
  out.push(rule(`${card} .he-ucard__eyebrow`, [['font-size', len(c.dateSize)], ['font-weight', weight(c.dateWeight)], ['color', col(c.dateColor)], ['text-transform', len(c.dateSize) ? 'none' : undefined], ['letter-spacing', len(c.dateSize) ? '0' : undefined]]));
  out.push(rule(`${card} .he-ucard__rt`, [['font-weight', weight(c.readingWeight)]]));
  out.push(
    rule(`${card} h3`, [
      ['font-family', face(c.titleFont)],
      ['font-size', len(c.titleSize)],
      ['font-weight', weight(c.titleWeight)],
      ['line-height', line(c.titleLine)],
      ['letter-spacing', len(c.titleTracking)],
    ]),
  );
  out.push(media(PHONE, rule(`${card} h3`, [['font-size', len(c.titleSizeMobile)]])));
  const chip = `${card} .he-card__chip`;
  if (c.chipStyle === 'filled') out.push(`${chip}{border-color:transparent;background:${col(c.chipBackground) ?? 'color-mix(in srgb,currentColor 8%,transparent)'}}`);
  out.push(rule(chip, [['border-radius', len(c.chipRadius)], ['font-size', len(c.chipSize)], ['font-weight', weight(c.chipWeight)]]));
  const link = len(c.linkGap);
  out.push(rule(`${card} .he-more`, [['font-size', len(c.linkSize)], ['font-weight', weight(c.linkWeight)], ['margin-top', link], ['padding-top', link ? '0' : undefined]]));
  return out;
}

/** 7.2 — an archive's head, bar, filter, pager and spacing. */
function archiveCss(a: ArchiveLook): string[] {
  const out: string[] = [];
  const head = '.he-arch-head';
  out.push(rule(`${head} h1`, [['font-size', len(a.titleSize)], ['max-width', len(a.titleSize) ? 'none' : undefined]]));
  out.push(media(TABLET, rule(`${head} h1`, [['font-size', len(a.titleSizeTablet)]])));
  out.push(media(PHONE, rule(`${head} h1`, [['font-size', len(a.titleSizeMobile)]])));
  out.push(rule(head, [['padding-top', len(a.top)]]));
  out.push(media(PHONE, rule(head, [['padding-top', len(a.topMobile)]])));
  out.push(rule(`${head} .he-arch-sub`, [['font-size', len(a.labelSize)], ['font-weight', weight(a.labelWeight)], ['color', col(a.labelColor)], ['margin-top', len(a.labelGap)], ['text-transform', len(a.labelSize) ? 'none' : undefined], ['letter-spacing', len(a.labelSize) ? '0' : undefined], ['font-family', len(a.labelSize) ? 'inherit' : undefined]]));
  out.push(rule('.he-arch-crumbs .he-crumbs ol', [['font-size', len(a.crumbSize)]]));
  out.push(rule('.he-arch-crumbs .he-crumbs li:first-child a', [['font-weight', weight(a.crumbHomeWeight)]]));
  const filter = '.he-catmenu__button';
  out.push(
    rule(filter, [
      ['background', col(a.filterBackground)],
      ['border-color', col(a.filterBackground) ? 'transparent' : undefined],
      ['border-radius', len(a.filterRadius)],
      ['color', col(a.filterColor)],
      ['font-size', len(a.filterSize)],
      ['height', len(a.filterHeight)],
      ['padding-block', len(a.filterHeight) ? '0' : undefined],
    ]),
  );
  const pager = '.he-pager';
  if (a.pagerAlign === 'left') out.push(`${pager}{justify-content:flex-start}`);
  out.push(rule(pager, [['gap', len(a.pagerGap)]]));
  out.push(
    rule(`${pager} .he-pager__btn`, [
      ['min-width', len(a.pagerSize)],
      ['height', len(a.pagerSize)],
      ['font-family', face(a.pagerFont)],
      ['font-size', len(a.pagerTextSize)],
      ['font-weight', weight(a.pagerWeight)],
    ]),
  );
  if (a.pagerHideDisabled) out.push(`${pager} .he-pager__btn[data-disabled]{display:none}`);
  const top = len(a.gridTop);
  if (top) out.push(`.he-arch-bar:has(+.he-arch-list),.he-arch-head:has(+.he-arch-list){padding-bottom:0}.he-arch-list{padding-top:${top}}`);
  out.push(rule('.he-arch-list', [['padding-bottom', len(a.gridBottom)]]));
  if (a.phoneFilters) {
    out.push(
      '.he-blogbar__filters{display:none}',
      media(
        PHONE,
        '.he-blogbar.has-filters .he-blogbar__filters{display:inline-flex}.he-blogbar.has-filters>.he-blogbar__end{display:none}.he-blogbar.has-filters.is-open>.he-blogbar__end{display:flex;flex-direction:column;align-items:flex-start;gap:16px;width:100%;padding:20px;border-radius:8px;background:var(--color-surface);animation:he-fade calc(250ms * var(--he-motion,1)) ease both}',
      ),
    );
  }
  return out;
}

/** 7.3 — a post page. */
function postCss(p: PostLook): string[] {
  const out: string[] = [];
  const post = '.he-post';
  out.push(rule(post, [['--container-shell', len(p.width)]]));
  out.push(rule(`${post} .he-post__col`, [['margin-top', len(p.coverGap)]]));
  const side = len(p.sidebarWidth);
  if (side) {
    out.push(
      `@media (min-width:1025px){${post} .he-post__body.has-toc-left{grid-template-columns:${side} minmax(0,1fr)}${post} .he-post__body.has-toc-right{grid-template-columns:minmax(0,1fr) ${side}}` +
        `${post} .he-post__body.has-share-beside.has-toc-left{grid-template-columns:auto ${side} minmax(0,1fr)}${post} .he-post__body.has-share-beside.has-toc-right{grid-template-columns:auto minmax(0,1fr) ${side}}}`,
    );
  }
  out.push(rule(`${post} :is(.he-post__flow,.he-post__body .prose-edge,.he-post__col>.prose-edge)`, [['max-width', len(p.textWidth)]]));
  const h1 = `${post} h1`;
  out.push(rule(h1, [['font-size', len(p.titleSize)], ['max-width', p.titleWidth === 'none' ? 'none' : undefined]]));
  if (p.titleWidth === 'none' && !len(p.titleSize)) out.push(`${h1}{max-width:none}`);
  out.push(media(TABLET, rule(h1, [['font-size', len(p.titleSizeTablet)]])));
  out.push(media(PHONE, rule(h1, [['font-size', len(p.titleSizeMobile)]])));
  // The line above the title, the category alone in the accent (PostArticle splits it).
  out.push(
    rule(`${post} .he-post__eyebrow.is-split`, [
      ['color', col(p.lineColor)],
      ['font-size', len(p.lineSize)],
      ['font-family', face(p.lineFont)],
      ['text-transform', len(p.lineSize) || face(p.lineFont) ? 'none' : undefined],
      ['letter-spacing', len(p.lineSize) || face(p.lineFont) ? '0' : undefined],
    ]),
  );
  // Contents.
  const toc = `${post} .he-post__toc`;
  if (p.tocReveal) out.push(`${toc}{transition:opacity calc(350ms * var(--he-motion,1)) ease}${toc}:not(.is-stuck){opacity:0;pointer-events:none}`, media(TABLET, `${toc}:not(.is-stuck){opacity:1;pointer-events:auto}`));
  out.push(rule(`${toc} .he-toc`, [['background', col(p.tocPanel)], ['padding', col(p.tocPanel) ? '20px' : undefined], ['border-radius', col(p.tocPanel) ? '8px' : undefined]]));
  out.push(rule(`${toc} .he-toc__title`, [['font-size', len(p.tocTitleSize)], ['font-weight', weight(p.tocTitleWeight)], ['text-transform', len(p.tocTitleSize) ? 'none' : undefined], ['letter-spacing', len(p.tocTitleSize) ? '0' : undefined], ['font-family', len(p.tocTitleSize) ? 'inherit' : undefined], ['color', len(p.tocTitleSize) ? 'var(--color-bone)' : undefined]]));
  out.push(rule(`${toc} .he-toc__list a`, [['font-size', len(p.tocItemSize)], ['color', col(p.tocItemColor)]]));
  out.push(rule(`${toc} .he-toc__list a.is-active`, [['color', col(p.tocActiveColor)], ['border-left-color', col(p.tocActiveColor)]]));
  // Share.
  const share = `${post} .he-post__share`;
  const panel = col(p.sharePanel);
  if (panel) out.push(`${share} .he-shr{gap:0;padding:6px;border-radius:8px;background:${panel};width:max-content}${share} .he-shr__a{border-color:transparent}`);
  out.push(rule(`${share} .he-shr`, [['--s', len(p.shareSize)]]));
  // Tablets keep the columns beside the article (and leave the share column out).
  if (p.sidebarTablet) {
    out.push(
      '@media (48rem < width <= 64rem){' +
        '.he-post__body.has-toc-left{grid-template-columns:minmax(200px,260px) minmax(0,1fr);gap:var(--he-gap,40px)}' +
        '.he-post__body.has-toc-right{grid-template-columns:minmax(0,1fr) minmax(200px,260px);gap:var(--he-gap,40px)}' +
        '.he-post__body.has-toc-right>.he-post__toc{order:2}' +
        '.he-post__body>.he-post__toc{position:sticky;top:calc(var(--he-header-h,0px) + 24px);margin-top:48px}' +
        '.he-post__body.has-share-beside>.he-post__share.is-beside{display:none}' +
        '.he-post__body.has-share-beside:not(.has-toc-left,.has-toc-right){grid-template-columns:minmax(0,1fr)}' +
        '}',
    );
  }
  if (p.phoneShare === 'end') out.push(media(PHONE, '.he-post__body>.he-post__share.is-beside{order:9}'));
  if (p.phoneToc === 'none') out.push(media(PHONE, `${toc}{display:none}`));
  // The article's text.
  const prose = `${post} .prose-edge`;
  if (p.linkUnderline === false) out.push(`${prose} a{text-decoration:none}`);
  out.push(rule(`${prose} table`, [['font-size', len(p.tableSize)]]));
  out.push(rule(`${prose} :is(th,td)`, [['padding', box(p.tablePadding)]]));
  const lines = col(p.tableLineColor);
  if (p.tableLines === 'rows') out.push(`${prose} :is(th,td){border-width:0 0 1px;border-color:${lines ?? 'var(--color-hairline)'}}${prose} th{background:none}`);
  else if (lines) out.push(`${prose} :is(th,td){border-color:${lines}}`);
  const marker = col(p.markerColor);
  if (marker) out.push(`${prose} ol>li::marker{color:${marker}}${prose} ul>li::before{background:${marker}}${prose} ul>li::marker{color:${marker}}`);
  out.push(rule(`${post} .he-post__inline`, [['margin-block', len(p.inlineSpace)]]));
  // Related posts.
  out.push(rule('.he-related', [['--container-shell', len(p.relatedWidth)]]));
  out.push(rule('.he-related h2', [['font-size', len(p.relatedTitleSize)], ['font-weight', weight(p.relatedTitleWeight)], ['margin-bottom', len(p.relatedTitleGap)]]));
  return out;
}

/** The stylesheet for the blog's 3.28 details; empty when none is set. */
export function blogCss(blog: BlogSettings | undefined): string {
  const look = blog?.look;
  if (!look) return '';
  return [...(look.card ? cardCss(look.card) : []), ...(look.archive ? archiveCss(look.archive) : []), ...(look.post ? postCss(look.post) : [])].filter(Boolean).join('');
}
