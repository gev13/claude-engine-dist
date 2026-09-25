import type { BlockStyle } from './blockStyle';
import { type BlockType, CARD_GRID_VARIANTS, CAROUSEL_MODES, HERO_VARIANTS, blockLabels } from './blocks';

/* ═══════════════════════════════════════════════════════════════════════════
   Block and variant names
   ───────────────────────────────────────────────────────────────────────────
   The names an editor sees, in one place: the admin's variant pickers use the
   label maps, and pages on the `library` template print `describeBlock` above
   every block so a site owner can see what each one is called before picking
   it. Pattern codes (HR1, SL3, CT7…) are the ids from the package-1 pattern
   book, so a block on a library page can be traced back to where it came from.
   ═══════════════════════════════════════════════════════════════════════════ */

export const HERO_LABELS: Record<(typeof HERO_VARIANTS)[number], string> = {
  classic: 'Classic — text with an optional diagram',
  mediaCenter: 'Full-width media, centred text',
  mediaBottomLeft: 'Full-width media, text bottom-left',
  split: 'Split — text beside a visual',
  statementFrame: 'Statement with framed media below',
  shaped: 'Shaped media — large rounded corner',
  layered: 'Layered — pictures that separate as you scroll',
};

export const CAROUSEL_LABELS: Record<(typeof CAROUSEL_MODES)[number], string> = {
  cards: 'Cards with a peek',
  products: 'Product cards',
  heroCards: 'Large promo cards',
  hero: 'Full-screen slider',
  media: 'Image slider beside text',
  coverflow: 'Cover-flow gallery',
  quotes: 'Testimonials, one at a time',
  splitScreen: 'Split screen — text and picture in halves',
  filmstrip: 'Filmstrip — frames drifting in perspective',
};

export const CARD_GRID_LABELS: Record<(typeof CARD_GRID_VARIANTS)[number], string> = {
  cards: 'Cards',
  tiles: 'Image tiles, edge to edge',
  mosaic: 'Mosaic — tiles of two sizes',
  icons: 'Icon features',
  imageCards: 'Image cards',
  rows: 'Rows with a checklist',
  overlay: 'Text over a picture',
};

type VariantInfo = {
  /** The prop that picks the variant. */
  prop: string;
  fallback: string;
  labels: Record<string, string>;
  patterns?: Record<string, string>;
};

const same = (code: string, keys: readonly string[]) => Object.fromEntries(keys.map((k) => [k, code]));

