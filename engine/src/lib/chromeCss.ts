import { CHROME_GRAMMAR, type Chrome } from './chrome';

/* ═══════════════════════════════════════════════════════════════════════════
   3.28 — the header's, menus' and footer's last details, as CSS
   ───────────────────────────────────────────────────────────────────────────
   Every rule is written only when its value is set, so an untouched site gets
   an empty string and the drawn look. The rules are unlayered (they go out
   with the theme), which beats the components layer whatever the selector;
   among themselves and the unlayered blocks of library.css they carry an
   extra class where they must win.

   Values land in a <style> element: each is checked again here against the
   grammar its schema used, and dropped when it fails.
   ═══════════════════════════════════════════════════════════════════════════ */

const { COLOR, LENGTH, LINE, BOX } = CHROME_GRAMMAR;
const ok = (re: RegExp, v: unknown): v is string => typeof v === 'string' && re.test(v.trim());
const len = (v: unknown) => (ok(LENGTH, v) ? v.trim() : undefined);
const col = (v: unknown) => (ok(COLOR, v) ? v.trim() : undefined);
const box = (v: unknown) => (ok(BOX, v) ? v.trim().replace(/\s+/g, ' ') : undefined);
const line = (v: unknown) => (ok(LINE, v) ? v.trim() : undefined);
const num = (v: unknown, min: number, max: number) => (typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : undefined);
const weight = (v: unknown) => (typeof v === 'string' && /^[3-8]00$/.test(v) ? v : undefined);
const time = (ms: number) => `calc(${ms}ms * var(--he-motion,1))`;

function decls(list: [string, string | number | undefined][]): string {
  return list
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([p, v]) => `${p}:${v}`)
    .join(';');
}
function rule(selector: string, list: [string, string | number | undefined][]): string {
  const body = decls(list);
  return body ? `${selector}{${body}}` : '';
}

/** Tier media queries, widest first, as the rest of the theme writes them. */
const TIERS = [
  ['base', ''],
  ['laptop', '(max-width:1440px)'],
  ['tablet', '(max-width:1024px)'],
  ['mobile', '(max-width:768px)'],
] as const;

