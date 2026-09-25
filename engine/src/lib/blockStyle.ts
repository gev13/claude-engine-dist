import { z } from 'zod';
import { FONT_STACKS, isColor, isLength, normaliseLength } from './theme';

/* ═══════════════════════════════════════════════════════════════════════════
   Per-section style
   ───────────────────────────────────────────────────────────────────────────
   Every block carries an optional `style`. It is the equivalent of WPBakery's
   Design Options panel, with two deliberate differences documented in
   docs/builder-model.md: spacing is per-breakpoint, and there is no free-text
   CSS escape hatch.

   The same rule as the theme applies, and for the same reason — these values
   are rendered into a <style> element, so every one of them is constrained by
   a grammar or an allowlist, and `blockStyleToCss` re-checks before emitting.
   ═══════════════════════════════════════════════════════════════════════════ */

export const color = z.string().trim().refine(isColor, 'Not a valid colour');
export const length = z.string().trim().transform(normaliseLength).refine(isLength, 'Not a valid CSS length');

/** Widths a section can occupy. Named, rather than WPBakery's stretch modes. */
export const SECTION_WIDTHS = ['narrow', 'standard', 'wide', 'full'] as const;
export type SectionWidth = (typeof SECTION_WIDTHS)[number];

export const SECTION_WIDTH_LABELS: Record<SectionWidth, string> = {
  narrow: 'Narrow — a reading column',
  standard: 'Standard — the site container',
  wide: 'Wide — a broader container',
  full: 'Full width — edge to edge',
};

/** Breakpoints, mirroring the theme's so the two never disagree. */
export const STYLE_BREAKPOINTS = ['laptop', 'tablet', 'mobile'] as const;

/** Every tier, the widest first — what `hideAt` names (2.19). */
export const VISIBILITY_TIERS = ['base', 'laptop', 'tablet', 'mobile'] as const;
export type VisibilityTier = (typeof VISIBILITY_TIERS)[number];

/**
 * The tiers a block is hidden on: `hideAt` as saved, or the old `hideOn`
 * read as it always rendered — hidden at that width and every narrower one.
 */
export function hiddenTiers(style: { hideAt?: readonly VisibilityTier[]; hideOn?: readonly (typeof STYLE_BREAKPOINTS)[number][] } | undefined): VisibilityTier[] {
  if (!style) return [];
  if (style.hideAt) return [...style.hideAt];
  if (!style.hideOn?.length) return [];
  const widest = Math.min(...style.hideOn.map((bp) => VISIBILITY_TIERS.indexOf(bp)));
  return VISIBILITY_TIERS.slice(widest);
}
export type StyleBreakpoint = (typeof STYLE_BREAKPOINTS)[number];

export const box = z.object({
  marginTop: length.optional(),
  marginRight: length.optional(),
  marginBottom: length.optional(),
  marginLeft: length.optional(),
  paddingTop: length.optional(),
  paddingRight: length.optional(),
  paddingBottom: length.optional(),
  paddingLeft: length.optional(),
});

export type SpacingBox = z.infer<typeof box>;

export const BOX_SIDES = [
  ['marginTop', 'Margin top'],
  ['marginRight', 'Margin right'],
  ['marginBottom', 'Margin bottom'],
  ['marginLeft', 'Margin left'],
  ['paddingTop', 'Padding top'],
  ['paddingRight', 'Padding right'],
  ['paddingBottom', 'Padding bottom'],
  ['paddingLeft', 'Padding left'],
] as const satisfies readonly (readonly [keyof SpacingBox, string])[];

const BORDER_STYLES = ['none', 'solid', 'dashed', 'dotted', 'double'] as const;
export type BorderStyle = (typeof BORDER_STYLES)[number];

const BACKGROUND_SIZES = ['cover', 'contain', 'auto'] as const;
const BACKGROUND_POSITIONS = ['center', 'top', 'bottom', 'left', 'right'] as const;
const BACKGROUND_REPEATS = ['no-repeat', 'repeat', 'repeat-x', 'repeat-y'] as const;

