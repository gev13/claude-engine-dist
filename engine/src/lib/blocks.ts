import { z } from 'zod';
import { cardHoverSchema } from './cardHover';

/** Ids become part of a CSS selector, so they are constrained to what is safe there. */
export const BLOCK_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
import {
  type BlockStyle,
  blockStyleSchema,
  columnOrderSchema,
  columnWidthSchema,
  length,
  textTagSchema,
} from './blockStyle';
import { itemStyleSchema } from './itemStyle';
import { figureStyleSchema } from './figureStyle';
import { isColor, isLength } from './theme';
import { SOCIAL_NETWORKS, imageUrl as mediaUrl, isSafeHref } from './navigation';
import { parseVideoUrl } from './embeds';
import { TIME_PATTERN, WEEKDAYS, isTimeZone } from './hours';
import { SHARE_NETWORKS } from './share';
import { formAfterSchema, formAutoresponderSchema, formFieldSchema, formHiddenSchema, formNotifySchema } from './forms';
import { LOTTIE_PATH, LOTTIE_PLAY } from './lottie';

/* ═══════════════════════════════════════════════════════════════════════════
   Block vocabulary
   ───────────────────────────────────────────────────────────────────────────
   Every public page is a list of blocks. The admin page builder reorders them
   by drag-and-drop and edits their props; the renderer maps type → component.
   Adding a block means: add a schema here, a component in components/blocks,
   an entry in the renderer registry, and an editor form in the admin.
   ═══════════════════════════════════════════════════════════════════════════ */

const link = z.object({
  label: z.string(),
  href: z.string(),
  variant: z.enum(['primary', 'outline', 'ghost']).optional(),
  /** 3.1 — the arrow on this button; unset is what the block always did (the first button's arrow, where it had one). */
  arrow: z.boolean().optional(),
});
const tone = z.enum(['base', 'raised', 'flare']).optional();

/* ── Pattern-library building blocks ─────────────────────────────────────────
   Every field the library blocks add goes through an allowlist: links through
   the same grammar as the menus, media through the image-URL grammar, colours
   through the theme's colour grammar. The older blocks above predate this and
   keep their looser `link` so stored pages stay valid.
   ──────────────────────────────────────────────────────────────────────────── */

const safeHref = z.string().trim().min(1).max(500).refine(isSafeHref, 'Use a path like /about or a full https:// URL');
const libraryLink = z.object({
  label: z.string().trim().min(1).max(60),
  href: safeHref,
  /** 3.1 — an arrow on this button (in its own compartment when Appearance → Buttons says so). */
  arrow: z.boolean().optional(),
});
const text = (max: number) => z.string().max(max).optional();

/** HR1 centred over media · HR2 bottom-left over media · HR3 split · HR4 statement + frame · HR8 shaped media. */
/** P4-A5 adds `layered`: pictures at different depths that separate as the page scrolls. */
export const HERO_VARIANTS = ['classic', 'mediaCenter', 'mediaBottomLeft', 'split', 'statementFrame', 'shaped', 'layered'] as const;

/** SL1 cards · CT12 products · HR5 promo cards · HR6 full-screen hero · SL2 media beside text · SL4 cover-flow. */
/** P4 adds `splitScreen` (two halves moving opposite ways) and `filmstrip` (frames drifting in perspective). */
export const CAROUSEL_MODES = ['cards', 'products', 'heroCards', 'hero', 'media', 'coverflow', 'quotes', 'splitScreen', 'filmstrip'] as const;

/** SL5 — the indicator styles every slider shares. */
/** P4-A2 adds `thumbs` (a filmstrip of the slides) and `chapters` (their titles as a list). */
export const CAROUSEL_INDICATORS = ['dots', 'pill', 'ring', 'progress', 'capsule', 'counter', 'numbers', 'thumbs', 'chapters', 'none'] as const;
export const CAROUSEL_ARROWS = ['corner', 'side', 'edge', 'none'] as const;

const slide = z.object({
  eyebrow: text(80),
  title: text(160),
  body: text(4000),
  imageUrl: mediaUrl.optional(),
  videoUrl: mediaUrl.optional(),
  alt: text(200),
  href: safeHref.optional(),
  buttonLabel: text(40),
  badge: text(24),
  price: text(40),
  /** Colour dots under a product. Each is checked by the theme colour grammar. */
  swatches: z.array(z.string().trim().refine(isColor, 'Not a valid colour')).max(8).optional(),
  caption: text(200),
  /** P4-A3 — a short specification list beside the picture, as on an editorial product slide. */
  specs: z
    .array(z.object({ label: z.string().trim().min(1).max(40), value: z.string().trim().min(1).max(80) }))
    .max(5)
    .optional(),
  /** P3-B9 — stars on a testimonial, in halves. */
  rating: z.number().min(0).max(5).multipleOf(0.5).optional(),
  /** 2.19 — a testimonial's company, after its role (the caption). */
  company: text(80),
  /** 2.19 — a colour behind the picture, which then draws as a logo: fitted, not cropped. */
  avatarColor: z.string().trim().refine(isColor, 'Not a valid colour').optional(),
});

export type CarouselSlide = z.infer<typeof slide>;

const perView = z.number().min(1).max(6);

/** Up to two buttons, primary then secondary. */
const libraryLinks = z.array(libraryLink).max(2).default([]);

/** CT4 image tiles · CT5 icon features · CT5 image cards · V2 rows · V3 text over a picture; `cards` is the original grid. */
export const CARD_GRID_VARIANTS = ['cards', 'tiles', 'mosaic', 'icons', 'imageCards', 'rows', 'overlay', 'mediaRows'] as const;

/** CT3 — where text sits on a full-width media band. */
export const MEDIA_BAND_POSITIONS = ['center', 'bottomLeft', 'topLeft', 'right', 'left'] as const;

/** CT17 — the frame drawn around a screenshot or code sample. */
export const WINDOW_CHROMES = ['browser', 'app', 'terminal'] as const;

/* ── Package 2 elements (EL1–EL8) ──────────────────────────────────────── */

export const BUTTON_STYLES = ['primary', 'outline', 'soft', 'text'] as const;
export const BUTTON_ICONS = ['none', 'arrow', 'plus', 'play', 'mail'] as const;
export const NOTICE_KINDS = ['info', 'success', 'warning', 'danger'] as const;
export const COUNTDOWN_UNITS = ['months', 'days', 'hours', 'minutes', 'seconds'] as const;
/** `short` (2.18) — "Fb. / Ig. / Lk.". */
export const SOCIAL_STYLES = ['plain', 'outlined', 'filled', 'text', 'boxed', 'short'] as const;
export const TEAM_VARIANTS = ['cards', 'overlay', 'split'] as const;

const sizeSml = z.enum(['small', 'medium', 'large']);
const socialItem = z.object({ network: z.enum(SOCIAL_NETWORKS), href: safeHref, short: z.string().trim().max(8).optional() });
/** A date and time the countdown runs to; anything `Date.parse` reads. */
const dateTime = z
  .string()
  .trim()
  .max(40)
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Pick a date and time');

/* ── Package 2 media and showcase (EL9–EL16) ──────────────────────────────── */

export const GALLERY_LAYOUTS = ['grid', 'masonry', 'metro'] as const;
export const PROJECT_LAYOUTS = ['classic', 'overlay', 'minimal', 'metro', 'list', 'carousel'] as const;
export const NUMBERED_LIST_VARIANTS = ['grid', 'steps', 'timeline'] as const;

/** A video from the media library, or a YouTube / Vimeo link that loads only when played. */
const videoSource = z
  .string()
  .trim()
  .min(1)
  .max(300)
  .refine((v) => parseVideoUrl(v) !== null, 'Use a YouTube or Vimeo link, or a video uploaded to the media library');
const mediaRatio = z.enum(['16/9', '4/3', '1/1', '3/4', '21/9']);
const showcaseHead = { tone, eyebrow: text(80), title: text(200), titleAs: textTagSchema.optional(), intro: text(4000) };

/* ── Package 3 widgets (P3-A1 – P3-A11) ────────────────────────────────────── */

export const CHART_KINDS = ['column', 'bar', 'line', 'area', 'pie', 'doughnut'] as const;
export const HOTSPOT_MARKERS = ['dot', 'number', 'plus'] as const;
export const FLIP_EFFECTS = ['flip', 'slide', 'fade'] as const;
export const PRICE_LIST_LAYOUTS = ['list', 'columns', 'cards'] as const;
export const HOURS_STYLES = ['list', 'card', 'compact'] as const;
export const SHARE_STYLES = ['buttons', 'icons', 'outlined', 'text'] as const;
export const REVIEW_LAYOUTS = ['grid', 'masonry', 'list'] as const;
export const TOC_STYLES = ['boxed', 'list', 'numbered'] as const;
export const CRUMB_STYLES = ['plain', 'pill', 'boxed'] as const;
export const TEXT_PATH_SHAPES = ['circle', 'arc', 'wave'] as const;
export const SEARCH_STYLES = ['bar', 'pill', 'underline', 'minimal'] as const;

const percent = z.number().min(0).max(100);
const clockTime = z.string().trim().regex(TIME_PATTERN, 'Use 24-hour time, like 09:00');
const unique = <T,>(list: T[]) => new Set(list).size === list.length;

/**
 * What a diagram says when nobody has told it otherwise.
 *
 * Lived inside `ConvergeFigure` as three string literals, which made them
 * invisible: the editor's label list started empty, so the page said
 * "SOURCE A" and the admin offered nothing that corresponded to it. The data
 * existed, the control existed, and they did not meet — the exact failure
 * this repository already warns about for `figureLabels`.
 *
 * Shared now, so the boxes in the editor hold the words on the page.
 */
export const FIGURE_LABELS = {
  converge: ['SOURCE A', 'SOURCE B', 'OUTCOME'],
  layers: ['FOUNDATION', 'PLATFORM', 'PRODUCT'],
} as const;

