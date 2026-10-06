import {
  BREAKPOINTS,
  BUTTON_VARIANTS,
  FONT_STACKS,
  TYPE_ROLES,
  type BreakpointKey,
  type Theme,
  type TypeRole,
  isColor,
  isUsableLength as isLength,
  isLineHeight,
  roleVar,
} from './theme';
import { CUT_BUTTON_FILL, CUT_BUTTON_RING, cutLegs, cutLines, cutPolygon, cutVars } from './shape';

/* ═══════════════════════════════════════════════════════════════════════════
   Theme → CSS
   ───────────────────────────────────────────────────────────────────────────
   Pure, so it is unit-testable without a database or a browser.

   The output is a set of custom-property declarations, nothing more. Every
   component already reads these properties (globals.css declares the mockup
   values as their defaults), so a responsive override is just the same
   variable re-declared inside a media query — no component needs to know that
   a theme exists.

   Validation happens here a second time, after zod. The schema is the gate,
   but this function is what actually writes into a <style> element, so it
   refuses to emit a value it has not itself checked. A rejected value is
   dropped and the built-in default wins.
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Last line of defence. Nothing that could terminate a declaration, open an
 * at-rule or close the <style> element may pass, whatever the schema thought.
 */
function safe(value: string | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/[<>{};@\\]/.test(trimmed)) return null;
  return trimmed;
}

type Decl = [property: string, value: string];

function push(out: Decl[], property: string, value: string | undefined, check: (v: string) => boolean) {
  const clean = safe(value);
  if (clean && check(clean)) out.push([property, clean]);
}

const isKeyword = (allowed: readonly string[]) => (v: string) => allowed.includes(v);

/* ── Colours and layout ───────────────────────────────────────────────────── */

/**
 * Theme colour → the Tailwind token it overrides. Mapping onto the existing
 * token names rather than inventing parallel ones means every utility class in
 * the codebase (`bg-ink`, `text-ash`, `border-hairline`) follows the theme for
 * free.
 */
export const COLOR_TOKENS: Record<string, string> = {
  background: '--color-ink',
  surface: '--color-surface',
  surfaceRaised: '--color-surface-2',
  textPrimary: '--color-bone',
  textBody: '--color-ash',
  textMuted: '--color-smoke',
  primary: '--color-flare',
  primaryHover: '--color-flare-hot',
  primarySoft: '--color-flare-soft',
  hairline: '--color-hairline',
  rule: '--color-rule',
  link: '--he-link',
  linkHover: '--he-link-hover',
  selection: '--he-selection',
};

/** The colour tokens of one palette, checked — exported for a page that takes the alternate palette (2.19). */
export function colorDecls(theme: Theme, which: 'colors' | 'colorsAlt' | 'colorsAlt2' = 'colors'): Decl[] {
  const out: Decl[] = [];
  const colors = theme[which] ?? {};
  for (const [key, token] of Object.entries(COLOR_TOKENS)) {
    push(out, token, (colors as Record<string, string | undefined>)[key], isColor);
  }
  return out;
}

/* Meaning colours and the chart series. Emitted only where a site set one —
   the drawn-in defaults live in `globals.css` like every other `--he-*`, so an
   untouched site's CSS is byte for byte what it was. */
function statusDecls(theme: Theme): Decl[] {
  const out: Decl[] = [];
  const status = theme.status ?? {};
  push(out, '--he-gap', theme.gap, isLength);
  if (typeof theme.motion === 'number' && Number.isFinite(theme.motion) && theme.motion >= 0) {
    out.push(['--he-motion', String(theme.motion)]);
  }

  const blockText = theme.blockText ?? {};
  push(out, '--he-block-lead', blockText.lead, isLength);
  push(out, '--he-block-text', blockText.text, isLength);
  push(out, '--he-block-small', blockText.small, isLength);

  push(out, '--he-status-success', status.success, isColor);
  push(out, '--he-status-warning', status.warning, isColor);
  push(out, '--he-status-danger', status.danger, isColor);
  push(out, '--he-status-rating', status.rating, isColor);

  (theme.chart ?? []).forEach((value, i) => {
    // The properties are one-based, matching what the stylesheet reads.
    push(out, `--he-chart-${i + 1}`, value, isColor);
  });

  return out;
}

function layoutDecls(theme: Theme): Decl[] {
  const out: Decl[] = [];
  const layout = theme.layout ?? {};
  push(out, '--container-shell', layout.containerWidth, isLength);
  push(out, '--spacing-gutter', layout.gutter, isLength);
  push(out, '--he-radius', layout.radius, isLength);
  push(out, '--he-title-measure', layout.titleWidth, isLength);
  push(out, '--he-intro-gap', layout.introGap, isLength);
  push(out, '--he-intro-measure', layout.introWidth, isLength);
  return out;
}

/**
 * 3.22 — every property `globals.css` declares from a palette colour, with
 * that declaration. `tests/theme.test.ts` reads the stylesheet and fails when
 * the two lists drift apart.
 */