/* ── Effects (package 3, phase C) ─────────────────────────────────────────── */

export const REVEALS = ['fade', 'rise', 'zoom', 'left', 'right', 'blur'] as const;
export const REVEAL_DELAYS = [100, 200, 300, 500, 800] as const;
export const HOVER_EFFECTS = ['lift', 'grow', 'shadow', 'tilt'] as const;
export const DIVIDER_SHAPES = ['wave', 'curve', 'tilt', 'triangle', 'zigzag', 'arrow'] as const;
export const GRADIENT_ANGLES = ['0', '45', '90', '135', '180', '225', '270', '315'] as const;

/** P3-C3 — a shape drawn over the top or bottom edge, in the neighbouring section's colour. */
const dividerShape = z.object({
  kind: z.enum(DIVIDER_SHAPES),
  color: color.optional(),
  height: z.enum(['small', 'medium', 'large']).optional(),
  flip: z.boolean().optional(),
});

/** A section-level typography override — the same shape the theme uses. */
const typeOverride = z.object({
  family: z.enum(['display', 'sans', 'mono', 'system', 'serif']).optional(),
  size: length.optional(),
  weight: z.enum(['100', '200', '300', '400', '500', '600', '700', '800', '900']).optional(),
  color: color.optional(),
  lineHeight: z.string().trim().optional(),
  letterSpacing: length.optional(),
  transform: z.enum(['none', 'uppercase', 'lowercase', 'capitalize']).optional(),
  align: z.enum(['left', 'center', 'right']).optional(),
});

export type TypeOverride = z.infer<typeof typeOverride>;

/* ── Columns ──────────────────────────────────────────────────────────────────
   Widths are twelfths, the same denominator the reference builder uses, so a
   layout described as "3/4 + 1/4" translates directly.
   ──────────────────────────────────────────────────────────────────────────── */

export const COLUMN_SPANS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
export type ColumnSpan = (typeof COLUMN_SPANS)[number];

const span = z.union(COLUMN_SPANS.map((n) => z.literal(n)) as [z.ZodLiteral<1>, z.ZodLiteral<2>, ...z.ZodLiteral<number>[]]);

/**
 * A column's width. `base` is required; a breakpoint overrides it at that width
 * and below, and an unset breakpoint inherits the next one up — so the common
 * case, "full width on mobile", is one value rather than three.
 */
export const columnWidthSchema = z.object({
  base: span,
  laptop: span.optional(),
  tablet: span.optional(),
  mobile: span.optional(),
});

export type ColumnWidth = z.infer<typeof columnWidthSchema>;

/**
 * Where a column sits at the smaller tiers (2.19) — "the picture first on a
 * phone" in a row of three, which `reverseOnMobile` cannot say. Each tier
 * inherits from the one above, like a width; unset everywhere is the order
 * the columns were written in.
 */
const place = z.number().int().min(1).max(6);
export const columnOrderSchema = z.object({
  laptop: place.optional(),
  tablet: place.optional(),
  mobile: place.optional(),
});

export type ColumnOrder = z.infer<typeof columnOrderSchema>;

/** The layout presets offered in the editor, mirroring the reference builder. */
export const COLUMN_PRESETS: { label: string; spans: ColumnSpan[] }[] = [
  { label: '1/1', spans: [12] },
  { label: '1/2 + 1/2', spans: [6, 6] },
  { label: '2/3 + 1/3', spans: [8, 4] },
  { label: '1/3 + 2/3', spans: [4, 8] },
  { label: '3/4 + 1/4', spans: [9, 3] },
  { label: '1/4 + 3/4', spans: [3, 9] },
  { label: '1/3 + 1/3 + 1/3', spans: [4, 4, 4] },
  { label: '1/4 + 1/2 + 1/4', spans: [3, 6, 3] },
  { label: '1/4 × 4', spans: [3, 3, 3, 3] },
  { label: '1/6 × 6', spans: [2, 2, 2, 2, 2, 2] },
];

