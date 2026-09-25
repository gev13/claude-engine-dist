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

  // Link underline is a rule rather than a variable: there is no sensible
  // "unset" value for text-decoration that inherits correctly.
  if (theme.linkUnderline === true) {
    parts.push('.prose-edge a,.he-link{text-decoration:underline;text-underline-offset:2px}');
  }

  return parts.filter(Boolean).join('');
}