export const PALETTE_FOLLOWERS: Decl[] = [
  ['--he-link', 'var(--color-flare-soft)'],
  ['--he-link-hover', 'var(--color-flare-hot)'],
  ['--he-selection', 'var(--color-flare)'],
  ['--he-body-color', 'var(--color-bone)'],
  ['--he-lede-color', 'var(--color-bone)'],
  ['--he-eyebrow-color', 'var(--he-label-color, var(--color-smoke))'],
  ['--he-h1-color', 'var(--color-bone)'],
  ['--he-h2-color', 'var(--color-bone)'],
  ['--he-h3-color', 'var(--color-bone)'],
  ['--he-h4-color', 'var(--color-bone)'],
  ['--he-h5-color', 'var(--color-bone)'],
  ['--he-h6-color', 'var(--color-bone)'],
  ['--he-btn-primary-bg', 'var(--color-flare)'],
  ['--he-btn-primary-text', 'var(--color-bone)'],
  ['--he-btn-primary-hover-bg', 'var(--color-flare-hot)'],
  ['--he-btn-primary-hover-text', 'var(--color-ink)'],
  ['--he-btn-outline-text', 'var(--color-bone)'],
  ['--he-btn-outline-border', 'var(--color-rule)'],
  ['--he-btn-outline-hover-bg', 'var(--color-surface)'],
  ['--he-btn-outline-hover-text', 'var(--color-bone)'],
  ['--he-btn-outline-hover-border', 'var(--color-bone)'],
  ['--he-btn-ghost-text', 'var(--color-bone)'],
  ['--he-btn-ghost-hover-text', 'var(--color-flare-soft)'],
];

/* ── Typography ───────────────────────────────────────────────────────────── */

const TRANSFORMS = ['none', 'uppercase', 'lowercase', 'capitalize'];
const DECORATIONS = ['none', 'underline', 'line-through'];
const STYLES = ['normal', 'italic'];
const WEIGHTS = ['100', '200', '300', '400', '500', '600', '700', '800', '900'];

function typographyDecls(theme: Theme): Decl[] {
  const out: Decl[] = [];
  const typography = theme.typography ?? {};

  for (const role of TYPE_ROLES) {
    const base = typography[role]?.base;
    if (!base) continue;
    const v = roleVar(role);

    if (base.family && base.family in FONT_STACKS) {
      out.push([`--he-${v}-family`, FONT_STACKS[base.family]]);
    }
    push(out, `--he-${v}-size`, base.size, isLength);
    push(out, `--he-${v}-weight`, base.weight, isKeyword(WEIGHTS));
    push(out, `--he-${v}-style`, base.style, isKeyword(STYLES));
    push(out, `--he-${v}-color`, base.color, isColor);
    push(out, `--he-${v}-transform`, base.transform, isKeyword(TRANSFORMS));
    push(out, `--he-${v}-decoration`, base.decoration, isKeyword(DECORATIONS));
    push(out, `--he-${v}-line`, base.lineHeight, isLineHeight);
    push(out, `--he-${v}-tracking`, base.letterSpacing, isLength);
  }

  return out;
}

/** The responsive half: only size, line height and tracking vary per width. */
function adaptiveDecls(theme: Theme, breakpoint: BreakpointKey): Decl[] {
  const out: Decl[] = [];
  const typography = theme.typography ?? {};

  for (const role of TYPE_ROLES as readonly TypeRole[]) {
    const step = typography[role]?.[breakpoint];
    if (!step) continue;
    const v = roleVar(role);
    push(out, `--he-${v}-size`, step.size, isLength);
    push(out, `--he-${v}-line`, step.lineHeight, isLineHeight);
    push(out, `--he-${v}-tracking`, step.letterSpacing, isLength);
  }

  // 3.13 — block text sizes on phones.
  if (breakpoint === 'mobile') {
    push(out, '--he-block-lead', theme.blockTextMobile?.lead, isLength);
    push(out, '--he-block-text', theme.blockTextMobile?.text, isLength);
    push(out, '--he-block-small', theme.blockTextMobile?.small, isLength);
  }

  // 3.13 — the site's gap on this tier.
  if (breakpoint === 'tablet') push(out, '--he-gap', theme.gapTablet, isLength);
  if (breakpoint === 'mobile') push(out, '--he-gap', theme.gapMobile, isLength);

  // 3.13 — the buttons' padding and label size on this tier.
  const buttons = theme.buttons?.[breakpoint];
  push(out, '--he-btn-px', buttons?.paddingX, isLength);
  push(out, '--he-btn-py', buttons?.paddingY, isLength);
  push(out, '--he-btn-size', buttons?.fontSize, isLength);

  const brand = theme.brand ?? {};
  if (breakpoint === 'mobile') push(out, '--he-logo-height', brand.logoHeightMobile, isLength);

  // 3.22 — the content column's width on this tier.
  const layout = theme.layout ?? {};
  const container = { laptop: layout.containerWidthLaptop, tablet: layout.containerWidthTablet, mobile: layout.containerWidthMobile }[breakpoint];
  push(out, '--container-shell', container, isLength);

  return out;
}

/* ── Buttons ──────────────────────────────────────────────────────────────── */