/** A section's video background: a file in the media library, nothing else (2.17). */
export const SECTION_VIDEO = /^\/media\/[A-Za-z0-9._\-/]+\.(mp4|webm)$/;

export const blockStyleSchema = z.object({
  /** Admin-only label, so a long page is navigable in the builder. */
  label: z.string().max(80).optional(),

  width: z.enum(SECTION_WIDTHS).optional(),

  /** Base applies everywhere; a breakpoint overrides it at that width and below. */
  spacing: z
    .object({
      base: box.optional(),
      laptop: box.optional(),
      tablet: box.optional(),
      mobile: box.optional(),
    })
    .optional(),

  background: z
    .object({
      color: color.optional(),
      imageUrl: z.string().max(500).optional(),
      size: z.enum(BACKGROUND_SIZES).optional(),
      position: z.enum(BACKGROUND_POSITIONS).optional(),
      repeat: z.enum(BACKGROUND_REPEATS).optional(),
      /**
       * `fixed` is the parallax effect: the background stays put while the
       * section scrolls over it. Implemented in CSS with no JavaScript, and
       * disabled on touch and for reduced-motion users, where a fixed
       * attachment either does not work or is actively unpleasant.
       */
      attachment: z.enum(['scroll', 'fixed']).optional(),
      /** Laid over the image so text stays readable. */
      overlay: color.optional(),
      /**
       * 2.17 — a film behind the section: muted, looped, playing only while
       * on screen and never by itself for a visitor who wants less motion.
       * Uploaded files only; `videoPoster` shows until it plays, and instead
       * of it where it does not.
       */
      videoUrl: z.string().regex(SECTION_VIDEO, 'An mp4 or webm from the media library').optional(),
      /** A lighter film for phones. */
      videoMobileUrl: z.string().regex(SECTION_VIDEO, 'An mp4 or webm from the media library').optional(),
      videoPoster: z.string().max(500).optional(),
      /** `poster` shows only the poster on phones — and every visitor with data saver on gets it anyway. */
      videoMobile: z.enum(['video', 'poster']).optional(),
      /** P3-C4 — a gradient, used when there is no image; it can drift slowly. Drawn once both ends are set. */
      gradient: z
        .object({
          from: color.optional(),
          to: color.optional(),
          via: color.optional(),
          angle: z.enum(GRADIENT_ANGLES).optional(),
          animate: z.boolean().optional(),
        })
        .optional(),
    })
    .optional(),

  border: z
    .object({
      topWidth: length.optional(),
      rightWidth: length.optional(),
      bottomWidth: length.optional(),
      leftWidth: length.optional(),
      color: color.optional(),
      style: z.enum(BORDER_STYLES).optional(),
      radius: length.optional(),
    })
    .optional(),

  typography: z
    .object({
      heading: typeOverride.optional(),
      body: typeOverride.optional(),
    })
    .optional(),

  /**
   * SC4 — plays once as the section scrolls into view. The section renders
   * visible; the effect is armed in the browser only when motion is allowed,
   * and never for anything already on screen.
   */
  reveal: z.enum(REVEALS).optional(),
  /** P3-C1 — milliseconds before the entrance plays, for sections that follow one another. */
  revealDelay: z.union([z.literal(100), z.literal(200), z.literal(300), z.literal(500), z.literal(800)]).optional(),

  /** P3-C2 — how the block answers the pointer; `tilt` leans towards it. */
  hover: z.enum(HOVER_EFFECTS).optional(),

  /** P3-C3 — shape dividers along the top and bottom edges. */
  shapeTop: dividerShape.optional(),
  shapeBottom: dividerShape.optional(),

  /** P3-C5 — stays in view while its row, or the page, scrolls past. */
  sticky: z.boolean().optional(),

  /** 2.19 (T31) — the site's alternate palette on this section, every colour at once. */
  scheme: z.enum(['alt']).optional(),
  /** P3-C5 — the page settles on this block when scrolling stops near it. */
  snap: z.boolean().optional(),

  /**
   * P10-C — below this width the block's grid becomes a swipeable track.
   *
   * Three or four things across on a desktop, one at a time under a thumb on
   * a phone: the layout the design asks for, and the reason it is a *style*
   * rather than an option on six separate blocks. Every block with a grid in
   * it gets this, and a row gets it for its columns.
   *
   * CSS only — scroll-snap, which the browser drives. Nothing is hidden, so
   * every card stays in the DOM, in the tab order, and reachable by a screen
   * reader; focusing one scrolls it into view for free. A JavaScript carousel
   * that renders one slide at a time buys animation and pays for it in
   * everything above.
   */
  /**
   * The space between the items this block lays out.
   *
   * One value reaching every grid in the block, through an inherited custom
   * property — not the inline spacing inside it: an icon beside a word keeps
   * the distance it was drawn with, because that is not what anybody means
   * by "space between items".
   */
  gap: length.optional(),

  /**
   * How fast this block animates, as a multiple of the drawn-in timings.
   *
   * A multiplier rather than a duration, because a block has several — a
   * hover at 150ms, an entrance at 600ms — and one duration for all of them
   * would flatten a deliberate difference. `1` is what is drawn today.
   */
  motion: z.number().min(0).max(5).optional(),

  swipeOn: z.enum(STYLE_BREAKPOINTS).optional(),

  /** Hidden at these widths and below — how visibility was stored before 2.19; still read. */
  hideOn: z.array(z.enum(STYLE_BREAKPOINTS)).max(3).optional(),
  /**
   * 2.19 (T32) — hidden on exactly these tiers, each on its own: a block can
   * show on phones only. Wins over `hideOn`, which the editor replaces with
   * this the first time visibility is changed.
   */
  hideAt: z.array(z.enum(VISIBILITY_TIERS)).max(4).optional(),

  /** Kept out of the render entirely, without being deleted. */
  disabled: z.boolean().optional(),

  /**
   * Classes of your own, for the custom CSS to aim at.
   *
   * The vocabulary above is closed on purpose, and this is the deliberate
   * door out of it: a name here plus a rule in the page's or the site's
   * custom CSS. Space-separated, letters, digits, dashes and underscores —
   * enough to be a class name, not enough to close the attribute or start
   * another one.
   */
  className: z
    .string()
    .trim()
    .max(120)
    .regex(/^[A-Za-z_-][A-Za-z0-9_ -]*$/, 'Letters, digits, dashes and underscores; separate several with spaces')
    .optional(),

  /** Anchor target. Not a styling hook — the vocabulary above is closed. */
  anchorId: z
    .string()
    .max(60)
    .regex(/^[A-Za-z][A-Za-z0-9_-]*$/, 'Must start with a letter; letters, digits, - and _ only')
    .optional(),
});

export type BlockStyle = z.infer<typeof blockStyleSchema>;

/* ── Text tags ────────────────────────────────────────────────────────────────
   "Is this heading text or plain text?" — the choice WPBakery's Heading element
   exposes as `heading_type`. Every block that renders a title accepts one, and
   defaults to the tag it has always used, so existing content is untouched.
   ──────────────────────────────────────────────────────────────────────────── */

export const TEXT_TAGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'div'] as const;
export type TextTag = (typeof TEXT_TAGS)[number];

export const textTagSchema = z.enum(TEXT_TAGS);

export const TEXT_TAG_LABELS: Record<TextTag, string> = {
  h1: 'Heading 1',
  h2: 'Heading 2',
  h3: 'Heading 3',
  h4: 'Heading 4',
  h5: 'Heading 5',
  h6: 'Heading 6',
  p: 'Paragraph',
  span: 'Inline text',
  div: 'Plain block',
};

export { BORDER_STYLES, BACKGROUND_SIZES, BACKGROUND_POSITIONS, BACKGROUND_REPEATS, FONT_STACKS };
