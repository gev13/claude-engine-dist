import { BREAKPOINTS, FONT_STACKS, isColor, isUsableLength as isLength } from './theme';
import { type BlockStyle, type ColumnOrder, type ColumnWidth, GRADIENT_ANGLES, SECTION_VIDEO, type SpacingBox, type TypeOverride } from './blockStyle';

/* ═══════════════════════════════════════════════════════════════════════════
   Section style → CSS
   ───────────────────────────────────────────────────────────────────────────
   Pure, and unit-tested alongside the theme generator it mirrors.

   Each styled block gets one generated class, `.he-b-<id>`, so nothing is
   written as an inline style attribute: the same rules can then carry media
   queries, hover states and descendant selectors, and the CSP does not have to
   allow anything it does not already allow.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Ids come from the editor, so they are never trusted into a selector. */
export function isSafeBlockId(id: string): boolean {
  return /^[A-Za-z0-9_-]{1,64}$/.test(id);
}

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

const CSS_SIDE: Record<keyof SpacingBox, string> = {
  marginTop: 'margin-top',
  marginRight: 'margin-right',
  marginBottom: 'margin-bottom',
  marginLeft: 'margin-left',
  paddingTop: 'padding-top',
  paddingRight: 'padding-right',
  paddingBottom: 'padding-bottom',
  paddingLeft: 'padding-left',
};

function boxDecls(box: SpacingBox | undefined): Decl[] {
  if (!box) return [];
  const out: Decl[] = [];
  for (const [key, property] of Object.entries(CSS_SIDE) as [keyof SpacingBox, string][]) {
    push(out, property, box[key], isLength);
  }
  return out;
}

function backgroundDecls(style: BlockStyle): Decl[] {
  const out: Decl[] = [];
  const bg = style.background;
  if (!bg) return out;

  push(out, 'background-color', bg.color, isColor);

  // The image is a URL rather than a length or a colour, so it gets its own
  // check: same-origin path or a full http(s) URL, and nothing that could
  // close the url() and start a new declaration.
  const url = safe(bg.imageUrl);
  if (url && /^(\/[A-Za-z0-9._~\-/%]*|https?:\/\/[A-Za-z0-9._~\-/%?=&:]+)$/.test(url) && !url.includes(')')) {
    out.push(['background-image', `url("${url}")`]);
    push(out, 'background-size', bg.size, isKeyword(['cover', 'contain', 'auto']));
    push(out, 'background-position', bg.position, isKeyword(['center', 'top', 'bottom', 'left', 'right']));
    push(out, 'background-repeat', bg.repeat, isKeyword(['no-repeat', 'repeat', 'repeat-x', 'repeat-y']));
    push(out, 'background-attachment', bg.attachment, isKeyword(['scroll', 'fixed']));
  } else {
    const gradient = gradientValue(bg.gradient);
    if (gradient) {
      out.push(['background-image', gradient]);
      if (bg.gradient?.animate) {
        out.push(['background-size', '220% 220%']);
        out.push(['animation', 'he-grad 16s ease-in-out infinite alternate']);
      }
    }
  }

  return out;
}

/** P3-C4 — a linear gradient from checked colours and a closed list of angles; null if anything fails. */
function gradientValue(g: NonNullable<BlockStyle['background']>['gradient']): string | null {
  if (!g?.from || !g.to) return null;
  const stops = [g.from, g.via, g.to].filter((c): c is string => c !== undefined).map((c) => safe(c));
  if (stops.some((c) => !c || !isColor(c))) return null;
  const angle = g.angle && (GRADIENT_ANGLES as readonly string[]).includes(g.angle) ? g.angle : '135';
  return `linear-gradient(${angle}deg,${stops.join(',')})`;
}

/**
 * The sides of the block's own band that a chosen padding replaces.
 *
 * Every block paints a full-bleed band with its own vertical rhythm — `py-24`
 * as a Tailwind utility, `padding-block: 88px` in the components layer. Both
 * sit in a layer, and the rules here do not, so a padding chosen in the Design
 * panel wins on the wrapper — but the wrapper is *outside* the band, so the two
 * used to add up, and setting a padding to 0 changed nothing at all. That is
 * the "I can't edit this section's padding" report.
 *
 * So a side the editor sets takes the band's side with it; a side they leave
 * alone keeps the block's own rhythm. Same bargain the background already
 * strikes when it makes the band transparent.
 */