const VARIANTS: Partial<Record<BlockType, VariantInfo>> = {
  hero: {
    prop: 'variant',
    fallback: 'classic',
    labels: HERO_LABELS,
    patterns: { mediaCenter: 'HR1', mediaBottomLeft: 'HR2', split: 'HR3', statementFrame: 'HR4', shaped: 'HR8', layered: 'P4-A5' },
  },
  carousel: {
    prop: 'mode',
    fallback: 'cards',
    labels: CAROUSEL_LABELS,
    patterns: { cards: 'SL1', products: 'CT12', heroCards: 'HR5', hero: 'HR6', media: 'SL2', coverflow: 'SL4', quotes: 'V8', splitScreen: 'P4-A1', filmstrip: 'P4-A6' },
  },
  cardGrid: {
    prop: 'variant',
    fallback: 'cards',
    labels: CARD_GRID_LABELS,
    patterns: { tiles: 'CT4', mosaic: 'CT4', icons: 'CT5', imageCards: 'CT5', rows: 'V2', overlay: 'V3' },
  },
  stats: {
    prop: 'variant',
    fallback: 'tiles',
    labels: { tiles: 'Tiles', figures: 'Large figures', counters: 'Counters that count up' },
    patterns: { figures: 'CT8', counters: 'V10' },
  },
  faq: {
    prop: 'variant',
    fallback: 'list',
    labels: { list: 'Questions beside the heading', media: 'Questions beside a picture that follows the open one' },
    patterns: { media: 'CT6' },
  },
  postList: {
    prop: 'variant',
    fallback: 'cards',
    labels: {
      cards: 'Text cards',
      news: 'News cards with cover images',
      list: 'List — cover beside the text',
      minimal: 'Minimal — titles and dates',
      overlay: 'Text over the cover',
      compact: 'Compact — small thumbnails',
      wide: 'Wide — one post per row',
      carousel: 'Carousel of cards',
      featured: 'One large post, the rest beside it',
    },
    patterns: { news: 'CT13', ...same('V6', ['list', 'minimal', 'overlay', 'compact', 'wide']), ...same('P3-B6', ['carousel', 'featured']) },
  },
  image: {
    prop: 'captionStyle',
    fallback: 'mono',
    labels: { mono: 'Small label caption', lead: 'Rounded, with a bold-lead caption' },
    patterns: { lead: 'CT15' },
  },
  cta: {
    prop: 'variant',
    fallback: 'band',
    labels: { band: 'Full-width coloured band', big: 'Huge centred headline', card: 'Compact card', inline: 'Inline — text beside the buttons' },
    patterns: { big: 'CF1', card: 'CF1', inline: 'V7' },
  },
  contactForm: {
    prop: 'layout',
    fallback: 'stacked',
    labels: { stacked: 'Heading above the form', split: 'Text and a picture beside a form card', centered: 'Centred' },
    patterns: { split: 'CF3', centered: 'V16' },
  },
  prose: {
    prop: 'variant',
    fallback: 'default',
    labels: { default: 'Normal text', footnotes: 'Small print — footnotes' },
    patterns: { footnotes: 'CF4' },
  },
  newsletter: {
    prop: 'layout',
    fallback: 'form',
    labels: { form: 'Email field with an inline button', centered: 'Centred, heading over the field' },
    patterns: { form: 'CF2', centered: 'V15' },
  },
  marquee: {
    prop: 'kind',
    fallback: 'logos',
    labels: { logos: 'Logos', quotes: 'Quotes', chips: 'Tags', text: 'Big text', photos: 'Photos' },
    patterns: { ...same('SL3', ['logos', 'quotes', 'chips']), text: 'V11', photos: 'P3-B7' },
  },
  mediaBand: {
    prop: 'position',
    fallback: 'bottomLeft',
    labels: { center: 'Text centred', bottomLeft: 'Text bottom-left', topLeft: 'Text top-left', right: 'Text on the right', left: 'Text on the left' },
    patterns: same('CT3', ['center', 'bottomLeft', 'topLeft', 'right', 'left']),
  },
  overlayCard: {
    prop: 'placement',
    fallback: 'overlapBottom',
    labels: { overlapBottom: 'Card overlapping the bottom edge', insideLeft: 'Card inside the image, left', insideRight: 'Card inside the image, right' },
    patterns: same('CT2', ['overlapBottom', 'insideLeft', 'insideRight']),
  },
  windowFrame: {
    prop: 'chrome',
    fallback: 'browser',
    labels: { browser: 'Browser window', app: 'App window with a sidebar', terminal: 'Terminal' },
    patterns: same('CT17', ['browser', 'app', 'terminal']),
  },
  splitMedia: {
    prop: 'mediaSide',
    fallback: 'left',
    labels: { left: 'Picture on the left', right: 'Picture on the right' },
    patterns: same('CT1', ['left', 'right']),
  },
  tabs: {
    prop: 'barPosition',
    fallback: 'below',
    labels: { below: 'Tab bar below the panel', above: 'Tab bar above the panel' },
    patterns: same('CT7', ['below', 'above']),
  },
  heading: {
    prop: 'size',
    fallback: 'large',
    labels: { medium: 'Medium', large: 'Large', display: 'Display', lede: 'Statement — large body text' },
    patterns: { ...same('EL1', ['medium', 'large', 'display']), lede: 'SC3' },
  },
  notice: {
    prop: 'kind',
    fallback: 'info',
    labels: { info: 'Information', success: 'Success', warning: 'Warning', danger: 'Danger' },
    patterns: same('EL3', ['info', 'success', 'warning', 'danger']),
  },
  progress: {
    prop: 'kind',
    fallback: 'bars',
    labels: { bars: 'Bars', rings: 'Rings' },
    patterns: same('EL4', ['bars', 'rings']),
  },
  countdown: {
    prop: 'style',
    fallback: 'boxed',
    labels: { boxed: 'Boxed numbers', plain: 'Plain numbers', inline: 'One line' },
    patterns: same('EL5', ['boxed', 'plain', 'inline']),
  },
  socialLinks: {
    prop: 'style',
    fallback: 'outlined',
    labels: { plain: 'Icons', outlined: 'Outlined circles', filled: 'Filled circles', text: 'Names', boxed: 'Boxed' },
    patterns: same('EL6', ['plain', 'outlined', 'filled', 'text', 'boxed']),
  },
  pricing: {
    prop: 'layout',
    fallback: 'cards',
    labels: { cards: 'Separate cards', contained: 'One panel' },
    patterns: same('EL7', ['cards', 'contained']),
  },
  team: {
    prop: 'variant',
    fallback: 'cards',
    labels: { cards: 'Cards', overlay: 'Details on hover', split: 'Profile beside the portraits' },
    patterns: same('EL8', ['cards', 'overlay', 'split']),
  },
  numberedList: {
    prop: 'variant',
    fallback: 'grid',
    labels: { grid: 'Grid', steps: 'Steps joined by a line', timeline: 'Timeline' },
    patterns: { steps: 'EL16', timeline: 'EL16' },
  },
  compare: {
    prop: 'orientation',
    fallback: 'horizontal',
    labels: { horizontal: 'Side by side', vertical: 'Top and bottom' },
    patterns: same('EL9', ['horizontal', 'vertical']),
  },
  video: {
    prop: 'display',
    fallback: 'inline',
    labels: { inline: 'Plays in place', button: 'Plays over the page' },
    patterns: same('EL10', ['inline', 'button']),
  },
  gallery: {
    prop: 'layout',
    fallback: 'grid',
    labels: { grid: 'Even grid', masonry: 'Masonry', metro: 'Metro' },
    patterns: same('EL11', ['grid', 'masonry', 'metro']),
  },
  projects: {
    prop: 'layout',
    fallback: 'classic',
    labels: { classic: 'Classic', overlay: 'Details over the picture', minimal: 'Minimal', metro: 'Metro', list: 'Big-text list', carousel: 'Carousel' },
    patterns: { ...same('EL13', ['classic', 'overlay', 'minimal', 'metro', 'list']), carousel: 'P3-B6' },
  },
  map: {
    prop: 'layout',
    fallback: 'card',
    labels: { card: 'Card over the map', split: 'Details beside the map', full: 'Full width' },
    patterns: same('EL14', ['card', 'split', 'full']),
  },
  chart: {
    prop: 'kind',
    fallback: 'column',
    labels: { column: 'Columns', bar: 'Horizontal bars', line: 'Line', area: 'Area', pie: 'Pie', doughnut: 'Doughnut' },
    patterns: same('P3-A1', ['column', 'bar', 'line', 'area', 'pie', 'doughnut']),
  },
  hotspots: {
    prop: 'marker',
    fallback: 'dot',
    labels: { dot: 'Pulsing dots', number: 'Numbered pins', plus: 'Plus signs' },
    patterns: same('P3-A2', ['dot', 'number', 'plus']),
  },
  flipBox: {
    prop: 'effect',
    fallback: 'flip',
    labels: { flip: 'Turns over', slide: 'Back slides in', fade: 'Back fades in' },
    patterns: same('P3-A3', ['flip', 'slide', 'fade']),
  },
  priceList: {
    prop: 'layout',
    fallback: 'list',
    labels: { list: 'One column with dotted leaders', columns: 'Two columns', cards: 'Cards with photos' },
    patterns: same('P3-A4', ['list', 'columns', 'cards']),
  },
  businessHours: {
    prop: 'style',
    fallback: 'list',
    labels: { list: 'List', card: 'Card with the status across the top', compact: 'Compact' },
    patterns: same('P3-A5', ['list', 'card', 'compact']),
  },
  share: {
    prop: 'style',
    fallback: 'buttons',
    labels: { buttons: 'Buttons with names', icons: 'Icons', outlined: 'Outlined circles', text: 'Names only' },
    patterns: same('P3-A6', ['buttons', 'icons', 'outlined', 'text']),
  },
  checkLists: {
    prop: 'layout',
    fallback: 'rows',
    labels: { rows: 'Rows with lines', plain: 'Plain list', inline: 'In a line', grid: 'Grid' },
    patterns: same('P3-B3', ['plain', 'inline', 'grid']),
  },
  spacer: {
    prop: 'lineStyle',
    fallback: 'solid',
    labels: { solid: 'Solid line', dashed: 'Dashed', dotted: 'Dotted', double: 'Double', wave: 'Wave', zigzag: 'Zigzag' },
    patterns: same('P3-B4', ['dashed', 'dotted', 'double', 'wave', 'zigzag']),
  },
  form: {
    prop: 'layout',
    fallback: 'card',
    labels: { card: 'In a card', plain: 'On the page' },
    patterns: same('P3-E', ['card', 'plain']),
  },
  lottie: {
    prop: 'play',
    fallback: 'loop',
    labels: { loop: 'Plays on a loop', once: 'Plays once in view', hover: 'Plays on hover', scroll: 'Follows the scroll' },
    patterns: same('P3-F', ['loop', 'once', 'hover', 'scroll']),
  },
  reviews: {
    prop: 'layout',
    fallback: 'grid',
    labels: { grid: 'Grid', masonry: 'Masonry', list: 'List' },
    patterns: same('P3-A7', ['grid', 'masonry', 'list']),
  },
  toc: {
    prop: 'style',
    fallback: 'boxed',
    labels: { boxed: 'Boxed', list: 'Plain list', numbered: 'Numbered' },
    patterns: same('P3-A8', ['boxed', 'list', 'numbered']),
  },
  breadcrumbs: {
    prop: 'style',
    fallback: 'plain',
    labels: { plain: 'Plain', pill: 'Pills', boxed: 'In a box' },
    patterns: same('P3-A9', ['plain', 'pill', 'boxed']),
  },
  textPath: {
    prop: 'shape',
    fallback: 'circle',
    labels: { circle: 'Around a circle', arc: 'Along an arc', wave: 'Along a wave' },
    patterns: same('P3-A10', ['circle', 'arc', 'wave']),
  },
  search: {
    prop: 'style',
    fallback: 'bar',
    labels: { bar: 'Field with a button', pill: 'Rounded', underline: 'Underlined', minimal: 'Field with an arrow' },
    patterns: same('P3-A11', ['bar', 'pill', 'underline', 'minimal']),
  },
};