function buttonDecls(theme: Theme): Decl[] {
  const out: Decl[] = [];
  const buttons = theme.buttons ?? {};

  push(out, '--he-btn-radius', buttons.radius, isLength);
  push(out, '--he-btn-px', buttons.paddingX, isLength);
  push(out, '--he-btn-py', buttons.paddingY, isLength);
  push(out, '--he-btn-size', buttons.fontSize, isLength);
  push(out, '--he-btn-tracking', buttons.letterSpacing, isLength);
  push(out, '--he-btn-transform', buttons.transform, isKeyword(TRANSFORMS));

  for (const variant of BUTTON_VARIANTS) {
    const style = buttons[variant];
    if (!style) continue;
    push(out, `--he-btn-${variant}-bg`, style.background, isColor);
    push(out, `--he-btn-${variant}-text`, style.text, isColor);
    push(out, `--he-btn-${variant}-border`, style.border, isColor);
    push(out, `--he-btn-${variant}-border-width`, style.borderWidth, isLength);
    push(out, `--he-btn-${variant}-hover-bg`, style.hoverBackground, isColor);
    push(out, `--he-btn-${variant}-hover-text`, style.hoverText, isColor);
    push(out, `--he-btn-${variant}-hover-border`, style.hoverBorder, isColor);
    push(out, `--he-btn-${variant}-arrow`, style.arrow, isColor);
  }

  return out;
}

/**
 * The typeface overrides for each language, as `:lang()` rules.
 *
 * `<html lang>` already follows the locale — it is what a screen reader
 * switches pronunciation on — so the language is already in the document and
 * CSS can read it. No JavaScript, no per-page branching, and a rule that
 * costs nothing on a site that speaks one language, because none is emitted.
 *
 * The locale is interpolated into a selector, so it is held to the shape a
 * locale actually has rather than trusted.
 */
const LOCALE_PATTERN = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/;

function localeFontCss(theme: Theme, selector: string): string {
  const byLocale = theme.localeFonts ?? {};
  const parts: string[] = [];

  for (const [locale, fonts] of Object.entries(byLocale)) {
    if (!LOCALE_PATTERN.test(locale)) continue;
    const decls: Decl[] = [];
    if (fonts?.display && fonts.display in FONT_STACKS) decls.push(['--font-display', FONT_STACKS[fonts.display]]);
    if (fonts?.sans && fonts.sans in FONT_STACKS) decls.push(['--font-sans', FONT_STACKS[fonts.sans]]);
    if (fonts?.mono && fonts.mono in FONT_STACKS) decls.push(['--font-mono', FONT_STACKS[fonts.mono]]);
    if (decls.length) parts.push(block(`${selector}:lang(${locale})`, decls));
  }

  return parts.join('');
}

/* ── 2.21: corners, panels, button extras, eyebrow marker, header links ──── */

/** The fallback cut, per kind of element, when a size is not given — the pattern book's sizes. */
export const CUT_SIZES = { cards: 20, buttons: 10, inputs: 8, chips: 6, images: 24, panel: 28 } as const;

/** Classes that wear the input shape: every text field the site draws. */
const INPUT_SELECTOR = ':is(input.he-fb__input:not([type=file]),textarea.he-fb__input,.he-nl__input,.he-srch__input,.he-field)';
/** …and the chip shape: choices, filters and category chips. */
const CHIP_SELECTOR = ':is(.he-fb__choice>span,.he-proj__chip,.he-chip)';
const BUTTON_SELECTOR = ':is(.he-btn,.he-cbtn:not(.is-text))';

/** The cut lines as background longhands, so the element's own background colour stays. */
function lineDecls(lines: ReturnType<typeof cutLines>): Decl[] {
  if (!lines) return [];
  return [
    ['background-image', lines.image],
    ['background-position', lines.position],
    ['background-size', lines.size],
    ['background-repeat', 'no-repeat'],
  ];
}

/**
 * 3.2 — field colours. Background *colour*, not the shorthand, so a cut
 * field keeps its drawn edge lines; chips only while unchosen, so a chosen
 * chip keeps the accent.
 */
function fieldCss(theme: Theme, scope: string): string {
  const f = theme.fields ?? {};
  const field: Decl[] = [];
  push(field, 'background-color', f.background, isColor);
  push(field, 'border-color', f.border, isColor);
  push(field, 'color', f.text, isColor);
  // 3.27 — the fields' size: one-line fields and drop-downs, then every field's corners and padding, then a text box.
  const box = `${scope}:is(input.he-fb__input:not([type=file]),select.he-fb__input,button.he-fb__input,textarea.he-fb__input,.he-nl__input,.he-field)`;
  const sized: string[] = [];
  if (f.height && isLength(f.height)) sized.push(block(`${scope}:is(input.he-fb__input:not([type=file]),select.he-fb__input,button.he-fb__input,.he-nl__input,input.he-field)`, [['height', f.height], ['padding-block', '0']]));
  const shape: Decl[] = [];
  push(shape, 'border-radius', f.radius, isLength);
  push(shape, 'padding-inline', f.paddingInline, isLength);
  if (shape.length) sized.push(block(box, shape));
  if (f.textareaHeight && isLength(f.textareaHeight)) sized.push(block(`${scope}textarea.he-fb__input`, [['min-height', f.textareaHeight], ['height', f.textareaHeight]]));
  if (field.length === 0) return sized.join('');
  const chip = field.filter(([property]) => property !== 'color');
  return block(`${scope}${INPUT_SELECTOR}`, field) + (chip.length ? block(`${scope}.he-fb__choice input:not(:checked)+span`, chip) : '') + sized.join('');
}