export const blockSchemas = {
  /** Page opener: eyebrow, h1, lede, body, buttons, optional SVG figure. */
  hero: z.object({
    /** Which hero from the library; `classic` is the original block. */
    variant: z.enum(HERO_VARIANTS).default('classic'),
    imageUrl: mediaUrl.optional(),
    /** Background or framed video; the image becomes its poster. */
    videoUrl: mediaUrl.optional(),
    alt: text(200),
    /** The small linked pill above the heading ("Join us at …"). */
    announcement: libraryLink.optional(),
    height: z.enum(['auto', 'tall', 'screen']).default('tall'),
    /** How much the media is darkened under text. */
    overlay: z.enum(['none', 'light', 'medium', 'strong']).default('medium'),
    scrollCue: z.boolean().optional(),
    mediaSide: z.enum(['right', 'left']).default('right'),
    /** 3.1 — split: the picture runs to the section's top, side and bottom edges, the text on its dark side. */
    bleed: z.boolean().optional(),
    /** 3.3.2 — with `bleed`: how much of the section's width the picture takes, in percent; unset is 72. */
    bleedWidth: z.number().int().min(30).max(90).optional(),
    /** 3.3.3 — with `bleed`: `contain` shows the whole picture at the section's full height against its edge; unset fills the box (cover). */
    bleedFit: z.enum(['cover', 'contain']).optional(),
    /** 3.3.3 — with `bleed`: the least height of the hero, e.g. 640px; the picture takes it too. */
    bleedMinHeight: z.string().trim().max(40).refine(isLength, 'Not a valid CSS length').optional(),
    /**
     * 3.6 — split hero on phones: the picture above the text (below, as
     * before, when unset). Run to the edges, it spans the section's width
     * and reaches up behind a notch header.
     */
    mediaFirstMobile: z.boolean().optional(),
    /**
     * 3.9 — run to the edges under a notch header: centre the text in the
     * whole panel (as a design tool draws it) rather than below the tab.
     * Wide screens only; the least height then counts the tab's space too.
     */
    bleedCentre: z.enum(['below', 'panel']).optional(),
    /** 3.9 — how wide the paragraphs under the heading run (e.g. 580px); the text column's width when unset. */
    textWidth: z.string().trim().max(40).refine(isLength, 'Not a valid CSS length').optional(),
    /** 3.9 — the small line above the eyebrow: a mono label (as before) or plain small text. */
    kickerStyle: z.enum(['label', 'plain']).optional(),
    eyebrow: z.string().optional(),
    kicker: z.string().optional(),
    title: z.string(),
    titleAs: textTagSchema.optional(),
    lede: z.string().optional(),
    body: z.string().optional(),
    links: z.array(link).default([]),
    /** P4-A5 — the layered hero's pictures, furthest back first; each moves at its own speed. */
    layers: z
      .array(z.object({ imageUrl: mediaUrl, alt: text(200), depth: z.enum(['back', 'middle', 'front']).default('middle') }))
      .max(3)
      .default([]),
    /** P4-A5 — the layers also lean towards the pointer, on machines with one. */
    pointerParallax: z.boolean().default(false),
    figure: z.enum(['converge', 'layers', 'none']).default('none'),
    /** Labels for the `layers` figure, outermost first; the last is highlighted. */
    figureLabels: z.array(z.string()).max(6).default([]),
    /** How the hero's own diagram is drawn — the same vocabulary. */
    figureStyle: figureStyleSchema.optional(),
    layout: z.enum(['split', 'wide']).default('split'),
  }),

  /**
   * The four-up numeral band; `figures` (CT8) is big numbers with units, optionally
   * under an image; `counters` (V10) count up as they scroll into view, with icons.
   */
  stats: z.object({
    variant: z.enum(['tiles', 'figures', 'counters']).default('tiles'),
    tone,
    eyebrow: z.string().optional(),
    title: text(160),
    titleAs: textTagSchema.optional(),
    intro: text(4000),
    imageUrl: mediaUrl.optional(),
    alt: text(200),
    iconPosition: z.enum(['top', 'left']).default('top'),
    countUp: z.boolean().default(true),
    items: z.array(z.object({ value: z.string(), label: z.string(), unit: text(12), iconUrl: mediaUrl.optional() })),
    footnote: z.string().optional(),
    /** 2.22 — the numbers glow in the accent colour. */
    /** 3.8 — the size of the figures (e.g. 56px); unset grows with the screen up to 72px. */
    valueSize: z.string().trim().max(40).refine(isLength, 'Not a valid CSS length').optional(),
    glow: z.boolean().optional(),
    /** 2.22 — thin rules between the figures, which then sit to the left. */
    dividers: z.boolean().optional(),
  }),

  /**
   * Text: a heading with paragraphs or rich text (TinyMCE), in one or two
   * columns, as normal text or small print. Also what a stored `richText`
   * block becomes (see migrateBlock).
   */
  prose: z.object({
    tone,
    eyebrow: z.string().optional(),
    title: z.string().optional(),
    titleAs: textTagSchema.optional(),
    paragraphs: z.array(z.string()).default([]),
    /** Sanitised rich text from TinyMCE; rendered instead of `paragraphs`. */
    html: z.string().optional(),
    columns: z.enum(['one', 'two']).default('one'),
    /** 3.10 — two columns: the text starts level with the heading rather than the eyebrow above it. */
    alignWithTitle: z.boolean().optional(),
    /** `footnotes` (CF4) sets it as small print, for claims and disclaimers before the footer. */
    variant: z.enum(['default', 'footnotes']).default('default'),
  }),

  /** Heading on the left, a stack of labelled points on the right. */
  splitPoints: z.object({
    tone,
    eyebrow: z.string().optional(),
    title: z.string().optional(),
    titleAs: textTagSchema.optional(),
    intro: z.string().optional(),
    points: z.array(z.object({ title: z.string(), body: z.string() })),
  }),

  /** Card grid — services, principles, coverage areas; plus image tiles, icon features and image cards. */
  cardGrid: z.object({
    variant: z.enum(CARD_GRID_VARIANTS).default('cards'),
    tone,
    eyebrow: z.string().optional(),
    title: z.string().optional(),
    titleAs: textTagSchema.optional(),
    intro: z.string().optional(),
    columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(3),
    /**
     * The space between the cards.
     *
     * Separate from a card's own margin, which shifts a card inside its cell
     * and does not change the distance between two of them. Unset means each
     * layout keeps the gap it was designed with — they are not all the same,
     * and one number would flatten a deliberate difference.
     */
    gap: length.optional(),
    /** V3 — for image cards, pictures with text over them, icon features and rows. */
    hover: z.enum(['none', 'lift', 'zoom']).default('none'),
    shadow: z.boolean().default(false),
    /** V5 — every other column sits lower (image cards and pictures with text over them). */
    offset: z.boolean().default(false),
    /** V4 — icon features: how the icon is drawn, and where. `boxed` / `top` is the original look. */
    iconStyle: z.enum(['boxed', 'plain', 'outlined', 'circle']).default('boxed'),
    iconPosition: z.enum(['top', 'left', 'floating']).default('top'),
    /** 2.22 — a small running number ("01") over each card's title; the picture rows show it unless told not to. */
    numbered: z.boolean().optional(),
    /** 3.6 — how that number reads: `plain` "01" (the default) or `slash` "/01". */
    numberStyle: z.enum(['plain', 'slash']).optional(),
    /** 3.8 — cards: a thin line between the cards of a row. */
    dividers: z.boolean().optional(),
    /** 3.8 — picture rows: how wide the picture column is (e.g. 400px); unset is two fifths. */
    mediaWidth: z.string().trim().max(40).refine(isLength, 'Not a valid CSS length').optional(),
    /** 3.8 — image cards: the picture's shape; unset is 4:3. */
    mediaRatio: z.enum(['4/3', '5/4', '1/1', '3/2', '16/9']).optional(),
    /**
     * 2.22 — cards: how many cards each row holds, in turn — "2-3" is two,
     * then three, then two… A bento of mixed widths; unset is the even grid.
     */
    pattern: z.string().regex(/^[1-4](-[1-4]){1,5}$/, 'Counts of 1 to 4, separated by hyphens, e.g. 2-3').optional(),
    cards: z.array(
      z.object({
        /** This card's own colour, spacing and edge — see `lib/itemStyle.ts`. */
        style: itemStyleSchema.optional(),
        eyebrow: z.string().optional(),
        title: z.string(),
        /** 3.6 — words after the title in a colour of their own ("Northwind / the security side"). */
        titleAfter: text(80),
        titleAfterColor: z.string().trim().refine(isColor, 'Not a colour').optional(),
        body: z.string().optional(),
        href: z.string().optional(),
        /** The tile's background, the card's picture, or the feature's icon. */
        imageUrl: mediaUrl.optional(),
        alt: text(200),
        buttonLabel: text(40),
        /**
         * P10-D — a short flag in the corner: "New", "Coming soon", "Sold out".
         *
         * Free text rather than a status enum, because the vocabulary is the
         * site's: a studio says "Fully booked" where a shop says "Sold out",
         * and neither is a state this engine tracks.
         */
        badge: text(24),
        /** V2 — the checklist a row shows beside its text. */
        points: z.array(z.string().trim().min(1).max(120)).max(8).optional(),
      }),
    ),
  }),

  /**
   * Numbered failure modes / steps. `steps` (EL16) joins numbered steps with a
   * line across the page; `timeline` runs them down a line, each under its label.
   */
  numberedList: z.object({
    variant: z.enum(NUMBERED_LIST_VARIANTS).default('grid'),
    tone,
    eyebrow: z.string().optional(),
    title: z.string().optional(),
    titleAs: textTagSchema.optional(),
    intro: z.string().optional(),
    items: z.array(z.object({ title: z.string(), body: z.string(), label: text(40) })),
  }),

  /** EL9 — two pictures with a handle that wipes between them. */
  compare: z.object({
    ...showcaseHead,
    beforeUrl: mediaUrl,
    afterUrl: mediaUrl,
    beforeAlt: text(200),
    afterAlt: text(200),
    beforeLabel: text(30),
    afterLabel: text(30),
    orientation: z.enum(['horizontal', 'vertical']).default('horizontal'),
    start: z.number().int().min(0).max(100).default(50),
    ratio: mediaRatio.default('16/9'),
    handle: z.enum(['circle', 'arrows', 'line']).default('circle'),
    caption: text(200),
  }),

  /** EL10 — a video that plays in place or over the page. */
  video: z.object({
    ...showcaseHead,
    source: videoSource,
    /** Names the player and its play button for screen readers. */
    videoTitle: z.string().trim().min(1).max(120),
    posterUrl: mediaUrl.optional(),
    /**
     * `ambient` (2.17) — a moving picture: an uploaded film that plays muted
     * and looped while it is on screen, with no player chrome.
     */
    display: z.enum(['inline', 'button', 'ambient']).default('inline'),
    buttonStyle: z.enum(['filled', 'outlined', 'blurred']).default('filled'),
    buttonSize: sizeSml.default('medium'),
    buttonLabel: text(40),
    /** `auto` (ambient only) takes the shape of the file itself, read at upload. */
    ratio: z.enum(['16/9', '4/3', '1/1', '21/9', '9/16', 'auto']).default('16/9'),
    /** Ambient: the same film in other formats — a WebM beside the MP4. WebM is tried first. */
    sources: z.array(mediaUrl).max(3).default([]),
    fit: z.enum(['cover', 'contain']).default('cover'),
    rounded: z.boolean().default(false),
    maxWidth: z.enum(['full', 'wide', 'medium', 'narrow']).default('full'),
    /** Ambient: a pause button, for anyone who wants it to stop (WCAG 2.2.2). */
    controls: z.boolean().default(true),
    caption: text(200),
    /** P3-B8 — more videos after the first, picked from a list beside or below the player. */
    playlist: z
      .array(z.object({ source: videoSource, videoTitle: z.string().trim().min(1).max(120), posterUrl: mediaUrl.optional(), duration: text(12) }))
      .max(12)
      .default([]),
    playlistPosition: z.enum(['side', 'below']).default('side'),
  }),

  /** EL11 — pictures in a grid, masonry or metro layout, with an optional lightbox. */
  gallery: z.object({
    ...showcaseHead,
    layout: z.enum(GALLERY_LAYOUTS).default('grid'),
    columns: z.number().int().min(2).max(5).default(3),
    gap: z.enum(['none', 'small', 'medium', 'large']).default('medium'),
    ratio: z.enum(['square', 'landscape', 'portrait']).default('square'),
    hover: z.enum(['zoom', 'lift', 'greyscale', 'none']).default('zoom'),
    captions: z.enum(['none', 'below', 'overlay']).default('none'),
    lightbox: z.boolean().default(true),
    images: z
      /* 2.17 — `videoUrl` makes the tile a moving picture (an uploaded film,
         muted and looped while on screen); `url` is its poster. */
      .array(z.object({ url: mediaUrl, alt: text(200), caption: text(200), href: safeHref.optional(), videoUrl: mediaUrl.optional() }))
      .min(1)
      .max(200),
    link: libraryLink.optional(),
    /**
     * 2.19 — a long gallery shows `perPage` first, then the next lot from a
     * "Load more" button, or by itself near the end of the list (`infinite`,
     * which keeps the button for keyboards). Every picture is already in the
     * block, so nothing is fetched.
     */
    pagination: z.enum(['none', 'loadMore', 'infinite']).default('none'),
    perPage: z.number().int().min(1).max(200).default(12),
  }),

  /** EL12 — panels side by side; the open one widens. Stacks on phones. */
  horizontalAccordion: z.object({
    ...showcaseHead,
    trigger: z.enum(['click', 'hover']).default('click'),
    height: z.enum(['medium', 'tall']).default('medium'),
    panels: z
      .array(
        z.object({
          title: z.string().trim().min(1).max(80),
          label: text(40),
          body: text(4000),
          imageUrl: mediaUrl.optional(),
          alt: text(200),
          link: libraryLink.optional(),
        }),
      )
      .min(2)
      .max(6),
  }),

  /** EL13 — a portfolio: a filterable project grid, or a big-text list whose picture follows the pointer. */
  projects: z.object({
    ...showcaseHead,
    layout: z.enum(PROJECT_LAYOUTS).default('classic'),
    columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(3),
    hover: z.enum(['zoom', 'greyscale', 'swap', 'none']).default('zoom'),
    /** 2.19 — how the whole card moves under the pointer (lift, tilt…), beside the picture's own `hover`. */
    cardHover: cardHoverSchema.optional(),
    filter: z.boolean().default(true),
    allLabel: z.string().trim().max(30).default('All'),
    /**
     * T6 (2.14) — `manual` is the list typed in below (every block before
     * 2.14); `collection` reads published projects from Projects, filtered
     * here, so a new project appears wherever it belongs without anybody
     * editing the page.
     */
    source: z.enum(['manual', 'collection']).default('manual'),
    /** Collection: category and tag slugs; empty means every project. */
    categories: z.array(z.string().trim().max(200)).max(20).default([]),
    tags: z.array(z.string().trim().max(200)).max(20).default([]),
    featuredOnly: z.boolean().default(false),
    /** Collection: on a project's own page, leave that project out. */
    excludeCurrent: z.boolean().default(true),
    order: z.enum(['manual', 'newest', 'random']).default('manual'),
    /** Collection: how many — per page when it pages. */
    limit: z.number().int().min(1).max(100).default(12),
    /**
     * `loadMore` — the first `limit`, then a button that fetches the next lot
     * (manual lists reveal the rest). `pages` — real `/page/2` addresses,
     * rendered on the server (collection only).
     */
    pagination: z.enum(['none', 'loadMore', 'pages']).default('none'),
    /** Manual lists that load more: how many show first. */
    perPage: z.number().int().min(1).max(100).default(12),
    items: z
      .array(
        z.object({
          title: z.string().trim().min(1).max(100),
          category: text(40),
          year: text(12),
          summary: text(4000),
          imageUrl: mediaUrl.optional(),
          hoverImageUrl: mediaUrl.optional(),
          alt: text(200),
          href: safeHref.optional(),
        }),
      )
      .max(200)
      .default([]),
    link: libraryLink.optional(),
  }),

  /** EL14 — an address, and a map that loads only when a visitor asks for it. */
  map: z.object({
    ...showcaseHead,
    provider: z.enum(['openstreetmap', 'google']).default('openstreetmap'),
    address: z.string().trim().min(1).max(200),
    /** OpenStreetMap needs these to draw the map; Google can search the address instead. */
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
    zoom: z.number().int().min(3).max(19).default(15),
    layout: z.enum(['card', 'split', 'full']).default('card'),
    height: z.enum(['short', 'medium', 'tall']).default('medium'),
    details: z
      .array(z.object({ label: z.string().trim().min(1).max(40), value: z.string().trim().min(1).max(200) }))
      .max(6)
      .default([]),
    link: libraryLink.optional(),
    greyscale: z.boolean().default(false),
  }),

  /** Two check-lists side by side — "what's covered" / "what you receive". */
  checkLists: z.object({
    tone,
    eyebrow: z.string().optional(),
    title: z.string().optional(),
    titleAs: textTagSchema.optional(),
    intro: text(4000),
    /** P3-B3 — the marker before each entry; `custom` uses `iconUrl`. */
    icon: z.enum(['check', 'arrow', 'dot', 'star', 'plus', 'number', 'custom', 'none', 'slash']).default('check'),
    iconUrl: mediaUrl.optional(),
    /** `rows` (ruled lines) is the original look. */
    /** 3.6 — `cards`: every entry a card of its own, cut or rounded like the site's cards. */
    layout: z.enum(['rows', 'plain', 'inline', 'grid', 'cards']).default('rows'),
    /** 2.22 — the marker on a tinted circle. */
    markerStyle: z.enum(['plain', 'circle']).optional(),
    /** 2.22 — hairline rules between rows instead of the 2px ones. */
    thinRules: z.boolean().optional(),
    /** 2.22 — each list in a card of its own. */
    boxed: z.boolean().optional(),
    lists: z.array(
      z.object({
        title: z.string().optional(),
        /** 3.6 — this list's own colour, for its heading and markers; the site accent when empty. */
        accent: z.string().trim().refine(isColor, 'Not a colour').optional(),
        /** A plain string, as stored before P3-B3, or an entry with a link and small print. */
        items: z.array(
          z.union([z.string(), z.object({ text: z.string().trim().min(1).max(200), href: safeHref.optional(), note: text(200) })]),
        ),
      }),
    ),
  }),

  /** Accordion FAQ. Also emits FAQPage structured data. `media` (CT6) swaps an image to match the open item. */
  faq: z.object({
    variant: z.enum(['list', 'media']).default('list'),
    /** V1 — how the questions are drawn in the `list` layout; `lines` is the original look. */
    style: z.enum(['lines', 'filled', 'contained', 'outlined']).default('lines'),
    icon: z.enum(['plus', 'chevron', 'arrow']).default('plus'),
    /** 3.10 — the heading column's width beside the questions (e.g. 460px); unset shares the row two to three. */
    headWidth: z.string().trim().max(40).refine(isLength, 'Not a valid CSS length').optional(),
    /** 3.10 — the questions start level with the heading rather than the eyebrow above it. */
    alignWithTitle: z.boolean().optional(),
    /** 3.10 — contained: the lines between questions stop short of the edges. */
    insetDividers: z.boolean().optional(),
    tone,
    eyebrow: z.string().optional(),
    title: z.string().optional(),
    titleAs: textTagSchema.optional(),
    items: z.array(z.object({ question: z.string(), answer: z.string(), imageUrl: mediaUrl.optional(), alt: text(200) })),
  }),

  /**
   * Full-bleed call-to-action band; `big` (CF1) is a huge centred headline, `card` a
   * compact card, `inline` (V7) a framed strip with the text beside the buttons.
   */
  cta: z.object({
    variant: z.enum(['band', 'big', 'card', 'inline']).default('band'),
    /** The section's background, for every layout but the coloured band. */
    tone,
    eyebrow: z.string().optional(),
    title: z.string(),
    titleAs: textTagSchema.optional(),
    body: z.string().optional(),
    links: z.array(link).default([]),
  }),

  /** "Next service" pager. */
  pager: z.object({
    label: z.string().default('Next service'),
    title: z.string(),
    href: z.string(),
  }),

  /** Auto-populated service index (reads from site config, not from props). */
  servicesIndex: z.object({
    tone,
    eyebrow: z.string().optional(),
    title: z.string().optional(),
    titleAs: textTagSchema.optional(),
    intro: z.string().optional(),
    tier: z.enum(['primary', 'secondary', 'all']).default('all'),
    /** 2.18 — the small label on each card: the tier, or nothing. */
    eyebrows: z.enum(['tier', 'none']).default('tier'),
    primaryLabel: z.string().trim().max(40).optional(),
    secondaryLabel: z.string().trim().max(40).optional(),
  }),

  /** Auto-populated post list. */
  postList: z.object({
    tone,
    eyebrow: z.string().optional(),
    title: z.string().optional(),
    titleAs: textTagSchema.optional(),
    intro: z.string().optional(),
    kind: z.enum(['article', 'research', 'all']).default('all'),
    categorySlug: z.string().optional(),
    limit: z.number().int().positive().max(48).default(9),
    /** `news` (CT13): cover image, type chip, date, and a centred "View all" button. */
    /** P3-B6 adds `carousel` (the posts as swipeable cards) and `featured` (one large post, the rest beside it). */
    variant: z.enum(['cards', 'news', 'list', 'minimal', 'overlay', 'compact', 'wide', 'carousel', 'featured']).default('cards'),
    columns: z.union([z.literal(2), z.literal(3)]).default(3),
    /**
     * V6 — the V6 layouts can show a few at a time. This happens in the browser,
     * never through the URL: a search parameter would make every visit dynamic.
     */
    /**
     * `server` (2.13) pages through real addresses — `/news/page/2` — so every
     * page is in the HTML and a search engine can reach every post. `limit`
     * is then the number per page. One per page; see lib/listing.ts.
     */
    pagination: z.enum(['none', 'more', 'pages', 'server']).default('none'),
    perPage: z.number().int().min(1).max(24).default(6),
    /** With `server`: numbered links, previous/next, or a "Load more" button over real links. */
    pager: z.enum(['numbers', 'prevNext', 'loadMore']).default('numbers'),
    /** With `server`: "Showing 1–12 of 110 results" above the list. */
    resultCount: z.boolean().default(false),
    /** 2.18 — what each card shows in the list layouts; unset is what they always showed. */
    card: z
      .object({
        date: z.boolean().optional(),
        readingTime: z.boolean().optional(),
        category: z.boolean().optional(),
        readMore: z.boolean().optional(),
        /** 3.2 — the plain cards: the cover above the title. */
        image: z.boolean().optional(),
        ratio: z.enum(['16/9', '4/3', '3/2', '1/1']).optional(),
        /** 2.19 — how each card answers the pointer; unset is nothing new. */
        hover: cardHoverSchema.optional(),
      })
      .optional(),
  }),

  /** The contact form; `split` (CF3) puts text and a picture beside a form card. */
  contactForm: z.object({
    eyebrow: z.string().optional(),
    title: z.string().optional(),
    titleAs: textTagSchema.optional(),
    intro: z.string().optional(),
    /** `centered` (V16) centres the heading over a narrower form. */
    layout: z.enum(['stacked', 'split', 'centered']).default('stacked'),
    body: text(4000),
    imageUrl: mediaUrl.optional(),
    alt: text(200),
    /** 2.16 — a conversion to the site's tags and an optional thank-you page. */
    after: formAfterSchema.prefault({}),
  }),

  /** Contact details / response-time column beside the form. */
  infoPanel: z.object({
    tone,
    title: z.string().optional(),
    titleAs: textTagSchema.optional(),
    items: z.array(z.object({ label: z.string(), value: z.string() })),
  }),

  /** Editorial image with caption. */
  image: z.object({
    mediaId: z.string().optional(),
    url: z.string(),
    alt: z.string().default(''),
    caption: z.string().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
    /** `lead` (CT15): a sentence caption whose opening phrase is bold, under a rounded image. */
    captionStyle: z.enum(['mono', 'lead']).default('mono'),
    captionLead: text(120),
    rounded: z.boolean().optional(),
    /** P3-B2 — the shape the picture is cut to. */
    mask: z.enum(['none', 'circle', 'arch', 'blob', 'leaf', 'hexagon', 'diamond', 'cut']).default('none'),
    /** How wide the picture may grow, and where a narrower one sits. */
    size: z.enum(['full', 'large', 'medium', 'small']).default('full'),
    align: z.enum(['left', 'center']).default('left'),
  }),

  /**
   * A diagram on its own.
   *
   * The same two figures the hero can draw, as a block that can sit in a
   * column. That is what makes a hero decomposable into a row: text in one
   * column, figure in the other, both editable and reorderable, instead of a
   * two-column grid hidden inside the hero component.
   */
  figure: z.object({
    kind: z.enum(['converge', 'layers']).default('converge'),
    /**
     * The last one is what everything meets at; the rest are sources.
     *
     * Six rather than five, so a converging diagram can hold five sources —
     * the old cap was written when exactly two were drawn.
     */
    labels: z.array(z.string()).max(6).default([]),
    /** How it is drawn — see `lib/figureStyle.ts`. */
    style: figureStyleSchema.optional(),
  }),

  /**
   * Vertical space, with an optional rule.
   *
   * Necessary once columns exist: a block's own margin can only push against
   * something, and a column often needs space where there is no block at all.
   * Without it editors reach for an empty text block, which is worse for
   * everyone including screen readers.
   */
  spacer: z.object({
    height: z.string().trim().refine(isLength, 'Not a valid CSS length').default('48px'),
    /** Falls back to `height` when unset. */
    heightMobile: z.string().trim().refine(isLength, 'Not a valid CSS length').optional(),
    line: z.enum(['none', 'hairline', 'rule', 'accent']).default('none'),
    /** P3-B4 — how the line is drawn, how far it runs, and what sits in its middle. */
    lineStyle: z.enum(['solid', 'dashed', 'dotted', 'double', 'wave', 'zigzag']).default('solid'),
    lineWidth: z.enum(['full', 'wide', 'short']).default('full'),
    align: z.enum(['left', 'center', 'right']).default('center'),
    label: text(60),
    ornament: z.enum(['none', 'dot', 'diamond', 'star', 'asterisk']).default('none'),
  }),

  /* ── Layout ──────────────────────────────────────────────────────────────
     A row of columns, each holding its own blocks. This is the one block type
     that contains other blocks, and the nesting stops here: a column may not
     contain another row. One level covers what layouts actually need, and
     keeps both the renderer and the editor comprehensible — unbounded nesting
     is a trap for both.
     ──────────────────────────────────────────────────────────────────────── */
  row: z.object({
    columns: z
      .array(
        z.object({
          id: z.string().min(1).max(64).regex(BLOCK_ID_PATTERN),
          width: columnWidthSchema,
          /** Its place at the smaller tiers; absent is the written order. */
          order: columnOrderSchema.optional(),
          /** Columns take the same Design Options panel that blocks do. */
          style: blockStyleSchema.optional(),
          /** Parsed by `parseBlock` in turn; see parseRowProps below. */
          blocks: z.array(z.unknown()).max(30).default([]),
        }),
      )
      .min(1)
      .max(6),
    /** Space between columns. */
    gap: z.string().optional(),
    /** How columns line up against each other when they differ in height. */
    align: z.enum(['start', 'center', 'end', 'stretch']).default('stretch'),
    /** Stack order on mobile, for the "image above text" case. */
    reverseOnMobile: z.boolean().optional(),
    minHeight: z.string().optional(),
  }),

  /** Simple data table. */
  table: z.object({
    tone,
    title: z.string().optional(),
    titleAs: textTagSchema.optional(),
    head: z.array(z.string()),
    rows: z.array(z.array(z.string())),
  }),

  /**
   * Every slider in the library (SL1, SL2, SL4, SL5, HR5, HR6, CT12).
   *
   * One block with modes rather than six blocks, because they share the part
   * that is hard to get right — controls, autoplay, pausing, reduced motion —
   * and differ only in what a slide looks like. In the `hero` mode `titleAs`
   * applies to the first slide's title, so a slider can be the page's h1.
   */
  carousel: z.object({
    tone,
    mode: z.enum(CAROUSEL_MODES).default('cards'),
    eyebrow: text(80),
    title: text(160),
    titleAs: textTagSchema.optional(),
    intro: text(4000),
    /** A quiet link beside the heading ("Compare all models ›"). */
    link: libraryLink.optional(),
    slides: z.array(slide).min(1).max(24),
    autoplay: z.boolean().default(false),
    /** Seconds per slide while autoplaying. */
    interval: z.number().int().min(2).max(20).default(6),
    loop: z.boolean().default(true),
    transition: z.enum(['slide', 'fade']).default('slide'),
    /** V9 — the full-screen slider can move up and down instead of sideways. */
    direction: z.enum(['horizontal', 'vertical']).default('horizontal'),
    indicator: z.enum(CAROUSEL_INDICATORS).default('dots'),
    arrows: z.enum(CAROUSEL_ARROWS).default('corner'),
    /** Cards in view per tier; fractions make the next card peek (1.2). */
    perView: z
      .object({ base: perView, laptop: perView.optional(), tablet: perView.optional(), mobile: perView.optional() })
      .optional(),
    /** P4-A4 — pictures drift and zoom slowly while their slide is shown; still for reduced motion. */
    kenBurns: z.boolean().default(false),
    /** P4-A7 — the slides can be dragged sideways with a mouse, as touch screens already allow. */
    drag: z.boolean().default(false),
    /** HR6 — category links attached to the bottom of a full-screen slider. */
    strip: z.array(libraryLink).max(6).default([]),
  }),

  /** SL3 — an endless strip of logos, quotes or tags. */
  marquee: z.object({
    tone,
    eyebrow: text(80),
    title: text(160),
    titleAs: textTagSchema.optional(),
    intro: text(4000),
    /** P3-B7 adds `photos`, a strip of pictures with captions. */
    kind: z.enum(['logos', 'quotes', 'chips', 'text', 'photos']).default('logos'),
    items: z
      .array(
        z.object({
          label: text(80),
          imageUrl: mediaUrl.optional(),
          quote: text(4000),
          name: text(80),
          role: text(80),
          rating: z.number().min(0).max(5).multipleOf(0.5).optional(),
          href: safeHref.optional(),
        }),
      )
      .min(1)
      .max(40),
    rows: z.union([z.literal(1), z.literal(2)]).default(1),
    speed: z.enum(['slow', 'normal', 'fast']).default('normal'),
    /** V11 — which way the (first) row moves, what sits between big-text items, and slowing rather than pausing on hover. */
    direction: z.enum(['left', 'right']).default('left'),
    separator: z.enum(['dot', 'star', 'slash', 'none']).default('dot'),
    hoverSlow: z.boolean().default(false),
    /** The shape of every picture in a photo strip. */
    photoRatio: z.enum(['4/3', '3/4', '1/1', '16/9']).default('4/3'),
  }),

  /* ── Content sections (CT1–CT17, HD3) ─────────────────────────────────── */

  /** CT1 — media on one side, eyebrow / heading / text / buttons on the other. */
  splitMedia: z.object({
    tone,
    eyebrow: text(80),
    title: z.string().max(200),
    titleAs: textTagSchema.optional(),
    body: text(4000),
    links: libraryLinks,
    imageUrl: mediaUrl.optional(),
    videoUrl: mediaUrl.optional(),
    alt: text(200),
    mediaSide: z.enum(['left', 'right']).default('left'),
    /** `organic` gives the media one large rounded corner. */
    shape: z.enum(['square', 'rounded', 'organic']).default('rounded'),
    ratio: z.enum(['portrait', 'square', 'landscape']).default('portrait'),
  }),

  /** CT2 — a solid text card over a full-width image, on its bottom edge or inside it. */
  overlayCard: z.object({
    imageUrl: mediaUrl.optional(),
    alt: text(200),
    placement: z.enum(['overlapBottom', 'insideLeft', 'insideRight']).default('overlapBottom'),
    eyebrow: text(80),
    title: z.string().max(200),
    titleAs: textTagSchema.optional(),
    body: text(4000),
    link: libraryLink.optional(),
  }),

  /**
   * CT3 — a photo or video band with text placed on it. `parallax` (EL15) makes
   * the picture drift with the scroll; a stored `parallaxImage` block becomes
   * one of these (see migrateBlock). Still for reduced motion.
   */
  mediaBand: z.object({
    imageUrl: mediaUrl.optional(),
    videoUrl: mediaUrl.optional(),
    alt: text(200),
    position: z.enum(MEDIA_BAND_POSITIONS).default('bottomLeft'),
    height: z.enum(['short', 'medium', 'tall', 'screen']).default('tall'),
    overlay: z.enum(['none', 'light', 'medium', 'strong', 'gradient']).default('medium'),
    parallax: z.enum(['none', 'vertical', 'horizontal']).default('none'),
    strength: z.enum(['subtle', 'medium', 'strong']).default('medium'),
    /**
     * 2.21 — a colour fading across the band from one side, over the picture:
     * solid up to `solid`% of the width, clear from `clear`%. The text can
     * turn dark for a light colour, and the buttons with it.
     */
    fade: z
      .object({
        side: z.enum(['left', 'right']).default('left'),
        /** Unset is the site's accent colour, so the band follows the theme. */
        color: z.string().trim().refine(isColor, 'Not a valid colour').optional(),
        solid: z.number().int().min(0).max(100).default(42),
        clear: z.number().int().min(0).max(100).default(72),
        text: z.enum(['light', 'dark']).default('light'),
        /** 3.8 — with dark text: its colour (the site's ink when unset), and the main button's arrow in the fade's colour. */
        ink: z.string().trim().refine(isColor, 'Not a valid colour').optional(),
        accentArrow: z.boolean().optional(),
      })
      .optional(),
    eyebrow: text(80),
    title: z.string().max(200).default(''),
    titleAs: textTagSchema.optional(),
    body: text(4000),
    links: libraryLinks,
  }),

  /** CT7 — segmented tabs switching a text-and-image panel; a dropdown on phones. */
  tabs: z.object({
    tone,
    eyebrow: text(80),
    title: text(160),
    titleAs: textTagSchema.optional(),
    intro: text(4000),
    /** Where the tab bar sits relative to the panel. */
    barPosition: z.enum(['above', 'below']).default('below'),
    /** V13 — pill (the original), underlined or plain-text tabs, across the top or down the side. */
    /** P3-B5 adds `switch`: a centred toggle for two or three panels, kept on phones too. */
    style: z.enum(['pill', 'underline', 'text', 'switch']).default('pill'),
    orientation: z.enum(['horizontal', 'vertical']).default('horizontal'),
    tabs: z
      .array(
        z.object({
          label: z.string().trim().min(1).max(40),
          iconUrl: mediaUrl.optional(),
          title: text(160),
          body: text(4000),
          imageUrl: mediaUrl.optional(),
          alt: text(200),
          link: libraryLink.optional(),
        }),
      )
      .min(1)
      .max(8),
  }),

  /** CT9 — a grid of client or certification logos. */
  logoWall: z.object({
    tone,
    eyebrow: text(80),
    title: text(160),
    titleAs: textTagSchema.optional(),
    intro: text(4000),
    align: z.enum(['left', 'center']).default('center'),
    columns: z.union([z.literal(3), z.literal(4), z.literal(5), z.literal(6)]).default(6),
    /** Draw the wall inside a rounded card. */
    framed: z.boolean().default(false),
    /** V14 — `tiles` is the original look; `grid` draws hairlines between cells; `plain` has neither. */
    style: z.enum(['tiles', 'grid', 'plain']).default('tiles'),
    /** Print each company's name under its logo. */
    captions: z.boolean().default(false),
    logos: z
      .array(z.object({ name: z.string().trim().min(1).max(80), imageUrl: mediaUrl.optional(), href: safeHref.optional() }))
      .min(1)
      .max(36),
    link: libraryLink.optional(),
  }),

  /** CT10 — a quote beside a media card, optionally a case study with buttons. */
  quote: z.object({
    tone,
    eyebrow: text(80),
    quote: z.string().trim().min(1).max(4000),
    name: text(80),
    role: text(120),
    avatarUrl: mediaUrl.optional(),
    imageUrl: mediaUrl.optional(),
    videoUrl: mediaUrl.optional(),
    alt: text(200),
    /** Opens the video in a player rather than playing it in the background. */
    mediaLabel: text(40),
    /** V12 — the photo beside the name (the original) or large above the quote, in three sizes. */
    avatarPosition: z.enum(['caption', 'above']).default('caption'),
    avatarSize: sizeSml.default('medium'),
    links: libraryLinks,
  }),

  /** CT11 — an image that changes with the chosen colour swatch. */
  configurator: z.object({
    tone,
    eyebrow: text(80),
    title: text(160),
    titleAs: textTagSchema.optional(),
    intro: text(4000),
    options: z
      .array(
        z.object({
          name: z.string().trim().min(1).max(60),
          color: z.string().trim().refine(isColor, 'Not a valid colour'),
          imageUrl: mediaUrl.optional(),
          alt: text(200),
        }),
      )
      .min(1)
      .max(12),
  }),

  /** CT14 — a large photo, then text and a smaller, offset photo. */
  collage: z.object({
    tone,
    eyebrow: text(80),
    title: text(160),
    titleAs: textTagSchema.optional(),
    body: text(4000),
    link: libraryLink.optional(),
    largeUrl: mediaUrl.optional(),
    largeAlt: text(200),
    smallUrl: mediaUrl.optional(),
    smallAlt: text(200),
    textSide: z.enum(['left', 'right']).default('left'),
  }),

  /** CT16 — heading and store links beside overlapping phone screens. */
  appPromo: z.object({
    tone,
    iconUrl: mediaUrl.optional(),
    eyebrow: text(80),
    title: z.string().max(160),
    titleAs: textTagSchema.optional(),
    body: text(4000),
    appStoreHref: safeHref.optional(),
    playStoreHref: safeHref.optional(),
    screens: z.array(z.object({ imageUrl: mediaUrl, alt: text(200) })).max(3).default([]),
  }),

  /** CT17 — a browser, app or terminal window around screenshots or code, with tabs. */
  windowFrame: z.object({
    tone,
    eyebrow: text(80),
    title: text(160),
    titleAs: textTagSchema.optional(),
    intro: text(4000),
    chrome: z.enum(WINDOW_CHROMES).default('browser'),
    /** Shown in the browser's address bar or the app's title bar. */
    address: text(120),
    /** Sidebar entries for the app frame; hidden on phones. */
    sidebar: z.array(z.string().max(40)).max(12).default([]),
    tabs: z
      .array(
        z.object({
          label: z.string().trim().min(1).max(40),
          imageUrl: mediaUrl.optional(),
          alt: text(200),
          /** Plain text, shown as code. Never rendered as HTML. */
          code: text(6000),
        }),
      )
      .min(1)
      .max(6),
  }),

  /** HD3 — a sticky bar for the current product or section: name, in-page links, one button. */
  subNav: z.object({
    name: z.string().trim().min(1).max(60),
    links: z.array(libraryLink).min(1).max(8),
    cta: libraryLink.optional(),
  }),

  /* ── Scroll effects and sign-up (SC1, SC2, CF2) ───────────────────────── */

  /** SC1 — a list whose active step picks the pinned picture beside it. */
  scrollStory: z.object({
    tone,
    eyebrow: text(80),
    title: text(160),
    titleAs: textTagSchema.optional(),
    intro: text(4000),
    numbered: z.boolean().default(true),
    items: z
      .array(
        z.object({
          title: z.string().trim().min(1).max(120),
          body: text(4000),
          imageUrl: mediaUrl.optional(),
          alt: text(200),
        }),
      )
      .min(2)
      .max(8),
  }),

  /** SC2 — the section holds still while its video advances with the scroll. */
  pinnedMedia: z.object({
    tone,
    eyebrow: text(80),
    title: text(160),
    titleAs: textTagSchema.optional(),
    body: text(4000),
    /** Scrubbed by the scroll position; muted, never autoplayed. */
    videoUrl: mediaUrl.optional(),
    /** The video's poster, or — without a video — a picture that slowly zooms. */
    imageUrl: mediaUrl.optional(),
    alt: text(200),
    /** How far the section holds still. */
    length: z.enum(['short', 'medium', 'long']).default('medium'),
  }),

  /** CF2 — an email sign-up, or a heading with a button to a sign-up page. */
  newsletter: z.object({
    tone,
    /**
     * `centered` (V15) stacks the heading over the field. The old `band` layout
     * (a heading with a button) is now an inline call to action; see migrateBlock.
     */
    layout: z.enum(['form', 'centered']).default('form'),
    /** `standard` is the original look: a rounded field around a square button. */
    fieldStyle: z.enum(['standard', 'pill', 'underline']).default('standard'),
    eyebrow: text(80),
    title: z.string().max(160),
    titleAs: textTagSchema.optional(),
    body: text(4000),
    buttonLabel: z.string().trim().min(1).max(40).default('Subscribe'),
    placeholder: text(80),
    /** Shown beside a checkbox the visitor must tick; empty means no checkbox. */
    consentText: text(300),
    successText: text(200),
  }),

  /* ── Package 2 elements ───────────────────────────────────────────────── */

  /** EL1 — a heading on its own: subtitle, highlighted words, divider, badge, typed rotating words. */
  heading: z.object({
    tone,
    align: z.enum(['left', 'center']).default('left'),
    /** `lede` is large body text, the old statement block's size. */
    size: z.enum(['medium', 'large', 'display', 'lede']).default('large'),
    /** `split` puts the subtitle beside the heading, as the old statement block did. */
    layout: z.enum(['stacked', 'split']).default('stacked'),
    /**
     * Where the two halves of a `split` sit against each other.
     *
     * `center` is what it has always done, so it stays the default and every
     * stored heading renders exactly as before. Ignored by `stacked`, where
     * there is nothing to line up.
     */
    splitAlign: z.enum(['top', 'center', 'bottom']).default('center'),
    /** SC3 — the words light up as the heading scrolls through the screen. */
    animation: z.enum(['none', 'kinetic']).default('none'),
    badge: text(40),
    eyebrow: text(80),
    title: z.string().trim().min(1).max(200),
    titleAs: textTagSchema.optional(),
    /** Words inside the title to pick out; the first match is highlighted. */
    highlight: text(80),
    /** P3-B1 adds hand-drawn marks (circle … double) and outlined or gradient letters. */
    highlightStyle: z
      .enum(['color', 'marker', 'underline', 'circle', 'curly', 'strike', 'zigzag', 'double', 'outline', 'gradient'])
      .default('color'),
    /** P3-B1 — the whole heading as solid, outlined or gradient letters. */
    textStyle: z.enum(['solid', 'outline', 'gradient']).default('solid'),
    /** Shown one after another after the title (static for reduced motion). */
    rotating: z.array(z.string().trim().min(1).max(40)).max(8).default([]),
    typingSpeed: z.enum(['slow', 'normal', 'fast']).default('normal'),
    /** P3-B1 — typed letter by letter, or each word slid, faded, flipped or blurred in. */
    rotateEffect: z.enum(['typing', 'slide', 'fade', 'flip', 'blur']).default('typing'),
    subtitle: text(4000),
    divider: z.enum(['none', 'line', 'accent']).default('none'),
  }),

  /** EL2 — a row of buttons with styles, sizes and icons. */
  buttons: z.object({
    tone,
    align: z.enum(['left', 'center', 'right']).default('left'),
    size: sizeSml.default('medium'),
    fullWidth: z.boolean().default(false),
    items: z
      .array(
        z
          .object({
            /** Always required: it is the accessible name, even when only the icon shows. */
            label: z.string().trim().min(1).max(60),
            href: safeHref,
            style: z.enum(BUTTON_STYLES).default('primary'),
            icon: z.enum(BUTTON_ICONS).default('none'),
            iconSide: z.enum(['left', 'right']).default('right'),
            iconOnly: z.boolean().default(false),
            shadow: z.boolean().default(false),
          })
          .refine((b) => !b.iconOnly || b.icon !== 'none', 'An icon-only button needs an icon'),
      )
      .min(1)
      .max(6),
  }),

  /** EL3 — an info, success, warning or danger message. */
  notice: z.object({
    kind: z.enum(NOTICE_KINDS).default('info'),
    title: text(120),
    text: z.string().trim().min(1).max(600),
    link: libraryLink.optional(),
    icon: z.boolean().default(true),
    dismissible: z.boolean().default(false),
    size: sizeSml.default('medium'),
    width: z.enum(['fit', 'full']).default('full'),
    align: z.enum(['left', 'center']).default('left'),
  }),

  /** EL4 — progress bars or rings. */
  progress: z.object({
    tone,
    eyebrow: text(80),
    title: text(160),
    titleAs: textTagSchema.optional(),
    intro: text(4000),
    kind: z.enum(['bars', 'rings']).default('bars'),
    thickness: z.enum(['thin', 'regular', 'bold']).default('regular'),
    /** Rings: the label under the ring or beside it. */
    labelPosition: z.enum(['below', 'beside']).default('below'),
    /** Bars: the value rides the end of the bar in a bubble. */
    tooltip: z.boolean().default(false),
    items: z
      .array(z.object({ label: z.string().trim().min(1).max(80), value: z.number().int().min(0).max(100), note: text(120) }))
      .min(1)
      .max(12),
  }),

  /** EL5 — a countdown to a date and time. */
  countdown: z.object({
    tone,
    eyebrow: text(80),
    title: text(160),
    titleAs: textTagSchema.optional(),
    intro: text(4000),
    target: dateTime,
    style: z.enum(['plain', 'boxed', 'inline']).default('boxed'),
    dividers: z.boolean().default(false),
    units: z.array(z.enum(COUNTDOWN_UNITS)).min(1).max(5).default(['days', 'hours', 'minutes', 'seconds']),
    expiredText: text(160),
    align: z.enum(['left', 'center']).default('center'),
  }),

  /** EL6 — social profile links as icons or names. */
  socialLinks: z.object({
    tone,
    title: text(80),
    /** `site` uses the links set in Menus, so they are kept in one place. */
    source: z.enum(['site', 'custom']).default('site'),
    links: z.array(socialItem).max(10).default([]),
    style: z.enum(SOCIAL_STYLES).default('outlined'),
    size: sizeSml.default('medium'),
    brandColors: z.boolean().default(false),
    align: z.enum(['left', 'center', 'right']).default('center'),
  }),

  /** EL7 — pricing plans, optionally with a monthly / yearly switch. */
  pricing: z.object({
    tone,
    eyebrow: text(80),
    title: text(160),
    titleAs: textTagSchema.optional(),
    intro: text(4000),
    layout: z.enum(['cards', 'contained']).default('cards'),
    billing: z.enum(['single', 'switch']).default('single'),
    monthlyLabel: text(24),
    yearlyLabel: text(24),
    /** Shown beside the yearly option ("Save 20%"). */
    yearlyNote: text(40),
    buttonPosition: z.enum(['top', 'bottom']).default('bottom'),
    plans: z
      .array(
        z.object({
          name: z.string().trim().min(1).max(40),
          tagline: text(80),
          /** Shown as written ("$29", "Free", "Talk to us"). */
          price: z.string().trim().min(1).max(20),
          period: text(24),
          yearlyPrice: text(20),
          yearlyPeriod: text(24),
          badge: text(24),
          featured: z.boolean().default(false),
          description: text(4000),
          features: z
            .array(z.object({ text: z.string().trim().min(1).max(80), included: z.boolean().default(true) }))
            .max(16)
            .default([]),
          button: libraryLink.optional(),
        }),
      )
      .min(1)
      .max(4),
    footnote: text(200),
  }),

  /** EL8 — team members as cards, with a hover overlay, or as a switchable profile. */
  team: z.object({
    tone,
    eyebrow: text(80),
    title: text(160),
    titleAs: textTagSchema.optional(),
    intro: text(4000),
    variant: z.enum(TEAM_VARIANTS).default('cards'),
    columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(3),
    hover: z.enum(['none', 'scale', 'greyscale']).default('none'),
    members: z
      .array(
        z.object({
          name: z.string().trim().min(1).max(80),
          role: text(80),
          bio: text(300),
          imageUrl: mediaUrl.optional(),
          links: z.array(socialItem).max(4).default([]),
        }),
      )
      .min(1)
      .max(16),
  }),

  /** HR7 — full-screen panels that slide over one another as the page scrolls. */
  stackedPanels: z.object({
    /** Applies to the first panel's title, so the panels can open a page. */
    titleAs: textTagSchema.optional(),
    panels: z
      .array(
        z.object({
          eyebrow: text(80),
          title: z.string().max(160),
          body: text(4000),
          imageUrl: mediaUrl.optional(),
          videoUrl: mediaUrl.optional(),
          alt: text(200),
          buttonLabel: text(40),
          href: safeHref.optional(),
        }),
      )
      .min(1)
      .max(8),
  }),

  /** P3-A1 — columns, bars, a line, an area, a pie or a doughnut, drawn on the server. */
  chart: z.object({
    ...showcaseHead,
    kind: z.enum(CHART_KINDS).default('column'),
    /** Pie and doughnut charts use the first series only. */
    series: z.array(z.object({ name: z.string().trim().min(1).max(40) })).min(1).max(4),
    rows: z
      .array(z.object({ label: z.string().trim().min(1).max(40), values: z.array(z.number().min(0).max(1e12)).min(1).max(4) }))
      .min(1)
      .max(16),
    prefix: text(6),
    suffix: text(12),
    palette: z.enum(['multi', 'accent', 'mono']).default('multi'),
    height: sizeSml.default('medium'),
    values: z.boolean().default(true),
    legend: z.boolean().default(true),
    grid: z.boolean().default(true),
    animate: z.boolean().default(true),
    caption: text(240),
  }),

  /** P3-A2 — numbered or dotted pins on a picture, each opening a small card. */
  hotspots: z.object({
    ...showcaseHead,
    imageUrl: mediaUrl.optional(),
    alt: text(200),
    marker: z.enum(HOTSPOT_MARKERS).default('dot'),
    /** How wide the picture may grow; a tall picture at full width is taller than the screen. */
    width: z.enum(['full', 'medium', 'small']).default('full'),
    pulse: z.boolean().default(true),
    trigger: z.enum(['click', 'hover']).default('click'),
    /** Also list every point beside the picture (under it on phones). */
    list: z.boolean().default(false),
    points: z
      .array(
        z.object({
          x: percent,
          y: percent,
          title: z.string().trim().min(1).max(80),
          body: text(4000),
          imageUrl: mediaUrl.optional(),
          link: libraryLink.optional(),
        }),
      )
      .min(1)
      .max(12),
    caption: text(240),
  }),

  /** P3-A3 — cards that turn over (or slide, or fade) to show a back. */
  flipBox: z.object({
    ...showcaseHead,
    effect: z.enum(FLIP_EFFECTS).default('flip'),
    direction: z.enum(['horizontal', 'vertical']).default('horizontal'),
    columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(3),
    height: sizeSml.default('medium'),
    align: z.enum(['left', 'center']).default('center'),
    cards: z
      .array(
        z.object({
          imageUrl: mediaUrl.optional(),
          iconUrl: mediaUrl.optional(),
          title: z.string().trim().min(1).max(80),
          text: text(240),
          backTitle: text(80),
          backText: text(400),
          link: libraryLink.optional(),
        }),
      )
      .min(1)
      .max(12),
  }),

  /** P3-A4 — a menu or price list: items with prices, notes, photos and tags, in groups. */
  priceList: z.object({
    ...showcaseHead,
    layout: z.enum(PRICE_LIST_LAYOUTS).default('list'),
    leader: z.enum(['dots', 'line', 'none']).default('dots'),
    /** `tabs` shows one group at a time, picked by its title. */
    groupNav: z.enum(['stacked', 'tabs']).default('stacked'),
    groups: z
      .array(
        z.object({
          title: text(80),
          note: text(200),
          items: z
            .array(
              z.object({
                name: z.string().trim().min(1).max(80),
                /** Shown as written ("€8", "from £12", "Market price"). */
                price: text(24),
                description: text(4000),
                imageUrl: mediaUrl.optional(),
                tags: z.array(z.string().trim().min(1).max(24)).max(4).default([]),
                badge: text(24),
              }),
            )
            .min(1)
            .max(30),
        }),
      )
      .min(1)
      .max(8),
    footnote: text(300),
  }),

  /** P3-A5 — opening hours, with today marked and a live "open now". */
  businessHours: z.object({
    ...showcaseHead,
    style: z.enum(HOURS_STYLES).default('list'),
    /** A day that is not listed, or has no slots, is closed. */
    week: z
      .array(z.object({ day: z.enum(WEEKDAYS), slots: z.array(z.object({ open: clockTime, close: clockTime })).max(3).default([]) }))
      .max(7)
      .default([])
      .refine((week) => unique(week.map((d) => d.day)), 'List each day once'),
    /** Join days that keep the same hours ("Mon – Fri"). */
    merge: z.boolean().default(true),
    firstDay: z.enum(['mon', 'sun']).default('mon'),
    clock: z.enum(['24h', '12h']).default('24h'),
    status: z.boolean().default(true),
    today: z.boolean().default(true),
    /** Empty = the site's time zone from Settings. */
    timeZone: z.string().trim().max(60).refine(isTimeZone, 'Use a time zone name like Europe/London').optional(),
    closedLabel: text(24),
    notes: z.array(z.object({ label: z.string().trim().min(1).max(40), text: z.string().trim().min(1).max(80) })).max(8).default([]),
    link: libraryLink.optional(),
  }),

  /** P3-A6 — share this page: network links, copy link and the device's own share sheet. */
  share: z.object({
    tone,
    title: text(80),
    /** Put before the link where the network allows it; the page title when empty. */
    text: text(200),
    networks: z
      .array(z.enum(SHARE_NETWORKS))
      .min(1)
      .max(SHARE_NETWORKS.length)
      .default(['x', 'linkedin', 'facebook', 'whatsapp', 'email', 'copy'])
      .refine(unique, 'List each network once'),
    style: z.enum(SHARE_STYLES).default('buttons'),
    size: sizeSml.default('medium'),
    brandColors: z.boolean().default(false),
    align: z.enum(['left', 'center', 'right']).default('left'),
    /** `floating` pins the buttons to the side of the screen on wide screens; `floatingLeft` (2.18) to the left side. */
    position: z.enum(['inline', 'floating', 'floatingLeft']).default('inline'),
  }),

  /** P3-A7 — reviews with star ratings and where they came from, with a rating summary. */
  reviews: z.object({
    ...showcaseHead,
    layout: z.enum(REVIEW_LAYOUTS).default('grid'),
    columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(3),
    summary: z
      .object({
        rating: z.number().min(0).max(5),
        /** Shown as written ("1,932 reviews"). */
        count: text(40),
        label: text(60),
        link: libraryLink.optional(),
      })
      .optional(),
    summaryPosition: z.enum(['top', 'side']).default('top'),
    items: z
      .array(
        z.object({
          name: z.string().trim().min(1).max(80),
          /** 2.19 — shown as "Role · Company"; `meta` is the older free line, kept for stored reviews. */
          role: text(80),
          company: text(80),
          meta: text(80),
          avatarUrl: mediaUrl.optional(),
          /** 2.19 — a colour behind the picture, which then draws as a logo: fitted, not cropped. */
          avatarColor: z.string().trim().refine(isColor, 'Not a valid colour').optional(),
          rating: z.number().min(0).max(5).multipleOf(0.5).optional(),
          title: text(120),
          text: z.string().trim().min(1).max(800),
          date: text(40),
          source: text(40),
        }),
      )
      .min(1)
      .max(24),
    link: libraryLink.optional(),
    /** 2.19 — leave the stars off even where a review has a rating. */
    hideRatings: z.boolean().optional(),
    /** 2.19 — the cards' own look; unset is the theme's surface, hairline and card radius. */
    card: z
      .object({
        background: z.string().trim().refine(isColor, 'Not a valid colour').optional(),
        radius: z.number().int().min(0).max(40).optional(),
        border: z.boolean().optional(),
        quoteMark: z.boolean().optional(),
      })
      .optional(),
  }),

  /**
   * 2.22 (GG2) — the blog's categories (or the projects') as a grid of
   * numbered cards, each with its description, linking to its archive. Read
   * from the site, so a new category appears without editing the page.
   */
  categoryIndex: z.object({
    tone,
    eyebrow: text(80),
    title: text(160),
    titleAs: textTagSchema.optional(),
    intro: text(1000),
    source: z.enum(['blog', 'projects']).default('blog'),
    numbered: z.boolean().default(true),
    /** 3.6 — `slash` reads "/01". */
    numberStyle: z.enum(['plain', 'slash']).optional(),
    descriptions: z.boolean().default(true),
    columns: z.union([z.literal(2), z.literal(3)]).default(2),
    limit: z.number().int().min(1).max(24).default(12),
  }),

  /** P3-A8 — a table of contents built from the headings on the page. */
  toc: z.object({
    tone,
    title: text(80),
    levels: z.enum(['h2', 'h2h3']).default('h2h3'),
    /** `row` lists only the headings in the same row — a contents list beside an article; `article` (2.18) only the post's own. */
    scope: z.enum(['page', 'row', 'article']).default('page'),
    style: z.enum(TOC_STYLES).default('boxed'),
    sticky: z.boolean().default(false),
    collapsible: z.boolean().default(false),
    highlight: z.boolean().default(true),
  }),

  /** P3-A9 — where this page sits: Home › Section › Page. */
  breadcrumbs: z.object({
    tone,
    /** `page` shows the page's own trail — the one search engines are given. */
    source: z.enum(['page', 'custom']).default('page'),
    items: z.array(libraryLink).max(6).default([]),
    /** This page's name; the page title when empty. */
    current: text(80),
    showHome: z.boolean().default(true),
    homeLabel: text(40),
    separator: z.enum(['chevron', 'slash', 'dot', 'arrow']).default('chevron'),
    style: z.enum(CRUMB_STYLES).default('plain'),
    align: z.enum(['left', 'center']).default('left'),
  }),

  /** P3-A10 — words set along a circle, an arc or a wave; the circle can turn. */
  textPath: z.object({
    tone,
    text: z.string().trim().min(1).max(120),
    shape: z.enum(TEXT_PATH_SHAPES).default('circle'),
    size: sizeSml.default('medium'),
    spin: z.enum(['none', 'slow', 'fast']).default('slow'),
    centerImageUrl: mediaUrl.optional(),
    centerText: text(12),
    href: safeHref.optional(),
    color: z.enum(['text', 'accent']).default('text'),
    align: z.enum(['left', 'center', 'right']).default('center'),
  }),

  /** P3-A11 — a search box for the blog, with suggested searches. */
  search: z.object({
    tone,
    title: text(120),
    titleAs: textTagSchema.optional(),
    intro: text(4000),
    placeholder: text(60),
    buttonLabel: text(30),
    style: z.enum(SEARCH_STYLES).default('bar'),
    size: sizeSml.default('medium'),
    align: z.enum(['left', 'center']).default('left'),
    suggestionsLabel: text(40),
    suggestions: z.array(z.string().trim().min(1).max(40)).max(8).default([]),
  }),

  /** P3-E — a form built from chosen fields, optionally in steps; answers are kept in Form submissions. */
  form: z.object({
    ...showcaseHead,
    /** How its submissions are labelled in the admin. */
    formName: z.string().trim().min(1).max(120),
    fields: z
      .array(formFieldSchema)
      .min(1)
      .max(30)
      .refine((fields) => unique(fields.map((f) => f.id)), 'Two fields share an id'),
    layout: z.enum(['card', 'plain']).default('card'),
    align: z.enum(['left', 'center']).default('left'),
    /** 3.2 — the form runs the full width of the section instead of its reading width. */
    wide: z.boolean().optional(),
    submitLabel: text(40),
    /** 2.22 — a short line beside the send button: "We reply within one working day". */
    submitNote: text(160),
    /* ── 3.4 ─────────────────────────────────────────────────────────────── */
    /** false leaves "(optional)" off the questions that need no answer. */
    optionalMark: z.boolean().optional(),
    /** An arrow on the send button, as on the site's other buttons. */
    submitArrow: z.boolean().optional(),
    /** Space inside the card: one length, or two (top and bottom, then the sides). */
    cardPadding: z
      .string()
      .trim()
      .max(40)
      .refine((v) => {
        if (v === '') return true;
        const parts = v.split(/\s+/);
        return parts.length <= 2 && parts.every(isLength);
      }, 'One or two CSS lengths')
      .optional(),
    /** Choice chips sized to their text instead of the page's line height. */
    compactChoices: z.boolean().optional(),
    successTitle: text(120),
    successText: text(400),
    /* ── 2.16 (T12, T13) ────────────────────────────────────────────────── */
    /** Bot protection for this form: the site's setting, or on or off regardless. */
    captcha: z.enum(['inherit', 'on', 'off']).default('inherit'),
    /** Where the answers are emailed, and how. See lib/forms.ts. */
    notify: formNotifySchema.prefault({}),
    /** A reply to whoever sent it. */
    autoresponder: formAutoresponderSchema.prefault({}),
    /** What happens after a successful send. */
    after: formAfterSchema.prefault({}),
    /** Values sent with the answers that nobody types — a campaign, where they came from. */
    hidden: z.array(formHiddenSchema).max(12).default([]),
  }),

  /**
   * T8 (2.15) — a synced saved block, placed by reference. The block holds
   * only which saved block it shows; editing that saved block changes every
   * page that uses it. `name` is a copy for the builder's card, never read by
   * the page. The instance's own `style` is its outer spacing and visibility.
   */
  savedBlock: z.object({
    savedBlockId: z.string().uuid(),
    name: z.string().trim().max(120).optional(),
  }),

  /** P3-F — a Lottie animation from the media library, played on a loop, once, on hover or with the scroll. */
  lottie: z.object({
    ...showcaseHead,
    /** Empty until one is chosen; the block then shows nothing on the site. */
    url: z.union([z.literal(''), z.string().trim().regex(LOTTIE_PATH, 'Choose a Lottie .json file from the media library')]).default(''),
    mediaId: z.string().optional(),
    /** What the animation shows, for screen readers. Empty means it is decoration. */
    label: text(200),
    play: z.enum(LOTTIE_PLAY).default('loop'),
    speed: z.number().min(0.25).max(3).default(1),
    /** The frame shown to visitors who ask for less motion, and before it plays. */
    still: z.enum(['first', 'last']).default('first'),
    /** `accent` and `text` repaint every shape in the theme's colour. */
    color: z.enum(['original', 'accent', 'text']).default('original'),
    size: z.enum(['small', 'medium', 'large', 'full']).default('medium'),
    align: z.enum(['left', 'center', 'right']).default('center'),
    caption: text(300),
    /** The animation's own size, copied from the file, so its space is kept before it loads. */
    width: z.number().int().positive().max(8000).optional(),
    height: z.number().int().positive().max(8000).optional(),
  }),
} as const;