function headerCss(h: NonNullable<Chrome['header']>): string[] {
  const out: string[] = [];

  /* 2.1 — the compact dropdown. The panel's own transform centres it; the start alignment takes it off. */
  const d = h.dropdown;
  if (d) {
    const panel = '.he-hdr .he-mega--compact';
    const bg = col(d.background);
    const blur = num(d.blur, 0, 40);
    out.push(
      rule(panel, [
        ['top', len(d.top) ? `calc(100% + ${len(d.top)})` : undefined],
        ['width', len(d.width)],
        ['max-width', len(d.width) ? 'none' : undefined],
        ['background', bg],
        ['backdrop-filter', blur !== undefined ? `blur(${blur}px)` : undefined],
        ['border', d.border === false ? '0' : undefined],
        ['border-radius', len(d.radius)],
        ['padding', box(d.padding)],
      ]),
    );
    if (d.align === 'start') out.push(`${panel}{left:0;transform:none}`);
    if (len(d.width)) out.push(`${panel} .he-mega__links{display:grid;gap:0}`);
    const item = `${panel} .he-mega__group a`;
    const height = len(d.itemHeight);
    out.push(
      rule(item, [
        ['display', height ? 'flex' : undefined],
        ['align-items', height ? 'center' : undefined],
        ['min-height', height],
        // The words' own line no taller than the item, so the height is the item's.
        ['line-height', height ? '1.2' : undefined],
        ['font-size', len(d.itemSize)],
        ['padding', box(d.itemPadding)],
        ['color', col(d.itemColor)],
        ['border-radius', len(d.itemRadius)],
        ['transition', col(d.itemHoverColor) || col(d.itemHoverBackground) ? `color ${time(d.duration ?? 150)},background-color ${time(d.duration ?? 150)}` : undefined],
      ]),
    );
    if (height || box(d.itemPadding)) out.push(`${panel} .he-mega__group ul{gap:0}`);
    out.push(
      rule(`${item}:hover`, [
        ['color', col(d.itemHoverColor)],
        ['background-color', col(d.itemHoverBackground)],
      ]),
    );
    const ms = num(d.duration, 0, 3000);
    if (ms !== undefined) {
      // Kept in the page while closed (Header.tsx), so it can fade out as well as in.
      const rise = len(d.rise) ?? '8px';
      out.push(
        `${panel}{animation:none;opacity:0;visibility:hidden;translate:0 ${rise};transition:opacity ${time(ms)} ease,translate ${time(ms)} ease,visibility 0s linear ${time(ms)}}`,
        `${panel}.is-shown{opacity:1;visibility:visible;translate:0 0;transition:opacity ${time(ms)} ease,translate ${time(ms)} ease,visibility 0s}`,
        `.he-reduce-motion ${panel}{transition:none}`,
        `@media (prefers-reduced-motion:reduce){${panel}{transition:none}}`,
      );
    }
  }

  /* 2.1 — the other top links dim while one is pointed at or open. */
  if (h.dimSiblings) {
    const to = (num(h.dimOpacity, 0, 100) ?? 50) / 100;
    out.push(`.he-hdr__nav>ul:has(>li:is(:hover,:focus-within))>li:not(:hover,:focus-within)>.he-hdr__link{opacity:${to}}`);
    out.push(`.he-hdr__nav>ul>li>.he-hdr__link{transition:color ${time(h.linkDuration ?? 150)} ease,opacity ${time(h.linkDuration ?? 150)} ease}`);
  } else if (h.linkDuration !== undefined && num(h.linkDuration, 0, 3000) !== undefined) {
    out.push(`.he-hdr .he-hdr__link{transition:color ${time(h.linkDuration)} ease}`);
  }

  /* 2.2b — two bars for the menu icon (Header.tsx draws them). */
  if (h.menuIcon === 'bars') {
    out.push(
      rule(':root', [
        ['--he-mi-w', len(h.menuIconWidth)],
        ['--he-mi-s', len(h.menuIconShort)],
        ['--he-mi-t', len(h.menuIconThickness)],
        ['--he-mi-gap', len(h.menuIconGap)],
        ['--he-mi-c', col(h.menuIconColor)],
      ]),
    );
    if (h.menuIconHover === 'grow') out.push('.he-hdr__toggle:hover .he-hdr__bars{transform:scale(1.06);opacity:0.75}');
  }

  /* 2.2c — side padding per tier. */
  if (h.padding) {
    for (const [tier, query] of TIERS) {
      const s = h.padding[tier];
      const r = rule('.he-hdr .he-hdr__inner', [
        ['padding-left', len(s?.left)],
        ['padding-right', len(s?.right)],
      ]);
      if (r) out.push(query ? `@media ${query}{${r}}` : r);
    }
  }

  /* 2.2d — the header button, the same on phones (the phones' own padding is in library.css). */
  const ctaMs = num(h.ctaDuration, 0, 3000);
  const cta = rule('.he-hdr .he-hdr__cta.he-btn', [
    ['display', len(h.ctaHeight) ? 'inline-flex' : undefined],
    ['align-items', len(h.ctaHeight) ? 'center' : undefined],
    ['height', len(h.ctaHeight)],
    ['min-height', len(h.ctaHeight) ? '0' : undefined],
    ['padding', box(h.ctaPadding)],
    ['padding-block', len(h.ctaHeight) && !box(h.ctaPadding) ? '0' : undefined],
    ['font-size', len(h.ctaSize)],
    ['font-weight', weight(h.ctaWeight)],
    ['transition-duration', ctaMs !== undefined ? time(ctaMs) : undefined],
  ]);
  if (cta) out.push(cta);

  /* 2.2e — no glass on phones. */
  if (h.glassPhones === false) out.push('@media (max-width:768px){.he-hdr .he-hdr__bar{backdrop-filter:none}}');

  /* 2.2f — the top links' colour on a project's page. */
  const project = col(h.projectLinkColor);
  if (project) out.push(`.he-site:has(article.he-prj) .he-hdr__link:not(:hover,.is-active,.is-open){color:${project}}`);
  return out;
}