function shapeCss(theme: Theme, scope: string): string {
  const parts: string[] = [];
  const shape = theme.shape ?? {};
  const at = (selector: string) => `${scope}${selector}`;

  // Cards clip through a variable every card rule already carries (`clip-path: var(--he-card-clip, none)`).
  const card = cutLegs(shape.cards, CUT_SIZES.cards);
  // 3.3 — boxes drawn like cards (the contained FAQ) square off with them.
  if (card) parts.push(block(scope ? scope.trim() : ':root', [['--he-card-radius', '0px'], ['--he-box-radius', '0px'], ['--he-card-clip', cutPolygon(card)]]));
  // 3.17 — a bordered box cut like a card (the contained FAQ) keeps its border along the cuts.
  if (card) parts.push(block(at('.he-faq.is-contained'), [['--he-cut-line', 'var(--color-hairline)'], ...lineDecls(cutLines(card, 0.67))]));

  const image = cutLegs(shape.images, CUT_SIZES.images);
  if (image) parts.push(block(scope ? scope.trim() : ':root', [['--he-image-clip', cutPolygon(image)]]));

  const input = cutLegs(shape.inputs, CUT_SIZES.inputs);
  if (input) {
    const lines = cutLines(input);
    parts.push(block(at(INPUT_SELECTOR), [['clip-path', cutPolygon(input)], ['border-radius', '0'], ['--he-cut-line', 'color-mix(in srgb,currentColor 30%,transparent)'], ...lineDecls(lines)]));
  }

  const chip = cutLegs(shape.chips, CUT_SIZES.chips);
  if (chip) {
    const lines = cutLines(chip);
    parts.push(block(at(CHIP_SELECTOR), [['clip-path', cutPolygon(chip)], ['border-radius', '0'], ['--he-cut-line', 'color-mix(in srgb,currentColor 30%,transparent)'], ...lineDecls(lines)]));
    // The focus ring sat outside the chip, where the clip now cuts it off: draw it inside.
    parts.push(block(at('.he-fb__choice input:focus-visible+span'), [['outline-offset', '-4px']]));
  }

  // Buttons are painted, so the glow below follows the cut instead of being clipped by it.
  const button = cutLegs(shape.buttons, CUT_SIZES.buttons);
  if (button) {
    parts.push(
      block(at(BUTTON_SELECTOR), [
        ...cutVars(button),
        ['background', 'none'],
        ['border-color', 'transparent'],
        ['border-radius', '0'],
        // 3.15 — the edge is a ring behind the label (CUT_BUTTON_RING), as thick as the real border.
        ['position', 'relative'],
        ['isolation', 'isolate'],
        ['--he-bx', 'var(--he-bw,0px)'],
      ]),
    );
    // A library button's border is always 2px, whatever its variant's width says.
    parts.push(block(at('.he-cbtn:not(.is-text)'), [['--he-bx', '2px']]));
    parts.push(
      block(at(`${BUTTON_SELECTOR}::before`), [
        ['content', "''"],
        ['position', 'absolute'],
        ['inset', 'calc(-1 * var(--he-bx,0px))'],
        ['z-index', '-1'],
        ['background', 'var(--he-bl)'],
        ['clip-path', CUT_BUTTON_RING],
        ['pointer-events', 'none'],
      ]),
    );
    // 3.15.1 — the fill, one shape inside the edge.
    parts.push(
      block(at(`${BUTTON_SELECTOR}::after`), [
        ['content', "''"],
        ['position', 'absolute'],
        ['inset', '0'],
        ['z-index', '-1'],
        ['background', 'var(--he-bf)'],
        ['clip-path', CUT_BUTTON_FILL],
        ['pointer-events', 'none'],
      ]),
    );
    for (const [variant, classes] of [
      ['primary', ['.he-btn-primary', '.he-cbtn.is-primary']],
      ['outline', ['.he-btn-outline', '.he-cbtn.is-outline']],
      ['ghost', ['.he-btn-ghost']],
    ] as const) {
      const list = (suffix = '') => classes.map((c) => at(`${c}${suffix}`)).join(',');
      parts.push(
        block(list(), [
          ['--he-bf', `var(--he-btn-${variant}-bg)`],
          ['--he-bl', `var(--he-btn-${variant}-border)`],
          ['--he-bw', variant === 'outline' ? `var(--he-btn-outline-border-width,2px)` : `var(--he-btn-${variant}-border-width,0px)`],
        ]),
      );
      parts.push(block(list(':hover'), [['--he-bf', `var(--he-btn-${variant}-hover-bg)`], ['--he-bl', `var(--he-btn-${variant}-hover-border)`]]));
    }
    parts.push(block(at('.he-cbtn.is-soft'), [['--he-bf', 'color-mix(in srgb,currentColor 12%,transparent)'], ['--he-bl', 'transparent'], ['--he-bw', '0px']]));
    parts.push(block(at('.he-cbtn.is-soft:hover'), [['--he-bf', 'color-mix(in srgb,currentColor 22%,transparent)']]));
    // The contextual button on a flare band keeps its own colours.
    parts.push(block(at('.he-btn.bg-ink'), [['--he-bf', 'var(--color-ink)'], ['--he-bl', 'transparent']]));
    parts.push(block(at('.he-btn.bg-ink:hover'), [['--he-bf', 'var(--color-surface)']]));
  }

  const buttons = theme.buttons ?? {};
  const glow = buttons.glow;
  if (glow && (glow.size ?? 0) > 0) {
    const size = Math.max(0, Math.min(60, Math.round(glow.size ?? 0)));
    const colour = glow.color && isColor(glow.color) ? glow.color : 'color-mix(in srgb,var(--he-btn-primary-bg) 55%,transparent)';
    // 3.17 — a button with a fill of its own glows in it (`--he-btn-glow-c`).
    parts.push(block(at(':is(.he-btn-primary,.he-cbtn.is-primary)'), [['filter', `drop-shadow(0 0 ${size}px var(--he-btn-glow-c,${colour}))`]]));
  }
  if (buttons.font && buttons.font in FONT_STACKS) parts.push(block(scope ? scope.trim() : ':root', [['--he-btn-font', FONT_STACKS[buttons.font]!]]));
  if (buttons.icon === 'cell') {
    // The arrow in a compartment of its own: full height, a thin divider before it.
    parts.push(
      // `.he-btn`'s label is a text node, so its arrow is its only element; a library button's label is a span.
      block(`${at('.he-btn>svg:last-child')},${at('.he-cbtn:not(.is-text):not(.is-icon-only)>svg:last-child:not(:first-child)')}`, [
        ['box-sizing', 'content-box'],
        ['padding', 'var(--he-btn-py) 15px'],
        // 3.17 — the label centred between the edge and the divider: as much room after it as before (less its tracking).
        ['margin', 'calc(-1 * var(--he-btn-py)) calc(-1 * var(--he-btn-px)) calc(-1 * var(--he-btn-py)) max(4px, calc(var(--he-btn-px) - 10px - var(--he-btn-tracking, 0px)))'],
        ['border-left', buttons.divider === 'solid' ? '2px solid currentColor' : '1px solid color-mix(in srgb,currentColor 32%,transparent)'],
      ]),
    );
  }
  if (buttons.weight) parts.push(block(at(':is(.he-btn,.he-cbtn)'), [['font-weight', buttons.weight]]));

  // 3.9 — a variant's arrow in a colour of its own.
  for (const [variant, classes] of [
    ['primary', ['.he-btn-primary', '.he-cbtn.is-primary']],
    ['outline', ['.he-btn-outline', '.he-cbtn.is-outline']],
    ['ghost', ['.he-btn-ghost']],
  ] as const) {
    if (buttons[variant]?.arrow && isColor(buttons[variant]!.arrow!)) {
      parts.push(block(classes.map((c) => at(`${c}>svg:last-child`)).join(','), [['color', `var(--he-btn-${variant}-arrow)`]]));
    }
  }

  // 3.6 — the arrow turned to point up and right; only its drawing turns, so a cell's divider stays put.
  if (buttons.arrow === 'diagonal') {
    parts.push(
      block(`${at('.he-btn>svg:last-child>path')},${at('.he-cbtn:not(.is-text):not(.is-icon-only)>svg:last-child:not(:first-child)>path')}`, [
        ['transform-box', 'fill-box'],
        ['transform-origin', 'center'],
        // Turned, a horizontal arrow spans less; a little larger keeps it the size it was.
        ['transform', 'rotate(-45deg) scale(1.3)'],
      ]),
    );
  }
  // 3.6 — "Read more" as words alone.
  if (buttons.more === 'none') parts.push(block(at('.he-more__icon'), [['display', 'none']]));
  // 3.17.1 — the "Read more" links' own weight.
  if (buttons.moreWeight && ['400', '500', '600', '700', '800'].includes(buttons.moreWeight)) parts.push(block(at('.he-more'), [['font-weight', buttons.moreWeight]]));

  // 2.22 — every "Read more" arrow (`.he-more__icon`, an svg or a text arrow) on a small tinted circle.
  if (buttons.more === 'circle') {
    parts.push(
      block(at('.he-more__icon'), [
        ['display', 'inline-grid'],
        ['place-items', 'center'],
        ['box-sizing', 'content-box'],
        ['width', '14px'],
        ['height', '14px'],
        ['padding', '7px'],
        ['border-radius', '50%'],
        ['background', 'color-mix(in srgb,currentColor 14%,transparent)'],
        ['line-height', '1'],
        ['font-size', '12px'],
      ]),
    );
    parts.push(block(at('.he-more'), [['gap', '10px']]));
  }

  const eyebrow = theme.eyebrow ?? {};
  if (eyebrow.marker === 'none') parts.push(block(at('.he-eyebrow__rule'), [['display', 'none']]));
  if (eyebrow.marker === 'dot') {
    parts.push(block(at('.he-eyebrow__rule'), [['width', '6px'], ['height', '6px'], ['border-radius', '50%'], ['animation', 'none']]));
    parts.push(block(at('.he-eyebrow'), [['gap', '10px']]));
  }
  if (eyebrow.markerColor && isColor(eyebrow.markerColor)) parts.push(block(at('.he-eyebrow__rule'), [['background-color', eyebrow.markerColor]]));

  const panel = theme.panel ?? {};
  const panelDecls: Decl[] = [];
  push(panelDecls, '--he-panel-inset', panel.inset, isLength);
  push(panelDecls, '--he-panel-gap', panel.gap, isLength);
  push(panelDecls, '--he-panel-bg', panel.background, isColor);
  const panelCut = cutLegs(panel.shape, CUT_SIZES.panel);
  if (panelCut) panelDecls.push(['--he-panel-clip', cutPolygon(panelCut)]);
  if (panelDecls.length) parts.push(block(scope ? scope.trim() : ':root', panelDecls));

  const nav = theme.nav ?? {};
  const navDecls: Decl[] = [];
  if (nav.font && nav.font in FONT_STACKS) navDecls.push(['--he-nav-family', FONT_STACKS[nav.font]!]);
  push(navDecls, '--he-nav-size', nav.size, isLength);
  push(navDecls, '--he-nav-weight', nav.weight, isKeyword(['300', '400', '500', '600', '700']));
  push(navDecls, '--he-nav-transform', nav.transform, isKeyword(TRANSFORMS));
  push(navDecls, '--he-nav-tracking', nav.letterSpacing, isLength);
  push(navDecls, '--he-nav-gap', nav.gap, isLength);
  push(navDecls, '--he-nav-color', nav.color, isColor);
  push(navDecls, '--he-nav-active', nav.activeColor, isColor);
  // Unlayered, after the stylesheet's own defaults, which live in the components layer.
  if (navDecls.length) parts.push(block(scope ? scope.trim() : ':root', navDecls));

  return parts.join('');
}