export type BlockType = keyof typeof blockSchemas;

export type BlockOf<T extends BlockType> = {
  id: string;
  type: T;
  props: z.input<(typeof blockSchemas)[T]>;
  style?: BlockStyle;
};

/**
 * `style` sits beside `id` and `type` rather than inside `props` on purpose:
 * spacing, background and width mean the same thing for every block, so they
 * belong to the block rather than to its type. Eighteen schemas do not each
 * need to redeclare them, and a new block type gets the whole Design panel for
 * free.
 */
export type AnyBlock = {
  id: string;
  type: string;
  props: Record<string, unknown>;
  style?: unknown;
};

export const blockTypes = Object.keys(blockSchemas) as BlockType[];

/** Human labels for the admin block picker. */
export const blockLabels: Record<BlockType, string> = {
  hero: 'Hero',
  stats: 'Stats band',
  prose: 'Text',
  splitPoints: 'Split points',
  cardGrid: 'Card grid',
  numberedList: 'Numbered list',
  checkLists: 'Icon lists',
  faq: 'FAQ accordion',
  cta: 'Call to action',
  pager: 'Next/previous pager',
  servicesIndex: 'Services index',
  postList: 'Post list',
  contactForm: 'Contact form',
  infoPanel: 'Info panel',
  image: 'Image',
  table: 'Table',
  figure: 'Figure / diagram',
  spacer: 'Divider / spacer',
  row: 'Row and columns',
  carousel: 'Carousel / slider',
  marquee: 'Scrolling strip',
  stackedPanels: 'Stacked panels',
  splitMedia: 'Image beside text',
  overlayCard: 'Text card over image',
  mediaBand: 'Full-width image band',
  tabs: 'Tabbed panel',
  logoWall: 'Logo wall',
  quote: 'Quote / case study',
  configurator: 'Colour picker',
  collage: 'Photo collage',
  appPromo: 'App download',
  windowFrame: 'Product window',
  subNav: 'Section sub-nav',
  scrollStory: 'Scroll story',
  pinnedMedia: 'Pinned media',
  newsletter: 'Newsletter sign-up',
  heading: 'Heading',
  buttons: 'Buttons',
  notice: 'Message',
  progress: 'Progress',
  countdown: 'Countdown',
  socialLinks: 'Social links',
  pricing: 'Pricing',
  team: 'Team',
  compare: 'Before and after',
  video: 'Video',
  gallery: 'Gallery',
  horizontalAccordion: 'Horizontal accordion',
  projects: 'Projects',
  map: 'Map',
  chart: 'Chart',
  hotspots: 'Image hotspots',
  flipBox: 'Flip cards',
  priceList: 'Price list / menu',
  businessHours: 'Opening hours',
  share: 'Share buttons',
  reviews: 'Reviews',
  toc: 'Table of contents',
  categoryIndex: 'Category index',
  breadcrumbs: 'Breadcrumbs',
  textPath: 'Text on a path',
  search: 'Search box',
  form: 'Form',
  lottie: 'Lottie animation',
  savedBlock: 'Saved block',
};

