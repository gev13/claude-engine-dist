import { BREAKPOINTS, FONT_STACKS, isColor, isLength } from './theme';
import { type BlockStyle, type ColumnWidth, GRADIENT_ANGLES, type SpacingBox, type TypeOverride } from './blockStyle';

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
export function blockStyleToCss(id: string, style: BlockStyle | undefined, prefix = 'he-b'): string {
  if (!style || !isSafeBlockId(id)) return '';

  const root = `.${prefix}-${id}`;
  const parts: string[] = [];

  const background = backgroundDecls(style);
  parts.push(block(root, [...boxDecls(style.spacing?.base), ...background, ...borderDecls(style)]));

  /* Every block paints its own band. With a background chosen here, that band
     steps aside so the choice is actually seen — unlayered, so it beats the
     band's own utility or component rule. */
  if (background.some(([property]) => property === 'background-color' || property === 'background-image')) {
    parts.push(`${root}>*{background:transparent}`);
  }
  if (style.background?.gradient?.animate && background.some(([property]) => property === 'animation')) {
    parts.push(`@media (prefers-reduced-motion:reduce){${root}{animation:none}}.he-reduce-motion ${root}{animation:none}`);
  }

  // An overlay needs a stacking context and a pseudo-element; only emitted
  // when there is actually something to lay it over.
  const overlay = safe(style.background?.overlay);
  if (overlay && isColor(overlay)) {
    parts.push(`${root}{position:relative;isolation:isolate}`);
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
    const hidden = style.hideOn?.includes(key);
    const inner: string[] = [];
    if (decls.length) inner.push(block(root, decls));
    if (hidden) inner.push(`${root}{display:none}`);
    if (inner.length) parts.push(`@media (max-width:${maxWidth}px){${inner.join('')}}`);
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
  columns: { id: string; width: ColumnWidth; style?: BlockStyle }[];
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
        .filter((c) => breakpoint === 'base' || !c.style?.hideOn?.includes(breakpoint))
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

  for (const column of columns) {
    parts.push(blockStyleToCss(column.id, column.style, 'he-c'));
  }

  return parts.filter(Boolean).join('');
}

/** Every styled block on a page, as one stylesheet. */
export function blocksStyleToCss(blocks: { id: string; style?: BlockStyle }[]): string {
  return blocks.map((b) => blockStyleToCss(b.id, b.style)).filter(Boolean).join('');
}