function brandDecls(theme: Theme): Decl[] {
  const out: Decl[] = [];
  push(out, '--he-logo-height', theme.brand?.logoHeight, isLength);
  // 3.23 — the numbered pages under a list.
  const pager = theme.pager ?? {};
  if (pager.shape === 'square') out.push(['--he-pager-radius', '8px']);
  push(out, '--he-pager-active-bg', pager.activeBackground, isColor);
  push(out, '--he-pager-active-text', pager.activeText, isColor);
  push(out, '--he-pager-border', pager.border, isColor);
  if (pager.font === 'body') out.push(['--he-pager-family', 'inherit']);
  return out;
}

/* ── Assembly ─────────────────────────────────────────────────────────────── */

function block(selector: string, decls: Decl[]): string {
  if (decls.length === 0) return '';
  const body = decls.map(([property, value]) => `${property}:${value}`).join(';');
  return `${selector}{${body}}`;
}

export type ThemeCssOptions = {
  /** Where the properties are declared. `:root` for the live site. */
  selector?: string;
  /**
   * Emit the per-breakpoint overrides. The admin preview turns this off: it is
   * a fixed-width panel, so a real media query there would report the width of
   * the browser rather than of the thing being previewed.
   */
  responsive?: boolean;
};

/**
 * Render a theme as a stylesheet. Returns an empty string when the theme sets
 * nothing, so an untouched site ships no extra bytes at all.
 */