/** Blocks that are one pattern whatever their options. */
const FIXED_PATTERNS: Partial<Record<BlockType, string>> = {
  savedBlock: 'T8',
  stackedPanels: 'HR7',
  logoWall: 'CT9',
  quote: 'CT10',
  configurator: 'CT11',
  collage: 'CT14',
  appPromo: 'CT16',
  subNav: 'HD3',
  scrollStory: 'SC1',
  pinnedMedia: 'SC2',
  buttons: 'EL2',
  horizontalAccordion: 'EL12',
};

export type BlockDescription = {
  /** The name in the block picker. */
  name: string;
  /** The chosen variant's label, when the block has variants. */
  variant?: string;
  /** Pattern-book code, when the block (or variant) came from the library. */
  pattern?: string;
  /** The type and variant keys, for someone matching this to the data. */
  key: string;
  /** Options worth naming: reveal on scroll. */
  extras: string[];
};

const REVEAL_NAMES: Record<string, string> = {
  fade: 'fade (SC4)',
  rise: 'rise (SC4)',
  zoom: 'zoom in (P3-C1)',
  left: 'slide in from the left (P3-C1)',
  right: 'slide in from the right (P3-C1)',
  blur: 'blur in (P3-C1)',
};
const HOVER_NAMES: Record<string, string> = { lift: 'lift', grow: 'grow', shadow: 'shadow', tilt: 'tilt towards the pointer' };