function neutralisePadding(root: string, box: SpacingBox | undefined): string {
  if (!box) return '';
  const decls: Decl[] = [];
  for (const [key, property] of Object.entries(CSS_SIDE) as [keyof SpacingBox, string][]) {
    if (!property.startsWith('padding')) continue;
    const clean = safe(box[key]);
    if (clean && isLength(clean)) decls.push([property, '0']);
  }

  /* Two places, because the blocks disagree about where the band's padding
     lives: the library sections carry it themselves (`padding-block: 88px` on
     the section), while the older blocks put it on the inner `.shell`
     (`py-14 md:py-20`). Both are one or two steps below the wrapper and
     nowhere near a nested block's own section, which is why this is written
     structurally rather than as a descendant sweep. */
  return block(`${root}>*,${root}>*>.shell`, decls);
}

function borderDecls(style: BlockStyle): Decl[] {
  const out: Decl[] = [];
  const border = style.border;
  if (!border) return out;

  push(out, 'border-top-width', border.topWidth, isLength);
  push(out, 'border-right-width', border.rightWidth, isLength);
  push(out, 'border-bottom-width', border.bottomWidth, isLength);
  push(out, 'border-left-width', border.leftWidth, isLength);
  push(out, 'border-color', border.color, isColor);
  push(out, 'border-style', border.style, isKeyword(['none', 'solid', 'dashed', 'dotted', 'double']));
  push(out, 'border-radius', border.radius, isLength);

  return out;
}

function typeDecls(override: TypeOverride | undefined): Decl[] {
  if (!override) return [];
  const out: Decl[] = [];

  if (override.family && override.family in FONT_STACKS) {
    out.push(['font-family', FONT_STACKS[override.family]]);
  }
  push(out, 'font-size', override.size, isLength);
  push(out, 'font-weight', override.weight, isKeyword(['100', '200', '300', '400', '500', '600', '700', '800', '900']));
  push(out, 'color', override.color, isColor);
  push(out, 'line-height', override.lineHeight, (v) => /^(?:\d*\.?\d+|\d*\.?\d+(?:px|rem|em))$/.test(v));
  push(out, 'letter-spacing', override.letterSpacing, isLength);
  push(out, 'text-transform', override.transform, isKeyword(['none', 'uppercase', 'lowercase', 'capitalize']));
  push(out, 'text-align', override.align, isKeyword(['left', 'center', 'right']));

  return out;
}

function block(selector: string, decls: Decl[]): string {
  if (decls.length === 0) return '';
  return `${selector}{${decls.map(([p, v]) => `${p}:${v}`).join(';')}}`;
}

/**
 * Render one block's style as a stylesheet scoped to `.he-b-<id>`.
 *
 * Returns an empty string for a block that has no style, which is the common
 * case — an unstyled page ships no per-block CSS at all.
 */
/**
 * The element a `swipeOn` turns into a track, which is not the same element
 * for a row as for everything else.
 *
 * A row's tracks are its own generated grid, one level inside the shell —
 * matched exactly, so setting swipe on an outer row does not also flatten the
 * rows nested inside it. Every other block draws its grid with Tailwind's
 * `grid-cols-*`, which only ever appears once in a block that is not a row.
 */
function swipeTarget(root: string, isRow: boolean): string {
  return isRow ? `${root}>.shell>[class^="he-r-"]` : `${root} [class*="grid-cols-"]`;
}

/**
 * Turn a grid into a horizontal scroll-snap track.
 *
 * `flex-direction` is set explicitly because a row with `reverseOnMobile`
 * has already been told `column-reverse` at this width; swiping wins, and
 * has to say so rather than inherit a stacking rule.
 */