export function themeToCss(theme: Theme, options: ThemeCssOptions = {}): string {
  const selector = options.selector ?? ':root';
  const responsive = options.responsive ?? true;

  // A caller-supplied selector still ends up in a <style> element.
  const safeSelector = /^[a-zA-Z0-9_.#:\[\]="'-]+$/.test(selector) ? selector : ':root';

  const parts: string[] = [];

  const rootDecls: Decl[] = [
    ...colorDecls(theme),
    ...statusDecls(theme),
    ...layoutDecls(theme),
    ...typographyDecls(theme),
    ...buttonDecls(theme),
    ...brandDecls(theme),
  ];
  parts.push(block(safeSelector, rootDecls));

  if (responsive) {
    for (const { key, maxWidth } of BREAKPOINTS) {
      const decls = adaptiveDecls(theme, key);
      if (decls.length === 0) continue;
      parts.push(`@media (max-width:${maxWidth}px){${block(safeSelector, decls)}}`);
    }
  }

  // The visitor's alternate palette (GL6). The switch stamps data-scheme="alt"
  // on <html>; with the switch off nothing can stamp it, so these rules are
  // inert even when a palette is saved.
  if (theme.chrome?.themeToggle && safeSelector === ':root') {
    parts.push(block(':root[data-scheme="alt"]', colorDecls(theme, 'colorsAlt')));
  }

  /* 2.19 (T31) — the same palette on one section or one page: a section
     marked "alternate colours" in the Design panel carries this class. The
     tokens inherit, so everything inside it follows; emitted only once an
     alternate palette has been saved. */
  /* 3.22 — the properties that name a palette colour (a heading's colour is
     `var(--color-bone)`) were resolved once, at the root, so a section in
     another palette kept the page's heading, link and button colours. The
     section re-points each one the site has not set outright. */
  const own = new Set(rootDecls.map(([property]) => property));
  const followers: Decl[] = PALETTE_FOLLOWERS.filter(([property]) => !own.has(property));
  const alt = colorDecls(theme, 'colorsAlt');
  if (alt.length > 0 && safeSelector === ':root') {
    parts.push(block('.he-scheme-alt', [...alt, ['color', 'var(--color-bone)'], ...followers]));
  }
  // 3.22 — the second alternate palette, the same way.
  const alt2 = colorDecls(theme, 'colorsAlt2');
  if (alt2.length > 0 && safeSelector === ':root') {
    parts.push(block('.he-scheme-alt2', [...alt2, ['color', 'var(--color-bone)'], ...followers]));
  }

  parts.push(localeFontCss(theme, safeSelector));
  parts.push(shapeCss(theme, safeSelector === ':root' ? '' : `${safeSelector} `));
  parts.push(fieldCss(theme, safeSelector === ':root' ? '' : `${safeSelector} `));

  /* 3.3 — a panel's content lines up with the content outside panels: its
     shell gives back the panel's inset at every width. */
  if (theme.panel?.alignContent === true && safeSelector === ':root') {
    const shells = '.he-panel>.shell,.he-panel>*>.shell,.he-ftr.is-panel>.shell';
    const inset = 'min(var(--he-panel-inset,24px),3vw)';
    parts.push(`${shells}{padding-inline:max(12px,calc(var(--he-gutter-m,20px) - ${inset}))}`);
    parts.push(`@media (width>=48rem){${shells}{padding-inline:calc(32px - ${inset})}}`);
    parts.push(`@media (width>=64rem){${shells}{padding-inline:max(16px,calc(var(--spacing-gutter) - ${inset}))}}`);
  }

  if (safeSelector === ':root') parts.push(phoneLayoutCss(theme));

  /* 3.1 — no line under each section or above the footer. A section is a
     child of main, or the first thing inside its styled wrapper or row. */
  // 3.8 — headings fill each line before wrapping.
  if (theme.layout?.titleWrap === 'wrap') parts.push(`${safeSelector === ':root' ? '' : `${safeSelector} `}:is(h1,h2,h3,h4){text-wrap:wrap}`);

  /* 3.23 — a library block inside a column: no band padding of its own. Zero
     specificity, so a Design panel spacing (one class) still wins. */
  if (theme.layout?.nestedFlush === true && safeSelector === ':root') {
    parts.push(':where(.he-nested section){padding-block:0}');
    // 3.27 — and a slider in a column starts at the column's edge, as the blocks beside it do, not a page gutter in.
    parts.push(':where(.he-nested) .he-car__viewport:not(.is-edge) .he-car__track{--pad:0px}');
  }
  // 3.23 — the space under an eyebrow, before its heading.
  if (theme.layout?.eyebrowGap && isLength(theme.layout.eyebrowGap) && safeSelector === ':root') {
    parts.push(`.he-site .he-eyebrow{margin-bottom:${theme.layout.eyebrowGap}}`);
  }

  // 3.26 — rich text, set from the theme; unlayered, so it beats the `prose-edge` utility.
  if (safeSelector === ':root') {
    const rich = richTextCss(theme.richText);
    if (rich) parts.push(rich);
  }

  // 3.24 — text links under the pointer: an underline, or a line that sweeps out to the left and back in from the right.
  if (safeSelector === ':root') {
    const links = linkHoverCss(theme.links);
    if (links) parts.push(links);
  }

  if (theme.layout?.sectionRules === false && safeSelector === ':root') {
    // 3.23 — and the sections inside a project's or a post's article, which sit one level deeper.
    parts.push('#main>*,#main>[class*="he-b-"]>*,#main>article>*,#main>article>[class*="he-b-"]>*,.he-ftr{border-bottom-width:0}.he-ftr{border-top-width:0}');
  }

  // Link underline is a rule rather than a variable: there is no sensible
  // "unset" value for text-decoration that inherits correctly.
  if (theme.linkUnderline === true) {
    parts.push('.prose-edge a,.he-link{text-decoration:underline;text-underline-offset:2px}');
  }

  return parts.filter(Boolean).join('');
}

/**
 * 3.15 — the phone layout rules from Appearance → Layout. Each is written
 * only when set, and each loses to a section's own spacing in its Design tab:
 * the rules that could clash are `:where()` (no weight) or custom properties.
 *
 * - The side padding is `--he-gutter-m`, read by every shell (and, with
 *   aligned panels, by a panel's shell less the panel's inset), so all
 *   content lines up.
 * - The space between sections is a margin on every section after the
 *   first; the sections' own padding above and below goes, except a panel's,
 *   which is the room inside its box. A panel takes the space through
 *   `--he-panel-mt`/`--he-panel-mb`, which its margins read.
 * - The space between a section's parts is the gap under its heading, the
 *   intro's gap and `--he-gap`.
 */
function phoneLayoutCss(theme: Theme): string {
  const layout = theme.layout ?? {};
  const rules: string[] = [];
  const gutter = layout.gutterMobile;
  if (gutter && isLength(gutter)) rules.push(`:root{--he-gutter-m:${gutter}}`);
  const gap = layout.sectionGapMobile;
  if (gap && isLength(gap)) {
    rules.push(
      `:where(#main>*+*){margin-top:${gap}}`,
      // The band's padding sits on the section or, in the classic blocks, on its inner shell.
      ':where(#main>:not(.he-panel)),:where(#main>:not(.he-panel)>section),:where(#main>:not(.he-panel)>.shell),:where(#main>:not(.he-panel)>section>.shell){padding-block:0}',
      `#main>*{--he-panel-mt:${gap};--he-panel-mb:0px}`,
      '#main>:first-child{--he-panel-mt:initial}#main>:last-child{--he-panel-mb:initial}#main>* *{--he-panel-mt:initial;--he-panel-mb:initial}',
    );
  }
  // 3.17 — the space under the first section (the hero), after the rule above.
  const first = layout.firstGapMobile;
  if (first && isLength(first)) rules.push(`:where(#main>:first-child+*){margin-top:${first}}`, `#main>:first-child+*{--he-panel-mt:${first}}`);
  const item = layout.itemGapMobile;
  if (item && isLength(item)) {
    // A gap set for phones on its own (3.13) keeps the cards' gap.
    rules.push(`:root{${theme.gapMobile ? '' : `--he-gap:${item};`}--he-intro-gap:${item}}`, `.he-head{margin-bottom:0}.he-head+*{margin-top:${item}}`,
      // A heading that shares a grid with its content (the FAQ) has only the space above; two columns and several lists stack this far apart.
      ':is(div,section):has(>.he-head+*){row-gap:0}',
      `:is(.he-cols2,.he-lists){row-gap:${item}}`,
      // 3.15.1 — the heading column's last line keeps no margin of its own, so the gap is exactly the setting.
      '.he-cols2>:first-child>:last-child{margin-bottom:0}',
      // 3.16 — a list's small title is a heading too: the same space under it.
      `.he-ilist__title{margin-bottom:${item}}`,
    );
  }
  return rules.length ? `@media (max-width:768px){${rules.join('')}}` : '';
}

/* 3.24 — the text links a "link hover" reaches, each with what counts as pointing at it: a card's
   link line answers the whole card, which is the link. */
const LINK_TARGETS: readonly [target: string, hover: string][] = [
  ['.he-hdr__link', '.he-hdr__link:hover'],
  ['.he-ftr__links a', '.he-ftr__links a:hover'],
  ['.he-ftr__legal a', '.he-ftr__legal a:hover'],
  ['.he-menu__sub a', '.he-menu__sub a:hover'],
  ['.he-more', 'a:hover .he-more,.he-more:hover'],
  ['.he-fgrid__more', '.he-fgrid__item:hover .he-fgrid__more'],
  ['.he-card__more', 'a.he-card:hover .he-card__more'],
];

export function linkHoverCss(links: Theme['links']): string {
  const hover = links?.hover;
  if (hover !== 'underline' && hover !== 'sweep') return '';
  const width = links?.lineWidth && isLength(links.lineWidth) ? links.lineWidth : 'max(1px,0.08em)';
  const targets = LINK_TARGETS.map(([target]) => target).join(',');
  const hovers = LINK_TARGETS.map(([, on]) => on).join(',');
  if (hover === 'underline') {
    return `${hovers}{text-decoration:underline;text-decoration-thickness:${width};text-underline-offset:0.25em}`;
  }
  const still = hovers
    .split(',')
    .map((on) => `.he-reduce-motion ${on}`)
    .join(',');
  return (
    `:root{--he-sweep-w:${width}}` +
    `${targets}{background-image:linear-gradient(currentColor,currentColor);background-repeat:no-repeat;background-origin:content-box;background-position:0 100%;background-size:0% var(--he-sweep-w)}` +
    `${hovers}{animation:he-link-sweep calc(400ms * var(--he-motion,1)) cubic-bezier(0.58,0.3,0.005,1) forwards}` +
    '@keyframes he-link-sweep{0%{background-size:100% var(--he-sweep-w);background-position:0 100%}50%{background-size:0% var(--he-sweep-w);background-position:0 100%}50.01%{background-size:0% var(--he-sweep-w);background-position:100% 100%}100%{background-size:100% var(--he-sweep-w);background-position:100% 100%}}' +
    `@media (prefers-reduced-motion:reduce){${hovers}{animation:none;background-size:100% var(--he-sweep-w)}}` +
    `${still}{animation:none;background-size:100% var(--he-sweep-w)}`
  );
}

/* 3.26 — rich text from the theme. Each rule only when its value is set; the
   heading's space after it is written before the space above one, so a
   heading straight after another takes the space above. */
export function richTextCss(rich: Theme['richText']): string {
  if (!rich) return '';
  const len = (v: string | undefined) => (v && isLength(v) ? v : undefined);
  const out: string[] = [];
  if (rich.text === 'body') out.push('.prose-edge{font-size:var(--he-body-size);line-height:var(--he-body-line)}');
  const scale = rich.headingScale;
  if (typeof scale === 'number' && scale >= 0.5 && scale <= 1.5) {
    out.push(`.prose-edge h2{font-size:calc(var(--he-h2-size) * ${scale})}.prose-edge h3{font-size:calc(var(--he-h3-size) * ${scale})}`);
  }
  const gap = len(rich.paragraphGap);
  if (gap) out.push(`.prose-edge>*+*{margin-top:${gap}}`);
  const after = len(rich.headingBottom);
  if (after) out.push(`.prose-edge :is(h2,h3,h4)+*{margin-top:${after}}`);
  const top = len(rich.headingTop);
  if (top) out.push(`.prose-edge :is(h2,h3){margin-top:${top}}`);
  const subTop = len(rich.subheadingTop);
  if (subTop) out.push(`.prose-edge h4{margin-top:${subTop}}`);
  const indent = len(rich.listIndent);
  if (rich.listMarker === 'disc' || rich.listMarker === 'none') {
    out.push(`.prose-edge ul{list-style:${rich.listMarker === 'disc' ? 'disc' : 'none'};padding-left:${indent ?? (rich.listMarker === 'disc' ? '1.2em' : '0')}}.prose-edge ul>li{padding-left:0}.prose-edge ul>li::before{content:none}`);
  } else if (indent) {
    out.push(`.prose-edge ul>li{padding-left:${indent}}`);
  }
  if (indent) out.push(`.prose-edge ol{padding-left:${indent}}`);
  const listGap = len(rich.listGap);
  if (listGap) out.push(`.prose-edge li+li{margin-top:${listGap}}`);
  return out.join('');
}
