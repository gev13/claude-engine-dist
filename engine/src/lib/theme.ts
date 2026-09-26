import { z } from 'zod';
import { blogSchema } from './blog';
import { chromeSchema } from './chrome';
import { cornerShapeSchema } from './shape';
import { FONT_CATALOGUE, type CatalogueRole } from './fontCatalogue';

/** The entrances a section can play as it scrolls into view (SC4); blockStyle's REVEALS is this list. */
export const SECTION_REVEALS = ['fade', 'rise', 'zoom', 'left', 'right', 'blur'] as const;

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

/* ═══════════════════════════════════════════════════════════════════════════
   Meaning colours, which are not the brand
   ───────────────────────────────────────────────────────────────────────────
   Open, closed, warning, a star, a line on a chart. These were written into
   the stylesheets as literals, which was the right instinct and the wrong
   mechanism: a "success" green that follows a brand accent stops meaning
   success, so they must not simply become the palette — but a site whose own
   colours fight them had no recourse at all.

   So they are their own group, with the drawn-in values as defaults. A site
   that changes nothing gets exactly what it has today; a site that needs its
   amber to be a different amber can say so, without any of this being wired
   to the accent.
   ═══════════════════════════════════════════════════════════════════════════ */
export const STATUS_DEFAULTS = {
  success: '#3fb37f',
  warning: '#e0a030',
  danger: '#e05a4f',
  rating: '#f2b01e',
} as const;

/* The first follows the brand accent, the rest are fixed — read from
   `library-widgets.css`, where they are declared. */
export const CHART_DEFAULTS = ['#d94f2b', '#4a93d9', '#e0a030', '#3fb37f', '#9b6ad8', '#d85a9b'] as const;

const statusPalette = z.object({
  /** Open now, a success notice. */
  success: color.optional(),
  warning: color.optional(),
  /** Closed, a danger notice. */
  danger: color.optional(),
  /** The filled half of a star rating. */
  rating: color.optional(),
});

export type StatusPalette = z.infer<typeof statusPalette>;

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

  /**
   * The text sizes inside blocks.
   *
   * Separate from the `body` type role, which governs prose generally: these
   * are the sizes the block components were drawn with, and they are
   * deliberately not pointed at the body role, because doing so would move
   * every intro paragraph on every existing site by a pixel.
   */
  blockText: z
    .object({ lead: length.optional(), text: length.optional(), small: length.optional() })
    .optional(),

  /**
   * Site-wide spacing between the items a block lays out, and how fast
   * everything animates.
   *
   * Both are the same shape as the per-block controls in the Design tab and
   * are overridden by them. Unset means each block keeps the value it was
   * drawn with — which is why this is not a number with a default: a single
   * gap for every block would flatten spacing that differs on purpose.
   */
  motion: z.number().min(0).max(5).optional(),
  /**
   * 3.5 — the entrance every top-level section plays as it scrolls into view,
   * unless it chooses its own (or "none") in its Design tab. Unset: only the
   * sections that ask for one move, as before.
   */
  reveal: z.enum(SECTION_REVEALS).optional(),
  gap: length.optional(),

  /** Meaning colours — open, closed, warning, stars. Not the brand palette. */
  status: statusPalette.optional(),

  /**
   * The six series colours a chart cycles through.
   *
   * An array rather than six fields: their *order* is what a reader follows
   * between the chart and its legend, and six named fields would let somebody
   * set the fourth without ever seeing the first three.
   */
  chart: z.array(color).max(6).optional(),

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
      /** 2.21 — the buttons' own face; unset is the label face. */
      font: fontKey.optional(),
      /** 2.21 — a soft light round the primary button, in its own colour and size. */
      glow: z.object({ color: color.optional(), size: z.number().int().min(0).max(60).optional() }).optional(),
      /** 2.21 — a button's arrow inline (as before), or in a compartment of its own behind a thin divider. */
      icon: z.enum(['inline', 'cell']).optional(),
      /** 3.8 — the line before a compartmented arrow: soft (1px, faded, as before) or solid (2px, the label's colour). */
      divider: z.enum(['soft', 'solid']).optional(),
      /** 3.8 — the label's weight. */
      weight: z.enum(['400', '500', '600', '700']).optional(),
      /** 2.22 — a "Read more" link's arrow as it is, or on a small circle; (3.6) or none. */
      more: z.enum(['arrow', 'circle', 'none']).optional(),
      /** 3.6 — the buttons' arrow pointing right (as drawn) or up and to the right. */
      arrow: z.enum(['right', 'diagonal']).optional(),
    })
    .optional(),

  /**
   * 2.21 — corners, per kind of element: rounded (as before) or cut on the
   * diagonal. See lib/shape.ts.
   */
  shape: z
    .object({
      cards: cornerShapeSchema.optional(),
      buttons: cornerShapeSchema.optional(),
      inputs: cornerShapeSchema.optional(),
      chips: cornerShapeSchema.optional(),
      images: cornerShapeSchema.optional(),
    })
    .optional(),

  /**
   * 2.21 — what a section marked *Panel* in its Design tab looks like: inset
   * from the page's edges, its own colour, its own corners. The page around
   * the panels is the page colour.
   */
  panel: z
    .object({
      inset: length.optional(),
      gap: length.optional(),
      background: color.optional(),
      shape: cornerShapeSchema.optional(),
      /** 3.3 — a panel's content in line with the content outside it, the inset taken from its own padding. */
      alignContent: z.boolean().optional(),
    })
    .optional(),

  /** 2.21 — the small line that opens a section: its marker and the marker's colour. */
  eyebrow: z
    .object({
      marker: z.enum(['rule', 'dot', 'none']).optional(),
      markerColor: color.optional(),
    })
    .optional(),

  /** 2.21 — the header's links. Unset is mono, 11px, capitals, as before. */
  nav: z
    .object({
      font: fontKey.optional(),
      size: length.optional(),
      weight: z.enum(['300', '400', '500', '600', '700']).optional(),
      transform: z.enum(['none', 'uppercase', 'lowercase', 'capitalize']).optional(),
      letterSpacing: length.optional(),
      gap: length.optional(),
      color: color.optional(),
      activeColor: color.optional(),
    })
    .optional(),

  layout: z
    .object({
      containerWidth: length.optional(),
      gutter: length.optional(),
      radius: length.optional(),
      /** 3.1 — how wide a section's heading may run before it wraps (e.g. 820px or 32ch); unset keeps each block's own. */
      titleWidth: length.optional(),
      /** 3.1 — the thin line under each section and above the footer; unset (or true) keeps them. */
      sectionRules: z.boolean().optional(),
      /** 3.8 — headings balanced across their lines (as before) or filling each line before wrapping, as a layout tool would. */
      titleWrap: z.enum(['balance', 'wrap']).optional(),
      /** 3.8 — the space between a section's heading and its introduction, and how wide the introduction runs. */
      introGap: length.optional(),
      introWidth: length.optional(),
    })
    .optional(),

  /** 3.2 — the fill, edge and text of every text field and every unchosen choice chip. */
  fields: z
    .object({
      background: color.optional(),
      border: color.optional(),
      text: color.optional(),
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