function swipeCss(root: string, isRow: boolean, maxWidth: number): string {
  const target = swipeTarget(root, isRow);
  return (
    `@media (max-width:${maxWidth}px){` +
    `${target}{display:flex;flex-direction:row;grid-template-columns:none;` +
    `overflow-x:auto;scroll-snap-type:x mandatory;` +
    `scroll-padding-inline:var(--spacing-gutter,24px);` +
    `scrollbar-width:none;-webkit-overflow-scrolling:touch}` +
    `${target}::-webkit-scrollbar{display:none}` +
    /* A card shy of full width, so the sliver of the next one is the thing
       that says "this scrolls" — no arrows, no dots, no script. */
    `${target}>*{flex:0 0 84%;min-width:0;scroll-snap-align:start}` +
    `}`
  );
}

export function blockStyleToCss(
  id: string,
  style: BlockStyle | undefined,
  prefix = 'he-b',
  /** Rows keep their grid somewhere else; see `swipeTarget`. */
  isRow = false,
): string {
  if (!style || !isSafeBlockId(id)) return '';

  const root = `.${prefix}-${id}`;
  const parts: string[] = [];

  /* Only a block's own wrapper stands directly outside the band it paints. A
     column's children are whole blocks, and their bands are not the column's
     to flatten. */
  const ownsBand = prefix === 'he-b';

  const background = backgroundDecls(style);
  const border = borderDecls(style);

  /* Two inherited properties rather than rules aimed at anything.
     
     `--he-gap` is read by every item grid in the stylesheets — each with its
     own drawn-in value as the fallback, so a block nobody touched is
     unchanged. Inline spacing (an icon beside a word) deliberately does not
     read it: that is not what anybody means by "space between items", and a
     single property that moved both would be unusable.
     
     `--he-motion` multiplies every duration, so a block's hover at 150ms and
     its entrance at 600ms keep their relation to each other. One duration for
     both would flatten a deliberate difference. */
  const own: Decl[] = [];
  const gap = safe(style.gap);
  if (gap && isLength(gap)) own.push(['--he-gap', gap]);
  if (typeof style.motion === 'number' && Number.isFinite(style.motion) && style.motion >= 0) {
    own.push(['--he-motion', String(style.motion)]);
  }

  parts.push(block(root, [...boxDecls(style.spacing?.base), ...own, ...background, ...border]));

  if (ownsBand) {
    parts.push(neutralisePadding(root, style.spacing?.base));

    /* Setting a width or a style is taking charge of the block's edges, so the
       band's own hairline rule goes. Radius and colour alone are not: they
       describe a border rather than ask for one. */
    if (border.some(([property]) => property.endsWith('-width') || property === 'border-style')) {
      parts.push(`${root}>*{border-width:0}`);
    }
  }

  /* Every block paints its own band. With a background chosen here, that band
     steps aside so the choice is actually seen — unlayered, so it beats the
     band's own utility or component rule. */
  const video = Boolean(style.background?.videoUrl && SECTION_VIDEO.test(style.background.videoUrl));
  if (video || background.some(([property]) => property === 'background-color' || property === 'background-image')) {
    parts.push(`${root}>*{background:transparent}`);
  }
  if (style.background?.gradient?.animate && background.some(([property]) => property === 'animation')) {
    parts.push(`@media (prefers-reduced-motion:reduce){${root}{animation:none}}.he-reduce-motion ${root}{animation:none}`);
  }

  // An overlay needs a stacking context and a pseudo-element; only emitted
  // when there is actually something to lay it over.
  const overlay = safe(style.background?.overlay);
  // A video background (2.17) sits in the same stacking context, under the overlay.
  if (video || (overlay && isColor(overlay))) parts.push(`${root}{position:relative;isolation:isolate}`);
  if (overlay && isColor(overlay)) {
    parts.push(
      `${root}::before{content:"";position:absolute;inset:0;background:${overlay};pointer-events:none;z-index:-1}`,
    );
  }

  const heading = typeDecls(style.typography?.heading);
  if (heading.length) {
    parts.push(block(`${root} :is(h1,h2,h3,h4,h5,h6)`, heading));
  }

  const body = typeDecls(style.typography?.body);
  if (body.length) {
    parts.push(block(`${root} :is(p,li,td,span)`, body));
  }

  for (const { key, maxWidth } of BREAKPOINTS) {
    const decls = boxDecls(style.spacing?.[key]);
    // `hideAt` (2.19) has its own exact ranges below; the old `hideOn` keeps the rule it always had.
    const hidden = !style.hideAt && style.hideOn?.includes(key);
    const inner: string[] = [];
    if (decls.length) inner.push(block(root, decls));
    if (ownsBand) inner.push(neutralisePadding(root, style.spacing?.[key]));
    if (hidden) inner.push(`${root}{display:none}`);
    if (inner.filter(Boolean).length) parts.push(`@media (max-width:${maxWidth}px){${inner.join('')}}`);

    /* Its own media query rather than a line in the one above: the track
       rules carry their own selectors, and folding two selector sets into one
       block would mean emitting the wider one's declarations for both. */
    if (style.swipeOn === key) parts.push(swipeCss(root, isRow, maxWidth));
  }

  /* 2.19 (T32) — hidden on exactly the tiers chosen, each its own range, so
     "phones only" is expressible: hidden on large desktop, desktop and tablet. */
  for (const tier of style.hideAt ?? []) {
    const range = TIER_RANGE[tier];
    if (range) parts.push(`@media ${range}{${root}{display:none}}`);
  }

  /* A fixed background is the parallax effect, and it has two well-known
     failure modes rather than one. On touch devices it either janks or is
     ignored outright, and for anyone who has asked for less motion it is
     exactly the kind of movement they asked not to see. Both fall back to a
     background that simply scrolls with its section — which still looks
     deliberate, because the image and overlay are unchanged. */
  if (style.background?.attachment === 'fixed') {
    parts.push(`@media (hover:none),(prefers-reduced-motion:reduce){${root}{background-attachment:scroll}}`);
  }

  return parts.filter(Boolean).join('');
}