function menuCss(m: NonNullable<Chrome['mobileMenu']>): string[] {
  const out: string[] = [];
  const fs = '.he-menu.is-fullscreen';

  /* 2.3a — sub-items as a second column (Header.tsx); the others dim, the open one moves right. */
  if (m.submenuLayout === 'beside') {
    const by = len(m.shiftBy) ?? '16px';
    out.push(
      `@media (min-width:769px){${fs}.is-sub-beside .he-menu__body{display:grid;grid-template-columns:minmax(0,max-content) minmax(0,1fr);column-gap:clamp(40px,8vw,140px);align-items:start}` +
        `${fs}.is-sub-beside .he-menu__body>:not(.he-menu__list,.he-menu__beside){grid-column:1/-1}` +
        `${fs}.is-sub-beside .he-menu__beside .he-menu__sub{padding:10px 0 0}` +
        `${fs}.is-sub-beside .he-menu__beside .he-menu__sub a{font:inherit;font-family:var(--font-display);font-size:var(--he-menu-size,clamp(32px,6vw,72px));font-weight:var(--he-menu-weight,700);line-height:var(--he-menu-line,1.05);letter-spacing:var(--he-menu-tracking,-0.03em);padding:var(--he-menu-pad,10px) 0;color:inherit}` +
        `${fs}.is-sub-beside .he-menu__list:has(.he-menu__row[aria-expanded=true])>li:not(:has(>.he-menu__row[aria-expanded=true])){opacity:0.5}` +
        `${fs}.is-sub-beside .he-menu__list>li{transition:opacity ${time(m.duration ?? 350)} ease}` +
        `${fs}.is-sub-beside .he-menu__row[aria-expanded=true]{translate:${by} 0}}`,
    );
  }
  /* 2.3b — under the pointer the link keeps its colour and moves right. */
  if (m.itemHover === 'shift') {
    const by = len(m.shiftBy) ?? '16px';
    out.push(`${fs} .he-menu__row{transition:color ${time(350)} ease,translate ${time(350)} ease}${fs} .he-menu__row:hover{color:inherit;translate:${by} 0}`);
  }
  /* 2.3c — fading in and out (Header.tsx keeps it on screen while it leaves). */
  const ms = num(m.duration, 0, 3000);
  if (ms !== undefined) {
    out.push(
      `${fs}:not([class*='is-enter-']){animation:he-fade ${time(ms)} ease-in-out both}`,
      `.he-menu.is-leaving{animation:he-menu-out ${time(ms)} ease-in-out both;pointer-events:none}`,
      '@keyframes he-menu-out{from{opacity:1}to{opacity:0}}',
    );
  }
  /* 2.3d — the list's place, the contact text. */
  const top = len(m.listTop);
  if (top) out.push(`${fs}:not(.has-phone-top) .he-menu__body{padding-top:${top}}`);
  out.push(
    rule('.he-menu .he-menu__aside :is(.he-menu__email,.he-menu__address)', [
      ['font-size', len(m.contactSize)],
      ['color', col(m.contactColor)],
    ]),
  );

  /* 2.4 — the drawer. */
  const d = m.drawer;
  if (d) {
    const dr = '.he-menu:is(.he-menu--drawer,.he-menu--push)';
    out.push(rule(`${dr} :is(.he-menu__row,.he-menu__sub a)[aria-current=page]`, [['color', col(d.activeColor)]]));
    const open = col(d.openBackground);
    if (open || len(d.openRadius)) {
      out.push(
        rule(`${dr} .he-menu__list>li:has(>.he-menu__row[aria-expanded=true])`, [
          ['background', open],
          ['border-radius', len(d.openRadius)],
          ['margin-inline', '-12px'],
          ['padding-inline', '12px'],
        ]),
      );
    }
    out.push(
      rule(`${dr} .he-menu__sub a`, [
        ['font-size', len(d.subSize)],
        ['padding-left', len(d.subIndent)],
      ]),
    );
    const back = col(d.backdrop);
    const alpha = num(d.backdropOpacity, 0, 100);
    const blur = num(d.backdropBlur, 0, 30);
    out.push(
      rule('.he-menu-backdrop.is-drawer', [
        ['background', back ? `color-mix(in srgb, ${back} ${alpha ?? 100}%, transparent)` : alpha !== undefined ? `rgb(0 0 0 / ${alpha}%)` : undefined],
        ['backdrop-filter', blur !== undefined ? (blur === 0 ? 'none' : `blur(${blur}px)`) : undefined],
      ]),
    );
  }
  return out;
}

function footerCss(f: NonNullable<Chrome['footer']>): string[] {
  const out: string[] = [];
  /* 3a — the contact links' size and weight. */
  out.push(
    rule('.he-ftr .he-ftr__contacts a', [
      ['font-size', len(f.contactSize)],
      ['font-weight', weight(f.contactWeight)],
    ]),
  );
  /* 3b — every column the same width. */
  if (f.columns === 'equal') {
    out.push('@media (width>=64rem){.he-ftr .he-ftr__grid{grid-template-columns:repeat(calc(var(--he-footer-cols) + 1),minmax(0,1fr))}}');
  }
  /* 3c — the links' rhythm and the titles' spacing. */
  out.push(
    rule('.he-ftr .he-ftr__links a', [
      ['line-height', line(f.linkLineHeight)],
      ['padding-block', len(f.linkGap) ? '0' : undefined],
    ]),
  );
  out.push(rule('.he-ftr .he-ftr__links', [['row-gap', len(f.linkGap)]]));
  out.push(rule('.he-ftr .he-ftr__coltoggle', [['letter-spacing', len(f.titleTracking)]]));
  /* 3d — the current page's link (FooterActive marks it). */
  out.push(
    rule('.he-ftr a[aria-current=page]', [
      ['font-weight', weight(f.activeWeight)],
      ['color', col(f.activeColor)],
    ]),
  );
  /* 3e — separators and the line above the bottom row. */
  const sep = col(f.separatorColor);
  const gap = len(f.separatorGap);
  out.push(rule('.he-ftr .he-ftr__sep', [['color', sep]]));
  out.push(
    rule('.he-ftr .he-ftr__legal.has-sep li+li::before', [
      ['color', sep],
      ['opacity', sep ? '1' : undefined],
    ]),
  );
  if (gap) out.push(`.he-ftr :is(.he-ftr__social.has-sep,.he-ftr__social.has-sep li,.he-ftr__legal.has-sep,.he-ftr__legal.has-sep li){column-gap:${gap}}`);
  out.push(rule('.he-ftr .he-ftr__bottom', [['border-top-color', col(f.dividerColor)]]));
  return out;
}

/** The stylesheet for the 3.28 chrome details; empty when none is set. */
export function chromeCss(chrome: Chrome | undefined): string {
  if (!chrome) return '';
  const parts = [...(chrome.header ? headerCss(chrome.header) : []), ...(chrome.mobileMenu ? menuCss(chrome.mobileMenu) : []), ...(chrome.footer ? footerCss(chrome.footer) : [])];
  return parts.filter(Boolean).join('');
}