export function isBlockType(t: string): t is BlockType {
  return t in blockSchemas;
}

/** Validate + fill defaults. Returns null for unknown or malformed blocks so a
 *  bad block from the editor can never crash a public page. */
export type ParsedBlock = { id: string; type: BlockType; props: unknown; style?: BlockStyle };

/** A column once its own blocks have been parsed. */
export type ParsedColumn = {
  id: string;
  width: z.infer<typeof columnWidthSchema>;
  order?: z.infer<typeof columnOrderSchema>;
  style?: BlockStyle;
  blocks: ParsedBlock[];
};

export type ParsedRowProps = {
  columns: ParsedColumn[];
  gap?: string;
  align: 'start' | 'center' | 'end' | 'stretch';
  reverseOnMobile?: boolean;
  minHeight?: string;
};

/**
 * How many rows may nest inside one another.
 *
 * Three: a row, a row inside one of its columns, and a row inside one of
 * *those* columns. That covers every real layout — a two-column section whose
 * left half is a three-up grid, say — without letting a page become a tree
 * nobody can edit.
 *
 * The limit exists at all because each level is a grid inside a grid: the
 * columns are container-query contexts, and blocks size their internals
 * against the container. Past three the widths stop meaning anything.
 */
export const MAX_ROW_DEPTH = 3;