/* ── Rows and columns ─────────────────────────────────────────────────────── */

export type RowCssInput = {
  id: string;
  gap?: string;
  align?: 'start' | 'center' | 'end' | 'stretch';
  reverseOnMobile?: boolean;
  minHeight?: string;
  columns: { id: string; width: ColumnWidth; order?: ColumnOrder; style?: BlockStyle }[];
};

/**
 * The track list for a row at one breakpoint.
 *
 * Tracks come from the columns themselves, one per column, sized in twelfths —
 * **not** from a fixed twelve-track grid. That was the original design and it
 * was wrong: twelve tracks carry eleven gaps, so a row with a 48px gap has a
 * minimum width of 528px and overflows any phone, whatever the spans say.
 * One track per column means one gap per boundary, and a row that fits.
 *
 * When every column is full width the row stacks: a single track, so the gap
 * becomes the space *between* stacked columns rather than beside them.
 */
function trackList(spans: number[]): string {
  if (spans.length === 0) return 'minmax(0,1fr)';
  if (spans.every((s) => s >= 12)) return 'minmax(0,1fr)';
  return spans.map((s) => `minmax(0,${s}fr)`).join(' ');
}

/** A column's span at a breakpoint, inheriting from the next one up. */
function spanAt(width: ColumnWidth, breakpoint: 'base' | 'laptop' | 'tablet' | 'mobile'): number {
  if (breakpoint === 'base') return width.base;
  if (breakpoint === 'laptop') return width.laptop ?? width.base;
  if (breakpoint === 'tablet') return width.tablet ?? width.laptop ?? width.base;
  return width.mobile ?? width.tablet ?? width.laptop ?? width.base;
}

/** Each tier as its own width range — the four never overlap (2.19). */
const TIER_RANGE: Record<'base' | 'laptop' | 'tablet' | 'mobile', string> = {
  base: '(min-width:1441px)',
  laptop: '(min-width:1025px) and (max-width:1440px)',
  tablet: '(min-width:769px) and (max-width:1024px)',
  mobile: '(max-width:768px)',
};

