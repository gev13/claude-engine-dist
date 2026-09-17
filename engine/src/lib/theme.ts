import { z } from 'zod';
import { blogSchema } from './blog';
import { chromeSchema } from './chrome';
import { FONT_CATALOGUE, type CatalogueRole } from './fontCatalogue';

/* ═══════════════════════════════════════════════════════════════════════════
   Global theme
   ───────────────────────────────────────────────────────────────────────────
   The site's design tokens, editable from Appearance in the admin and stored
   as a single `theme` row in the settings table.

   Two rules govern everything in this file.

   1. The defaults below reproduce the mockup values exactly. A site with no
      saved theme renders identically to one that never had this feature, so
      turning the theme on changes nothing until somebody edits it.

   2. Every value here is interpolated into a <style> element. A value that is
      not validated is a CSS injection, so each field is constrained by an
      allowlist or a strict pattern — never by a "looks fine" string check.
      `themeToCss` validates a second time at render, and drops anything that
      does not pass rather than emitting it.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── Value grammars ───────────────────────────────────────────────────────── */

/**
 * Colours: hex, or an rgb/rgba/hsl/hsla function whose arguments are numbers,
 * percentages and separators only. Deliberately excludes url(), var() and
 * anything that could carry a declaration terminator.
 */
const COLOR_PATTERN =
  /^(#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})|(?:rgb|rgba|hsl|hsla)\(\s*[0-9.,%\s/deg-]+\))$/;

/** A single length: a number with an optional unit, or a bare 0. */
const LENGTH_UNIT = '(?:px|rem|em|%|vw|vh|vmin|vmax|ch|ex|pt)';
const SIMPLE_LENGTH = `-?\\d*\\.?\\d+${LENGTH_UNIT}?`;

/**
 * A length, or a clamp()/min()/max() of two or three simple lengths. Fluid
 * type is the whole point of the mockup's `clamp(36px, 7vw, 66px)` sizes, so
 * the grammar has to allow it — but only in that exact shape.
 */
const LENGTH_PATTERN = new RegExp(
  `^(?:${SIMPLE_LENGTH}|(?:clamp|min|max)\\(\\s*${SIMPLE_LENGTH}\\s*,\\s*${SIMPLE_LENGTH}\\s*(?:,\\s*${SIMPLE_LENGTH}\\s*)?\\))$`,
);

/** Line height: unitless ratio (1.62) or a length (24px). */
const LINE_HEIGHT_PATTERN = new RegExp(`^(?:\\d*\\.?\\d+|${SIMPLE_LENGTH})$`);

/** The two keywords a button or border legitimately needs. */
const COLOR_KEYWORDS = new Set(['transparent', 'currentColor']);

export function isColor(value: string): boolean {
  const trimmed = value.trim();
  return COLOR_KEYWORDS.has(trimmed) || COLOR_PATTERN.test(trimmed);
}

export function isLength(value: string): boolean {
  return LENGTH_PATTERN.test(value.trim());
}

/**
 * A bare number means pixels.
 *
 * Typing `56` in a padding field is what everybody does, and it used to be
 * accepted, stored, and emitted as `padding-top: 56` — which is not valid CSS,
 * so the browser dropped the declaration and the padding simply never
 * appeared. Nothing said why.
 *
 * So a unitless number is completed to `px` here, at the schema, which means
 * values already saved as `56` start working on the next render rather than
 * needing to be typed again. Zero keeps its unit optional, because `0` is
 * legal CSS on its own.
 */
export function normaliseLength(value: string): string {
  const trimmed = value.trim();
  if (!/^-?\d*\.?\d+$/.test(trimmed)) return trimmed;
  return Number(trimmed) === 0 ? '0' : `${trimmed}px`;
}

/** A length that has a unit, or is zero. What may actually reach a stylesheet. */
export function isUsableLength(value: string): boolean {
  const trimmed = value.trim();
  if (!isLength(trimmed)) return false;
  return Number(trimmed) === 0 || !/^-?\d*\.?\d+$/.test(trimmed);
}

export function isLineHeight(value: string): boolean {
  return LINE_HEIGHT_PATTERN.test(value.trim());
}

const color = z.string().trim().refine(isColor, 'Not a valid colour');
const length = z.string().trim().transform(normaliseLength).refine(isLength, 'Not a valid CSS length');
const lineHeight = z.string().trim().refine(isLineHeight, 'Not a valid line height');

/* ── Font families ────────────────────────────────────────────────────────────
   An allowlist, not a free-text family name. The fonts are self-hosted and
   subset so that the CSP needs no third-party origin and the LCP budget holds;
   letting an editor name an arbitrary Google font would quietly break both.
   Adding a face means adding it to public/fonts, to fonts.css, and here.
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * The five the engine was built with: three self-hosted brand faces and two
 * that resolve to whatever the reader's device has.
 *
 * These keep their short names because they are stored in every theme and
 * every block style already written — `display` means Bricolage Grotesque and
 * always will.
 */
export const BRAND_STACKS = {
  display: "'Bricolage Grotesque', 'Archivo', system-ui, sans-serif",
  sans: "'Archivo', system-ui, -apple-system, sans-serif",
  mono: "'JetBrains Mono', ui-monospace, 'SFMono-Regular', monospace",
  system: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  serif: "Georgia, 'Times New Roman', Times, serif",
} as const;

/** What a catalogue family falls back to while its file loads, or if it fails. */
const FALLBACK: Record<CatalogueRole, string> = {
  sans: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  serif: "Georgia, 'Times New Roman', Times, serif",
  display: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  mono: "ui-monospace, 'SFMono-Regular', monospace",
};

/**
 * Every face an editor may choose: the five above plus the self-hosted Google
 * Fonts catalogue.
 *
 * Built from `fontCatalogue.ts`, which `scripts/fetch-fonts.mjs` generates
 * beside the files themselves — so a family cannot be offered unless its
 * `.woff2` is actually on disk, which is the mistake this arrangement exists
 * to make impossible.
 */
export const FONT_STACKS: Record<string, string> = {
  ...BRAND_STACKS,
  ...Object.fromEntries(FONT_CATALOGUE.map((f) => [f.key, `'${f.family}', ${FALLBACK[f.role]}`])),
};

export type FontKey = string;

export const FONT_LABELS: Record<FontKey, string> = {
  display: 'Bricolage Grotesque (display)',
  sans: 'Archivo (body)',
  mono: 'JetBrains Mono (labels)',
  system: 'System sans',
  serif: 'Serif',
  ...Object.fromEntries(FONT_CATALOGUE.map((f) => [f.key, f.family])),
};

/** What each face is for, so a picker can group fifty of them usefully. */
export const FONT_ROLES: Record<FontKey, CatalogueRole> = {
  display: 'display',
  sans: 'sans',
  mono: 'mono',
  system: 'sans',
  serif: 'serif',
  ...Object.fromEntries(FONT_CATALOGUE.map((f) => [f.key, f.role])),
};

/** The five the engine ships with, which need no download. */
export const BRAND_KEYS = Object.keys(BRAND_STACKS) as FontKey[];

/**
 * A face, checked against the list rather than typed.
 *
 * It is interpolated into a `<style>` element, so it stays an allowlist —
 * the list is simply longer now, and generated.
 */
const fontKey = z.string().refine((value) => value in FONT_STACKS, 'Not a font this site has');

/* ── Typography ───────────────────────────────────────────────────────────── */

export const TYPE_ROLES = ['body', 'lede', 'eyebrow', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const;
export type TypeRole = (typeof TYPE_ROLES)[number];

export const TYPE_ROLE_LABELS: Record<TypeRole, string> = {
  body: 'Body text',
  lede: 'Lede / pull quote',
  eyebrow: 'Eyebrow label',
  h1: 'H1',
  h2: 'H2',
  h3: 'H3',
  h4: 'H4',
  h5: 'H5',
  h6: 'H6',
};

/**
 * Breakpoints, widest first. These are max-widths: `tablet` styles apply at
 * 1024px and below. They mirror the Tailwind breakpoints the components
 * already use, so a theme override and a utility class never disagree.
 *
 * Four tiers in all: the base values are the large desktop (wider than
 * 1440px), then these three. The key stays `laptop` because it is stored in
 * saved themes and page styles; only the label changed.
 */
export const BREAKPOINTS = [
  { key: 'laptop', label: 'Desktop', maxWidth: 1440 },
  { key: 'tablet', label: 'Tablet', maxWidth: 1024 },
  { key: 'mobile', label: 'Mobile', maxWidth: 768 },
] as const;

/** What each tier is called in the admin, base included. */
export const TIER_LABELS = {
  base: 'Large desktop',
  laptop: 'Desktop',
  tablet: 'Tablet',
  mobile: 'Mobile',
} as const;

export type BreakpointKey = (typeof BREAKPOINTS)[number]['key'];

const typeStyle = z.object({
  family: fontKey.optional(),
  size: length.optional(),
  weight: z.enum(['100', '200', '300', '400', '500', '600', '700', '800', '900']).optional(),
  style: z.enum(['normal', 'italic']).optional(),
  color: color.optional(),
  transform: z.enum(['none', 'uppercase', 'lowercase', 'capitalize']).optional(),
  decoration: z.enum(['none', 'underline', 'line-through']).optional(),
  lineHeight: lineHeight.optional(),
  letterSpacing: length.optional(),
});

export type TypeStyle = z.infer<typeof typeStyle>;

/** Per breakpoint only the values worth re-stating responsively. */
const adaptiveTypeStyle = z.object({
  size: length.optional(),
  lineHeight: lineHeight.optional(),
  letterSpacing: length.optional(),
});

export type AdaptiveTypeStyle = z.infer<typeof adaptiveTypeStyle>;

const typeRoleSchema = z.object({
  base: typeStyle.optional(),
  laptop: adaptiveTypeStyle.optional(),
  tablet: adaptiveTypeStyle.optional(),
  mobile: adaptiveTypeStyle.optional(),
});

export type TypeRoleSettings = z.infer<typeof typeRoleSchema>;

/* ── Buttons ──────────────────────────────────────────────────────────────── */

export const BUTTON_VARIANTS = ['primary', 'outline', 'ghost'] as const;
export type ButtonVariant = (typeof BUTTON_VARIANTS)[number];

export const BUTTON_VARIANT_LABELS: Record<ButtonVariant, string> = {
  primary: 'Primary (filled)',
  outline: 'Outline',
  ghost: 'Ghost (text only)',
};

const buttonStyle = z.object({
  background: color.optional(),
  text: color.optional(),
  border: color.optional(),
  /** Kept separate from the colour so a variant's geometry stays deliberate. */
  borderWidth: length.optional(),
  hoverBackground: color.optional(),
  hoverText: color.optional(),
  hoverBorder: color.optional(),
});

/* ── The theme ────────────────────────────────────────────────────────────── */

const palette = z.object({
  background: color.optional(),
  surface: color.optional(),
  surfaceRaised: color.optional(),
  textPrimary: color.optional(),
  textBody: color.optional(),
  textMuted: color.optional(),
  primary: color.optional(),
  primaryHover: color.optional(),
  primarySoft: color.optional(),
  hairline: color.optional(),
  rule: color.optional(),
  link: color.optional(),
  linkHover: color.optional(),
  selection: color.optional(),
});

export type Palette = z.infer<typeof palette>;

/** The three family variables, any of which a language may override. */
const localeFontSchema = z.object({
  display: fontKey.optional(),
  sans: fontKey.optional(),
  mono: fontKey.optional(),
});

export const themeSchema = z.object({
  colors: palette.optional(),

  /**
   * The second palette a visitor can switch to when the light/dark switch is
   * on (GL6). Only the colours that differ need setting; the rest inherit.
   */
  colorsAlt: palette.optional(),

  /** Header, menus, footer and site-wide features — see src/lib/chrome.ts. */
  chrome: chromeSchema.optional(),

  /** The blog's list and post layouts — see src/lib/blog.ts. */
  blog: blogSchema.optional(),

  linkUnderline: z.boolean().optional(),

  /**
   * The typeface each language uses, when one face cannot draw them all.
   *
   * Package 8 said "no per-locale theme — one design, three languages", and
   * that still holds for the palette and the layout. A typeface is the
   * exception, because a face that has no Armenian glyphs is not a design
   * choice being overridden: it is a page rendering in whatever the reader's
   * device happened to substitute. This narrows the rule rather than breaking
   * it — only the three family variables move, and only per language.
   *
   * Keyed by locale; a language with no entry uses the site's own fonts.
   */
  localeFonts: z.record(z.string().trim().min(2).max(5), localeFontSchema).optional(),

  typography: z
    .object(
      Object.fromEntries(TYPE_ROLES.map((r) => [r, typeRoleSchema.optional()])) as {
        [K in TypeRole]: z.ZodOptional<typeof typeRoleSchema>;
      },
    )
    .optional(),

  buttons: z
    .object({
      radius: length.optional(),
      paddingX: length.optional(),
      paddingY: length.optional(),
      fontSize: length.optional(),
      letterSpacing: length.optional(),
      transform: z.enum(['none', 'uppercase', 'lowercase', 'capitalize']).optional(),
      primary: buttonStyle.optional(),
      outline: buttonStyle.optional(),
      ghost: buttonStyle.optional(),
    })
    .optional(),

  layout: z
    .object({
      containerWidth: length.optional(),
      gutter: length.optional(),
      radius: length.optional(),
    })
    .optional(),

  brand: z
    .object({
      /** `mark` keeps the built-in placeholder mark; `image` uses the uploaded logo. */
      logoType: z.enum(['mark', 'image']).optional(),
      logoUrl: z.string().max(500).optional(),
      logoMobileUrl: z.string().max(500).optional(),
      logoHeight: length.optional(),
      logoHeightMobile: length.optional(),
      wordmark: z.string().max(60).optional(),
      showWordmark: z.boolean().optional(),
      faviconUrl: z.string().max(500).optional(),
    })
    .optional(),
});

export type Theme = z.infer<typeof themeSchema>;
export type ThemeInput = z.input<typeof themeSchema>;

/** An empty theme: every field unset, so every default in the CSS wins. */
export const emptyTheme: Theme = themeSchema.parse({});

/**
 * Parse a stored value. Like `parseBlock`, this never throws — a malformed
 * theme row degrades to the built-in design rather than taking the site down.
 */
export function parseTheme(value: unknown): Theme {
  const result = themeSchema.safeParse(value ?? {});
  return result.success ? result.data : emptyTheme;
}