/**
 * Parse a row's columns and the blocks inside them.
 *
 * The depth rule is enforced here, in the one place that builds the tree,
 * because the schema cannot express "a row, but only this far down" without
 * becoming recursive.
 */
function parseRowProps(props: z.infer<(typeof blockSchemas)['row']>, depth: number): ParsedRowProps {
  return {
    ...props,
    columns: props.columns.map((column) => ({
      id: column.id,
      width: column.width,
      ...(column.order && Object.keys(column.order).length > 0 ? { order: column.order } : {}),
      style: column.style && Object.keys(column.style).length > 0 ? column.style : undefined,
      blocks: (column.blocks as AnyBlock[])
        .map((child) => (child && typeof child === 'object' ? parseBlock(child, depth + 1) : null))
        .filter((child): child is ParsedBlock => child !== null),
    })),
  };
}

/**
 * Blocks that were merged into another keep working: a stored block of a
 * retired type is read as the block it became, with every setting carried
 * across. Saving it in the builder then stores the new type. When merging
 * again, add the old type here — and never reuse a retired type's name.
 *
 *   richText        → prose (Text), same heading, rich text and small-print style
 *   statement       → heading: split layout, lede size, still a paragraph, raised
 *   parallaxImage   → mediaBand with `parallax`
 *   newsletter band → cta, inline layout
 */