/** The Design-tab effects a block uses, named for the strip on library pages. */
function effectNames(style?: BlockStyle): string[] {
  if (!style) return [];
  const out: string[] = [];
  if (style.reveal) out.push(`Reveal on scroll — ${REVEAL_NAMES[style.reveal]}${style.revealDelay ? `, after ${style.revealDelay / 1000} s` : ''}`);
  if (style.hover) out.push(`On hover — ${HOVER_NAMES[style.hover]} (P3-C2)`);
  const shapes = [style.shapeTop && `top ${style.shapeTop.kind}`, style.shapeBottom && `bottom ${style.shapeBottom.kind}`].filter(Boolean);
  if (shapes.length) out.push(`Shape divider — ${shapes.join(', ')} (P3-C3)`);
  if (style.background?.gradient) out.push(`${style.background.gradient.animate ? 'Drifting' : 'Still'} gradient background (P3-C4)`);
  if (style.sticky) out.push('Sticks while scrolling (P3-C5)');
  if (style.snap) out.push('The page snaps to it (P3-C5)');
  return out;
}

export function describeBlock(type: string, props: Record<string, unknown>, style?: BlockStyle): BlockDescription {
  const name = blockLabels[type as BlockType] ?? type;
  const info = VARIANTS[type as BlockType];
  const extras = effectNames(style);

  if (!info) {
    return { name, pattern: FIXED_PATTERNS[type as BlockType], key: type, extras };
  }

  const raw = props[info.prop];
  const value = typeof raw === 'string' && raw in info.labels ? raw : info.fallback;
  return {
    name,
    variant: info.labels[value],
    pattern: info.patterns?.[value] ?? FIXED_PATTERNS[type as BlockType],
    key: `${type} · ${info.prop}: ${value}`,
    extras,
  };
}