export function rowToCss(row: RowCssInput): string {
  if (!isSafeBlockId(row.id)) return '';

  const root = `.he-r-${row.id}`;
  const columns = row.columns.filter((c) => isSafeBlockId(c.id));

  /**
   * A column hidden at a breakpoint must lose its track there too.
   *
   * `display:none` removes the column from the grid's flow but not its track
   * from the template, so the remaining columns kept their old share and the
   * rest of the row was blank — the hero's text sat in 648px of a 1024px
   * viewport with the hidden figure's 347px empty beside it.
   */
  const tracksAt = (breakpoint: 'base' | 'laptop' | 'tablet' | 'mobile') =>
    trackList(
      columns
        .filter((c) =>
          // `hideAt` removes a column's track on exactly its tiers; `hideOn` keeps the rule it always had.
          c.style?.hideAt ? !c.style.hideAt.includes(breakpoint) : breakpoint === 'base' || !c.style?.hideOn?.includes(breakpoint),
        )
        .map((c) => spanAt(c.width, breakpoint)),
    );

  const decls: Decl[] = [
    ['display', 'grid'],
    ['grid-template-columns', tracksAt('base')],
  ];

  push(decls, 'gap', row.gap, isLength);
  push(decls, 'align-items', row.align, isKeyword(['start', 'center', 'end', 'stretch']));
  push(decls, 'min-height', row.minHeight, isLength);

  const parts = [block(root, decls)];

  for (const { key, maxWidth } of BREAKPOINTS) {
    const tracks = tracksAt(key);
    const previous = tracksAt(key === 'laptop' ? 'base' : key === 'tablet' ? 'laptop' : 'tablet');
    if (tracks === previous) continue;
    parts.push(`@media (max-width:${maxWidth}px){${root}{grid-template-columns:${tracks}}}`);
  }

  // Below the point where columns stack, "reverse" is the only way to say
  // "the image should come first on a phone".
  //
  // `align-items` has to be reset with it. On the grid it means vertical
  // alignment, which is what the editor chose; on a flex column it means
  // *horizontal*, so carrying `center` over would shrink every stacked column
  // to the width of its own content instead of filling the row.
  if (row.reverseOnMobile) {
    parts.push(
      `@media (max-width:768px){${root}{display:flex;flex-direction:column-reverse;align-items:stretch}}`,
    );
  }

  // A column's place at a smaller tier. `order` defaults to 0 for every
  // item, so placing one column means ordering all of them: each tier that
  // names a place restates the whole row as slots — chosen places first
  // (a clash goes to the one written earlier, the other to the next free
  // slot), then everything else fills the gaps in the order written. A place
  // set for Desktop carries down to tablet and phone until one of those says
  // otherwise, the same inheritance a width has.
  const placeAt = (c: (typeof columns)[number], key: 'laptop' | 'tablet' | 'mobile') => {
    const order = c.order;
    const n = key === 'laptop' ? order?.laptop : key === 'tablet' ? (order?.tablet ?? order?.laptop) : (order?.mobile ?? order?.tablet ?? order?.laptop);
    return typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 6 ? n : undefined;
  };
  for (const { key, maxWidth } of BREAKPOINTS) {
    if (!columns.some((c) => c.order?.[key] !== undefined)) continue;
    const slots: (number | undefined)[] = new Array(columns.length).fill(undefined);
    const free = (from: number) => {
      for (let i = 0; i < slots.length; i++) if (slots[(from + i) % slots.length] === undefined) return (from + i) % slots.length;
      return -1;
    };
    columns.forEach((c, index) => {
      const place = placeAt(c, key);
      if (place !== undefined) slots[free(Math.min(place, columns.length) - 1)] = index;
    });
    columns.forEach((c, index) => {
      if (placeAt(c, key) === undefined) slots[free(0)] = index;
    });
    const rules = columns.map((c, index) => `${root}>.he-c-${c.id}{order:${slots.indexOf(index) + 1}}`).join('');
    parts.push(`@media (max-width:${maxWidth}px){${rules}}`);
  }

  for (const column of columns) {
    parts.push(blockStyleToCss(column.id, column.style, 'he-c'));
  }

  return parts.filter(Boolean).join('');
}

/** Every styled block on a page, as one stylesheet. */
export function blocksStyleToCss(blocks: { id: string; style?: BlockStyle }[]): string {
  return blocks.map((b) => blockStyleToCss(b.id, b.style)).filter(Boolean).join('');
}