export function migrateBlock(block: AnyBlock): AnyBlock {
  const p = block.props ?? {};
  switch (block.type) {
    case 'richText':
      return { ...block, type: 'prose', props: { tone: p.tone, title: p.title, titleAs: p.titleAs, html: p.html, variant: p.variant } };
    case 'statement':
      return {
        ...block,
        type: 'heading',
        props: {
          tone: p.tone ?? 'raised',
          eyebrow: p.eyebrow,
          title: p.statement,
          subtitle: p.support,
          titleAs: 'p',
          size: 'lede',
          layout: 'split',
          animation: p.animation,
        },
      };
    case 'parallaxImage':
      return {
        ...block,
        type: 'mediaBand',
        props: {
          imageUrl: p.imageUrl,
          alt: p.alt,
          parallax: p.direction ?? 'vertical',
          strength: p.strength,
          height: p.height ?? 'medium',
          overlay: p.overlay === 'none' ? 'none' : p.overlay === 'gradient' ? 'gradient' : 'medium',
          position: p.align === 'left' ? 'left' : 'center',
          eyebrow: p.eyebrow,
          title: p.title ?? '',
          titleAs: p.titleAs,
          body: p.body,
          links: p.link ? [p.link] : [],
        },
      };
    case 'newsletter':
      if (p.layout !== 'band') return block;
      return {
        ...block,
        type: 'cta',
        props: {
          variant: 'inline',
          tone: p.tone,
          eyebrow: p.eyebrow,
          title: p.title,
          titleAs: p.titleAs,
          body: p.body,
          links: typeof p.href === 'string' ? [{ label: p.buttonLabel ?? 'Subscribe', href: p.href }] : [],
        },
      };
    default:
      return block;
  }
}

