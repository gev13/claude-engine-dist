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
} from './theme';
import { CUT_BUTTON_BACKGROUND, cutLegs, cutLines, cutPolygon, cutVars } from './shape';

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
export function colorDecls(theme: Theme, which: 'colors' | 'colorsAlt' = 'colors'): Decl[] {
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
  return out;
}

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

    if (base.family && base.family in FONT_STACKS) {
      out.push([`--he-${role}-family`, FONT_STACKS[base.family]]);
    }
    push(out, `--he-${role}-size`, base.size, isLength);
    push(out, `--he-${role}-weight`, base.weight, isKeyword(WEIGHTS));
    push(out, `--he-${role}-style`, base.style, isKeyword(STYLES));
    push(out, `--he-${role}-color`, base.color, isColor);
    push(out, `--he-${role}-transform`, base.transform, isKeyword(TRANSFORMS));
    push(out, `--he-${role}-decoration`, base.decoration, isKeyword(DECORATIONS));
    push(out, `--he-${role}-line`, base.lineHeight, isLineHeight);
    push(out, `--he-${role}-tracking`, base.letterSpacing, isLength);
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
    push(out, `--he-${role}-size`, step.size, isLength);
    push(out, `--he-${role}-line`, step.lineHeight, isLineHeight);
    push(out, `--he-${role}-tracking`, step.letterSpacing, isLength);
  }

  const brand = theme.brand ?? {};
  if (breakpoint === 'mobile') push(out, '--he-logo-height', brand.logoHeightMobile, isLength);

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
  if (field.length === 0) return '';
  const chip = field.filter(([property]) => property !== 'color');
  return block(`${scope}${INPUT_SELECTOR}`, field) + (chip.length ? block(`${scope}.he-fb__choice input:not(:checked)+span`, chip) : '');
}

function shapeCss(theme: Theme, scope: string): string {
  const parts: string[] = [];
  const shape = theme.shape ?? {};
  const at = (selector: string) => `${scope}${selector}`;

  // Cards clip through a variable every card rule already carries (`clip-path: var(--he-card-clip, none)`).
  const card = cutLegs(shape.cards, CUT_SIZES.cards);
  if (card) parts.push(block(scope ? scope.trim() : ':root', [['--he-card-radius', '0px'], ['--he-card-clip', cutPolygon(card)]]));

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
    parts.push(block(at(BUTTON_SELECTOR), [...cutVars(button), ['background', CUT_BUTTON_BACKGROUND], ['border-color', 'transparent'], ['border-radius', '0']]));
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
    parts.push(block(at(':is(.he-btn-primary,.he-cbtn.is-primary)'), [['filter', `drop-shadow(0 0 ${size}px ${colour})`]]));
  }
  if (buttons.font && buttons.font in FONT_STACKS) parts.push(block(scope ? scope.trim() : ':root', [['--he-btn-font', FONT_STACKS[buttons.font]!]]));
  if (buttons.icon === 'cell') {
    // The arrow in a compartment of its own: full height, a thin divider before it.
    parts.push(
      // `.he-btn`'s label is a text node, so its arrow is its only element; a library button's label is a span.
      block(`${at('.he-btn>svg:last-child')},${at('.he-cbtn:not(.is-text):not(.is-icon-only)>svg:last-child:not(:first-child)')}`, [
        ['box-sizing', 'content-box'],
        ['padding', 'var(--he-btn-py) 15px'],
        ['margin', 'calc(-1 * var(--he-btn-py)) calc(-1 * var(--he-btn-px)) calc(-1 * var(--he-btn-py)) 6px'],
        ['border-left', '1px solid color-mix(in srgb,currentColor 32%,transparent)'],
      ]),
    );
  }

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

  parts.push(
    block(safeSelector, [
      ...colorDecls(theme),
      ...statusDecls(theme),
      ...layoutDecls(theme),
      ...typographyDecls(theme),
      ...buttonDecls(theme),
      ...brandDecls(theme),
    ]),
  );

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
  const alt = colorDecls(theme, 'colorsAlt');
  if (alt.length > 0 && safeSelector === ':root') {
    parts.push(block('.he-scheme-alt', [...alt, ['color', 'var(--color-bone)']]));
  }

  parts.push(localeFontCss(theme, safeSelector));
  parts.push(shapeCss(theme, safeSelector === ':root' ? '' : `${safeSelector} `));
  parts.push(fieldCss(theme, safeSelector === ':root' ? '' : `${safeSelector} `));

  /* 3.1 — no line under each section or above the footer. A section is a
     child of main, or the first thing inside its styled wrapper or row. */
  if (theme.layout?.sectionRules === false && safeSelector === ':root') {
    parts.push('#main>*,#main>[class*="he-b-"]>*,.he-ftr{border-bottom-width:0}.he-ftr{border-top-width:0}');
  }

  // Link underline is a rule rather than a variable: there is no sensible
  // "unset" value for text-decoration that inherits correctly.
  if (theme.linkUnderline === true) {
    parts.push('.prose-edge a,.he-link{text-decoration:underline;text-underline-offset:2px}');
  }

  return parts.filter(Boolean).join('');
}