/** migrateBlock for a whole list, including the blocks inside rows — what the builder edits. */
export function migrateBlocks(blocks: AnyBlock[]): AnyBlock[] {
  return blocks.map((raw) => {
    const block = migrateBlock(raw);
    if (block.type !== 'row') return block;
    const columns = (block.props.columns ?? []) as { blocks?: AnyBlock[] }[];
    return { ...block, props: { ...block.props, columns: columns.map((c) => ({ ...c, blocks: migrateBlocks(c.blocks ?? []) })) } };
  });
}

export function parseBlock(input: AnyBlock, depth = 1): ParsedBlock | null {
  const block = migrateBlock(input);
  if (!isBlockType(block.type)) return null;
  if (!BLOCK_ID_PATTERN.test(block.id ?? '')) return null;

  /* A row deeper than the limit is dropped rather than rendered. Every other
     block type nests as deep as its row does. */
  if (block.type === 'row' && depth > MAX_ROW_DEPTH) return null;

  const result = blockSchemas[block.type].safeParse(block.props ?? {});
  if (!result.success) return null;

  // A malformed style must not cost the page its content: the block renders
  // unstyled, exactly as it did before styles existed.
  const style = blockStyleSchema.safeParse(block.style ?? {});

  return {
    id: block.id,
    type: block.type,
    props:
      block.type === 'row'
        ? parseRowProps(result.data as z.infer<(typeof blockSchemas)['row']>, depth)
        : result.data,
    style: style.success && Object.keys(style.data).length > 0 ? style.data : undefined,
  };
}

/**
 * Every block on a page that would be dropped at render, described well enough
 * for an editor to find it. Recurses into rows, because a broken block three
 * levels into a layout is exactly the one nobody notices.
 */
export function collectInvalidBlocks(
  blocks: AnyBlock[] | null | undefined,
  path = '',
  depth = 1,
): string[] {
  const problems: string[] = [];

  (blocks ?? []).forEach((block, index) => {
    const where = path ? `${path} → block ${index + 1}` : `Block ${index + 1}`;

    /* Named rather than reported as invalid: the row is well formed, it is
       only too deep to render, and "not valid for its type" would send the
       editor looking for a typo that is not there. */
    if (block?.type === 'row' && depth > MAX_ROW_DEPTH) {
      problems.push(`${where} ("row") is nested more than ${MAX_ROW_DEPTH} rows deep and will not show`);
      return;
    }

    if (parseBlock(block, depth) === null) {
      problems.push(`${where} ("${block?.type ?? 'unknown'}") is not valid for its type`);
      return;
    }

    if (block.type === 'row') {
      const columns = (block.props?.columns ?? []) as { blocks?: AnyBlock[] }[];
      columns.forEach((column, ci) => {
        problems.push(...collectInvalidBlocks(column?.blocks ?? [], `${where}, column ${ci + 1}`, depth + 1));
      });
    }
  });

  return problems;
}

export function parseBlocks(blocks: AnyBlock[] | null | undefined) {
  /* Not point-free: `map` would hand `parseBlock` the array index as its
     depth, and every block after the third would be treated as too deep. */
  return (blocks ?? [])
    .map((block) => parseBlock(block))
    .filter((b): b is NonNullable<typeof b> => b !== null);
}
