import type { BlockType } from './blocks';
import { CARD_GRID_VARIANTS, CAROUSEL_MODES, HERO_VARIANTS } from './blocks';
import type { BlogIndexLayout, BlogPostLayout } from './blog';
import type { FOOTER_VARIANTS, HEADER_VARIANTS, MEGA_VARIANTS, MOBILE_MENU_VARIANTS } from './chrome';

/* ═══════════════════════════════════════════════════════════════════════════
   Wireframe thumbnails
   ───────────────────────────────────────────────────────────────────────────
   The pictures in the block picker and the variant pickers. Each one is a list
   of shapes on a 160×100 canvas (50×100 for a phone), in the same small
   vocabulary the pattern book used, so a thumbnail here matches the pattern
   it was built from. `Wireframe.tsx` draws them; nothing here is HTML.

     ['img' | 'panel' | 'soft' | 'dark', x, y, w, h, radius?, 'alt'|'dim'|'b'?]
     ['acc' | 'accline', x, y, w, h, radius?]     accent fill / dashed outline
     ['ink', x, y, w, h, 'lt'?]                   a solid bar (logo, label)
     ['txt', x, y, w, lines?, gap?, 'lt'|'on'|'ink'?]
     ['big', x, y, w, lines?, 'lt'|'acc'|'dim'|'half'?]
     ['btn' | 'fbtn', x, y, w]                    outline / filled button
     ['circ', x, y, r, 'lt'|'acc'?]   ['dots', x, y, n, active?, 'v'?]
     ['chev', x, y, 'l'|'r'|'u'|'d', 'lt'?]   ['burger', x, y, 'lt'?]
     ['wline', x, y, w]   ['pause', x, y]   ['sw', x, y, n]
     ['poly', 'x,y x,y …', 'img'|'img2']   ['lbl', x, y, text, anchor?, tone?]
     ['g', opacity, shapes[]]
   ═══════════════════════════════════════════════════════════════════════════ */

export type Shape = readonly unknown[];
export type Wire = { shapes: readonly Shape[]; width?: 160 | 50 };

export const SHAPE_KINDS = [
  'img', 'panel', 'soft', 'dark', 'acc', 'accline', 'ink', 'wline', 'txt', 'big', 'btn', 'fbtn',
  'dots', 'circ', 'chev', 'burger', 'pause', 'poly', 'sw', 'lbl', 'g',
] as const;

type HeroVariant = (typeof HERO_VARIANTS)[number];
type CarouselMode = (typeof CAROUSEL_MODES)[number];
type CardGridVariant = (typeof CARD_GRID_VARIANTS)[number];

/* ── Shared drawings ──────────────────────────────────────────────────────── */

const cardsRow: Shape[] = [
  ['big', 8, 10, 50, 1],
  ['panel', 8, 22, 44, 66, 2],
  ['txt', 12, 30, 28],
  ['txt', 12, 38, 34, 3],
  ['panel', 58, 22, 44, 66, 2],
  ['txt', 62, 30, 28],
  ['txt', 62, 38, 34, 3],
  ['panel', 108, 22, 44, 66, 2],
  ['txt', 112, 30, 28],
  ['txt', 112, 38, 34, 3],
];

const iconGrid: Shape[] = [
  ['big', 8, 8, 50, 1],
  ...[26, 58].flatMap((y) =>
    [10, 60, 110].flatMap((x): Shape[] => [
      ['circ', x + 4, y, 3.5],
      ['big', x, y + 8, 26, 1],
      ['txt', x, y + 14, 36, 2],
    ]),
  ),
];

/* ── Heroes ───────────────────────────────────────────────────────────────── */

export const HERO_WIREFRAMES: Record<HeroVariant, readonly Shape[]> = {
  layered: [
    ['img', 0, 0, 160, 100], ['img', 92, 20, 58, 64, 3], ['soft', 16, 54, 44, 30, 3, 'dim'],
    ['txt', 12, 24, 18, 1, 3, 'lt'], ['big', 12, 32, 62, 2, 'lt'], ['fbtn', 12, 88, 22],
  ],
  classic: [
    ['txt', 10, 28, 16],
    ['big', 10, 34, 72, 2],
    ['txt', 10, 50, 62, 2],
    ['fbtn', 10, 64, 22],
    ['btn', 36, 64, 22],
    ['circ', 124, 50, 20],
    ['circ', 124, 50, 11],
    ['circ', 124, 50, 3, 'acc'],
  ],
  mediaCenter: [['img', 0, 0, 160, 100], ['txt', 68, 28, 24, 1, 3, 'lt'], ['big', 44, 34, 72, 2, 'lt'], ['btn', 66, 52, 28], ['circ', 80, 90, 2.5, 'lt']],
  mediaBottomLeft: [['img', 0, 0, 160, 100], ['txt', 10, 58, 20, 1, 3, 'lt'], ['big', 10, 64, 56, 2, 'lt'], ['txt', 10, 78, 50, 2, 3, 'lt'], ['fbtn', 10, 88, 22]],
  split: [['dark', 0, 0, 160, 100], ['btn', 10, 26, 26], ['big', 10, 36, 60, 2, 'lt'], ['txt', 10, 54, 52, 2, 3, 'lt'], ['fbtn', 10, 66, 20], ['btn', 34, 66, 20], ['img', 92, 18, 58, 64, 3]],
  statementFrame: [['circ', 80, 12, 4], ['big', 30, 22, 100, 2], ['txt', 60, 38, 40], ['img', 14, 48, 132, 52, 3]],
  shaped: [['dark', 0, 0, 160, 100], ['img', 4, 0, 152, 88, 22], ['txt', 12, 56, 20, 1, 3, 'lt'], ['big', 12, 62, 60, 2, 'lt'], ['fbtn', 12, 76, 22]],
};

/* ── Sliders ──────────────────────────────────────────────────────────────── */

export const CAROUSEL_WIREFRAMES: Record<CarouselMode, readonly Shape[]> = {
  splitScreen: [
    ['dark', 0, 0, 80, 100], ['img', 80, 0, 80, 100],
    ['txt', 8, 26, 18], ['big', 8, 34, 56, 2, 'lt'], ['txt', 8, 52, 46, 2, 3, 'lt'], ['fbtn', 8, 70, 24],
    ['txt', 8, 88, 8, 1, 3, 'lt'], ['chev', 60, 89, 'l', 'lt'], ['chev', 70, 89, 'r', 'lt'],
  ],
  filmstrip: [
    ['img', 6, 30, 26, 44, 2], ['img', 36, 22, 34, 60, 2], ['img', 74, 16, 44, 70, 2], ['img', 122, 24, 32, 56, 2],
    ['txt', 70, 92, 20],
  ],
  quotes: [['big', 50, 8, 60, 1], ['big', 72, 22, 16, 1, 'acc'], ['txt', 28, 36, 104, 3, 6], ['circ', 68, 72, 5], ['txt', 76, 71, 26], ['dots', 70, 88, 4, 1]],
  cards: [
    ['big', 8, 8, 50, 1], ['txt', 120, 10, 26],
    ['img', 8, 20, 34, 40, 3], ['txt', 8, 64, 26, 3, 4],
    ['img', 46, 20, 34, 40, 3], ['txt', 46, 64, 26, 3, 4],
    ['img', 84, 20, 34, 40, 3], ['txt', 84, 64, 26, 3, 4],
    ['img', 122, 20, 38, 40, 3],
    ['circ', 136, 88, 3], ['circ', 146, 88, 3], ['chev', 136, 88, 'l'], ['chev', 146, 88, 'r'],
  ],
  products: [
    ...[6, 44, 82, 120].flatMap((x, i): Shape[] => [
      ['panel', x, 8, 34, 82, 2, 'b'],
      ...(i < 2 ? ([['acc', x + 2, 10, 8, 3, 1]] as Shape[]) : []),
      ['img', x + 4, 16, 26, 34],
      ['txt', x + 6, 56, 22],
      ['big', x + 6, 62, 22, 1],
      ['sw', x + 8, 76, 3],
    ]),
  ],
  heroCards: [
    ['soft', 8, 8, 128, 70, 5], ['big', 14, 14, 40, 1], ['txt', 14, 21, 24], ['fbtn', 100, 13, 14],
    ['img', 50, 34, 46, 44, 2], ['dark', 140, 8, 20, 70, 5],
    ['acc', 64, 85, 10, 3, 1.5], ['dots', 78, 86.5, 2, -1], ['circ', 92, 86.5, 2.2],
  ],
  hero: [
    ['img', 0, 0, 160, 90], ['txt', 70, 50, 20, 1, 3, 'lt'], ['big', 40, 56, 80, 1, 'lt'], ['btn', 66, 66, 28],
    ['acc', 56, 80, 10, 1, 0.5], ['soft', 68, 80, 10, 1, 0.5], ['soft', 80, 80, 10, 1, 0.5], ['soft', 92, 80, 10, 1, 0.5],
    ['circ', 150, 82, 2.5, 'lt'], ['panel', 0, 90, 160, 10],
    ['txt', 20, 95, 16], ['txt', 56, 95, 16], ['txt', 92, 95, 16], ['txt', 128, 95, 16],
  ],
  media: [
    ['txt', 8, 26, 14], ['big', 8, 32, 44, 2], ['txt', 8, 46, 40, 3], ['btn', 8, 62, 20],
    ['img', 64, 14, 88, 58, 2], ['txt', 64, 76, 60], ['dots', 100, 86, 4, 0], ['chev', 60, 43, 'l'], ['chev', 156, 43, 'r'],
  ],
  coverflow: [
    ['big', 8, 8, 40, 1], ['img', 40, 20, 80, 50, 1],
    ['poly', '124,26 144,32 144,58 124,64', 'img2'], ['poly', '36,26 16,32 16,58 36,64', 'img2'],
    ['txt', 60, 78, 40], ['dots', 72, 88, 5, 2],
  ],
};

/* ── Card grid ────────────────────────────────────────────────────────────── */

export const CARD_GRID_WIREFRAMES: Record<CardGridVariant, readonly Shape[]> = {
  cards: cardsRow,
  tiles: [
    ['img', 0, 0, 80, 50], ['img', 80, 0, 80, 50, 0, 'alt'], ['img', 0, 50, 80, 50, 0, 'alt'], ['img', 80, 50, 80, 50],
    ['txt', 30, 30, 20, 1, 3, 'lt'], ['big', 20, 35, 40, 1, 'lt'], ['btn', 30, 41, 20],
    ['txt', 110, 30, 20, 1, 3, 'lt'], ['big', 100, 35, 40, 1, 'lt'], ['btn', 110, 41, 20],
    ['txt', 30, 80, 20, 1, 3, 'lt'], ['big', 20, 85, 40, 1, 'lt'],
    ['txt', 110, 80, 20, 1, 3, 'lt'], ['big', 100, 85, 40, 1, 'lt'],
  ],
  /* The point of the mosaic is that the tiles are not all the same size, so
     the thumbnail has to show one big tile and four small ones — a uniform
     four-up would be indistinguishable from `tiles`. */
  mosaic: [
    ['img', 0, 0, 80, 80],
    ['img', 80, 0, 40, 40, 0, 'alt'],
    ['img', 120, 0, 40, 40],
    ['img', 80, 40, 40, 40],
    ['img', 120, 40, 40, 40, 0, 'alt'],
    ['big', 8, 60, 46, 1, 'lt'],
    ['txt', 8, 68, 56, 1, 3, 'lt'],
    ['big', 86, 26, 26, 1, 'lt'],
    ['big', 126, 26, 26, 1, 'lt'],
    ['big', 86, 66, 26, 1, 'lt'],
    ['big', 126, 66, 26, 1, 'lt'],
  ],
  icons: iconGrid,
  imageCards: [
    ['big', 8, 8, 50, 1],
    ...[8, 46, 84, 122].flatMap((x): Shape[] => [['img', x, 22, 32, 26, 3], ['big', x, 54, 22, 1], ['txt', x, 61, 28, 2]]),
  ],
  rows: [
    ['big', 8, 6, 50, 1],
    ...[18, 44, 70].flatMap((y): Shape[] => [
      ['panel', 8, y, 144, 22, 2], ['circ', 18, y + 11, 4], ['big', 28, y + 6, 34, 1], ['txt', 28, y + 13, 40, 1], ['txt', 82, y + 7, 30, 2, 4], ['btn', 124, y + 8, 22],
    ]),
  ],
  overlay: [
    ['big', 8, 8, 50, 1],
    ...[8, 58, 108].flatMap((x): Shape[] => [['img', x, 22, 44, 66, 3], ['big', x + 4, 70, 30, 1, 'lt'], ['txt', x + 4, 78, 30, 1, 3, 'lt']]),
  ],
};

/* ── Every block type, for the picker ─────────────────────────────────────── */

export const BLOCK_WIREFRAMES: Record<BlockType, readonly Shape[]> = {
  hero: HERO_WIREFRAMES.classic,
  stats: [
    ['txt', 8, 12, 30],
    ...[8, 46, 84, 122].flatMap((x): Shape[] => [['panel', x, 26, 34, 48, 2], ['big', x + 4, 38, 22, 1, 'acc'], ['txt', x + 4, 50, 24, 2]]),
  ],
  prose: [['big', 10, 14, 70, 1], ['txt', 10, 28, 130, 4], ['txt', 10, 50, 130, 4], ['txt', 10, 72, 90, 2]],
  splitPoints: [
    ['txt', 10, 20, 20], ['big', 10, 26, 58, 2], ['txt', 10, 42, 50, 3],
    ...[16, 44, 72].flatMap((y): Shape[] => [['wline', 86, y, 64], ['big', 86, y + 5, 40, 1], ['txt', 86, y + 12, 60, 2]]),
  ],
  cardGrid: cardsRow,
  numberedList: [
    ['big', 8, 8, 50, 1],
    ...[[8, 22], [82, 22], [8, 60], [82, 60]].flatMap(([x, y]): Shape[] => [
      ['panel', x!, y!, 70, 34, 1],
      ['txt', x! + 5, y! + 6, 8, 1, 3, 'ink'],
      ['big', x! + 5, y! + 13, 40, 1],
      ['txt', x! + 5, y! + 21, 56, 2],
    ]),
  ],
  checkLists: [
    ['big', 8, 10, 50, 1],
    ...[8, 84].flatMap((x): Shape[] =>
      [28, 40, 52, 64, 76].flatMap((y): Shape[] => [['circ', x + 2, y + 0.6, 1.4, 'acc'], ['txt', x + 7, y, 56]]),
    ),
  ],
  faq: [
    ['big', 10, 20, 40, 2],
    ...[16, 34, 52, 70].flatMap((y, i): Shape[] => [
      ['wline', 70, y, 80],
      ['big', 70, y + 5, 48, 1, i === 0 ? undefined : 'dim'],
      ['lbl', 148, y + 8, i === 0 ? '−' : '+', 'end', 'ink'],
      ...(i === 0 ? ([['txt', 70, y + 11, 64, 1]] as Shape[]) : []),
    ]),
  ],
  cta: [['acc', 0, 20, 160, 60], ['txt', 12, 30, 22, 1, 3, 'on'], ['big', 12, 38, 90, 2], ['panel', 12, 60, 34, 7, 3]],
  pager: [['wline', 10, 30, 140], ['txt', 10, 44, 24], ['big', 10, 52, 90, 1], ['chev', 146, 53, 'r'], ['wline', 10, 70, 140]],
  servicesIndex: [
    ['big', 8, 8, 50, 1],
    ...[[8, 22], [58, 22], [108, 22], [8, 60], [58, 60], [108, 60]].flatMap(([x, y]): Shape[] => [
      ['panel', x!, y!, 44, 34, 1],
      ['txt', x! + 4, y! + 6, 16],
      ['big', x! + 4, y! + 13, 30, 1],
      ['txt', x! + 4, y! + 21, 34, 2],
    ]),
  ],
  postList: [
    ['big', 50, 6, 60, 1],
    ...[8, 58, 108].flatMap((x): Shape[] => [['img', x, 16, 44, 28, 3], ['acc', x + 2, 18, 12, 3, 1.5], ['big', x, 48, 40, 2], ['txt', x, 62, 30]]),
    ['btn', 66, 80, 28],
  ],
  contactForm: [
    ['big', 10, 12, 60, 1], ['txt', 10, 20, 70, 2],
    ['soft', 10, 32, 68, 7, 1], ['soft', 82, 32, 68, 7, 1], ['soft', 10, 44, 68, 7, 1], ['soft', 82, 44, 68, 7, 1],
    ['soft', 10, 56, 140, 16, 1], ['fbtn', 10, 80, 34],
  ],
  infoPanel: [
    ['big', 10, 14, 50, 1],
    ...[30, 44, 58, 72].flatMap((y): Shape[] => [['wline', 10, y - 4, 140], ['txt', 10, y, 26, 1, 3, 'ink'], ['txt', 60, y, 70]]),
  ],
  image: [['img', 20, 10, 120, 66, 2], ['txt', 20, 82, 60]],
  table: [
    ['soft', 10, 16, 140, 10],
    ['txt', 14, 20, 30, 1, 3, 'ink'], ['txt', 60, 20, 30, 1, 3, 'ink'], ['txt', 106, 20, 30, 1, 3, 'ink'],
    ...[36, 48, 60, 72].flatMap((y): Shape[] => [['txt', 14, y, 30], ['txt', 60, y, 34], ['txt', 106, y, 26], ['wline', 10, y + 6, 140]]),
  ],
  figure: [['circ', 56, 50, 22], ['circ', 104, 50, 22], ['acc', 72, 48, 16, 4, 2]],
  spacer: [['txt', 10, 20, 140, 2], ['wline', 10, 50, 140], ['lbl', 80, 46, 'space', 'middle'], ['txt', 10, 74, 140, 2]],
  row: [['accline', 8, 10, 70, 80, 3], ['accline', 82, 10, 70, 80, 3], ['big', 14, 22, 50, 1], ['txt', 14, 30, 56, 4], ['img', 88, 18, 58, 44, 2], ['lbl', 80, 97, 'columns', 'middle']],
  carousel: CAROUSEL_WIREFRAMES.cards,
  marquee: [
    ['big', 50, 12, 60, 1],
    ['soft', 0, 40, 160, 20, 4],
    ['circ', 8, 50, 3],
    ...[18, 44, 70, 96, 122, 148].map((x): Shape => ['ink', x, 48, 18, 4]),
    ['lbl', 80, 80, '← continuous', 'middle'],
  ],
  stackedPanels: [['img', 0, 0, 160, 62], ['img', 0, 40, 160, 60, 0, 'alt'], ['txt', 10, 76, 20, 1, 3, 'lt'], ['big', 10, 82, 50, 1, 'lt'], ['fbtn', 10, 89, 22], ['dots', 152, 40, 3, 1, 'v']],
  splitMedia: [['img', 8, 12, 64, 76, 2], ['txt', 84, 30, 20], ['big', 84, 36, 56, 2], ['txt', 84, 52, 60, 3], ['btn', 84, 68, 22]],
  overlayCard: [['img', 0, 0, 160, 70], ['panel', 22, 56, 116, 34], ['txt', 30, 63, 12], ['acc', 30, 67, 8, 0.6], ['big', 30, 72, 90, 2]],
  mediaBand: [['img', 0, 6, 160, 88], ['big', 50, 36, 60, 2, 'lt'], ['txt', 44, 52, 72, 2, 3, 'lt'], ['fbtn', 68, 64, 24]],
  tabs: [['panel', 6, 8, 148, 62, 4, 'b'], ['big', 14, 22, 50, 1], ['txt', 14, 30, 56, 4], ['img', 82, 12, 68, 54, 3], ['soft', 6, 76, 148, 10, 5], ['acc', 6, 76, 50, 10, 5], ['txt', 24, 81, 16, 1, 3, 'on'], ['txt', 72, 81, 16], ['txt', 122, 81, 16]],
  logoWall: [
    ['soft', 10, 10, 140, 72, 5], ['txt', 55, 20, 50, 2],
    ...[40, 54].flatMap((y) => [22, 42, 62, 82, 102, 122].map((x): Shape => ['ink', x, y, 16, 4])),
    ['txt', 66, 72, 28],
  ],
  quote: [['img', 8, 12, 76, 62, 3], ['circ', 18, 64, 4, 'lt'], ['txt', 25, 64.5, 20, 1, 3, 'lt'], ['txt', 90, 20, 20], ['big', 90, 28, 56, 4], ['txt', 90, 56, 20], ['fbtn', 90, 64, 24], ['btn', 116, 64, 24]],
  configurator: [['big', 50, 6, 60, 1], ['img', 10, 16, 140, 56, 3], ['circ', 16, 44, 3, 'lt'], ['chev', 16, 44, 'l', 'lt'], ['circ', 144, 44, 3, 'lt'], ['chev', 144, 44, 'r', 'lt'], ['sw', 14, 82, 5], ['txt', 122, 82, 26]],
  collage: [['img', 16, 8, 128, 46], ['txt', 16, 64, 50, 3], ['btn', 16, 80, 22], ['img', 92, 44, 52, 50, 0, 'alt']],
  appPromo: [['circ', 14, 30, 3], ['big', 12, 38, 60, 1], ['txt', 12, 48, 40], ['ink', 12, 56, 20, 7], ['ink', 36, 56, 20, 7], ['img', 92, 14, 26, 76, 4], ['img', 106, 22, 26, 70, 4, 'alt'], ['img', 120, 30, 26, 62, 4]],
  windowFrame: [['dark', 10, 10, 140, 80, 4], ['circ', 16, 15, 1, 'lt'], ['circ', 20, 15, 1, 'lt'], ['circ', 24, 15, 1, 'lt'], ['soft', 10, 20, 36, 70], ['txt', 14, 26, 26, 5, 5], ['txt', 52, 26, 60, 10, 5, 'lt']],
  subNav: [['panel', 0, 0, 160, 6], ['soft', 0, 6, 160, 12], ['ink', 6, 10.5, 30, 3], ['txt', 96, 11.5, 10], ['txt', 109, 11.5, 10], ['txt', 122, 11.5, 10], ['fbtn', 138, 9.5, 16], ['img', 0, 18, 160, 82, 0, 'dim'], ['lbl', 80, 62, 'sticks as you scroll', 'middle', 'ink']],
  scrollStory: [['big', 16, 18, 30, 1], ['txt', 16, 26, 40, 2], ['acc', 8, 33, 50, 0.5], ['big', 16, 38, 20, 1, 'dim'], ['wline', 8, 44, 50], ['big', 16, 50, 26, 1, 'dim'], ['wline', 8, 56, 50], ['big', 16, 62, 22, 1, 'dim'], ['img', 70, 14, 84, 70, 3], ['accline', 68, 12, 88, 74, 4]],
  pinnedMedia: [['dark', 0, 0, 160, 100], ['big', 40, 12, 80, 1, 'lt'], ['img', 30, 24, 100, 56, 2], ['acc', 30, 78, 46, 2], ['accline', 3, 3, 154, 94, 3]],
  newsletter: [['dark', 0, 20, 160, 56], ['big', 12, 36, 56, 1, 'lt'], ['txt', 12, 46, 40, 1, 3, 'lt'], ['panel', 84, 34, 66, 10, 5], ['acc', 130, 35.5, 18, 7, 3.5], ['txt', 84, 52, 56, 2, 3, 'lt']],
  heading: [['acc', 66, 22, 28, 5, 2.5], ['big', 30, 34, 100, 2, 'half'], ['acc', 74, 52, 12, 1.2], ['txt', 40, 60, 80, 2]],
  buttons: [['fbtn', 18, 47, 30], ['btn', 54, 47, 30], ['soft', 90, 47, 26, 5, 2.5], ['txt', 122, 49, 16, 1, 3, 'ink'], ['circ', 146, 49.5, 3.5, 'acc']],
  notice: [
    ['soft', 16, 16, 128, 14, 3], ['circ', 25, 23, 3], ['txt', 33, 22.5, 90],
    ['acc', 16, 36, 128, 14, 3], ['circ', 25, 43, 3, 'lt'], ['txt', 33, 42.5, 80, 1, 3, 'on'],
    ['soft', 16, 56, 128, 14, 3], ['circ', 25, 63, 3], ['txt', 33, 62.5, 70],
    ['panel', 16, 76, 128, 14, 3, 'b'], ['circ', 25, 83, 3], ['txt', 33, 82.5, 96],
  ],
  progress: [
    ['txt', 12, 22, 30, 1, 3, 'ink'], ['soft', 12, 28, 66, 3, 1.5], ['acc', 12, 28, 52, 3, 1.5],
    ['txt', 12, 42, 30, 1, 3, 'ink'], ['soft', 12, 48, 66, 3, 1.5], ['acc', 12, 48, 36, 3, 1.5],
    ['txt', 12, 62, 30, 1, 3, 'ink'], ['soft', 12, 68, 66, 3, 1.5], ['acc', 12, 68, 60, 3, 1.5],
    ['circ', 104, 44, 14], ['circ', 104, 44, 14, 'acc'], ['big', 98, 42.5, 12, 1], ['txt', 94, 66, 20],
    ['circ', 138, 44, 14], ['big', 132, 42.5, 12, 1], ['txt', 128, 66, 20],
  ],
  countdown: [
    ['big', 50, 16, 60, 1],
    ...[22, 50, 78, 106].map((x): Shape => ['panel', x, 34, 24, 26, 3]),
    ...[26, 54, 82, 110].map((x): Shape => ['big', x, 44, 16, 1]),
    ...[26, 54, 82, 110].map((x): Shape => ['txt', x, 64, 16]),
  ],
  socialLinks: [['txt', 60, 32, 40, 1, 3, 'ink'], ...[40, 56, 72, 88, 104, 120].map((x): Shape => ['circ', x, 52, 5.5]), ...[40, 56, 72, 88, 104, 120].map((x): Shape => ['circ', x, 52, 2, 'acc'])],
  pricing: [
    ['soft', 56, 8, 48, 8, 4], ['acc', 57, 9, 22, 6, 3],
    ...[10, 58, 106].flatMap((x, i): Shape[] => [
      i === 1 ? ['accline', x - 1, 21, 46, 74, 3] : ['panel', x, 22, 44, 72, 3],
      ['txt', x + 5, 28, 20, 1, 3, 'ink'],
      ['big', x + 5, 35, 18, 1],
      ['txt', x + 5, 46, 32, 4, 5],
      i === 1 ? ['fbtn', x + 5, 84, 34] : ['btn', x + 5, 84, 34],
    ]),
  ],
  team: [['big', 8, 8, 40, 1], ...[8, 58, 108].flatMap((x): Shape[] => [['img', x, 20, 44, 52, 3], ['big', x, 77, 28, 1], ['txt', x, 84, 22], ['circ', x + 3, 92, 1.8], ['circ', x + 9, 92, 1.8]])],
  compare: [['img', 10, 12, 140, 76, 3], ['img', 10, 12, 70, 76, 3, 'alt'], ['ink', 79, 12, 2, 76, 'lt'], ['circ', 80, 50, 8, 'lt'], ['chev', 76, 50, 'l'], ['chev', 84, 50, 'r']],
  video: [['big', 50, 6, 60, 1], ['img', 20, 16, 120, 74, 3], ['circ', 80, 53, 11, 'acc'], ['chev', 81, 53, 'r', 'lt']],
  gallery: [['big', 8, 6, 44, 1], ...[16, 56].flatMap((y) => [8, 58, 108].map((x): Shape => ['img', x, y, 44, 36, 2]))],
  horizontalAccordion: [
    ['img', 8, 12, 18, 76, 3, 'dim'], ['img', 29, 12, 18, 76, 3, 'dim'], ['img', 50, 12, 64, 76, 3],
    ['big', 56, 66, 40, 1, 'lt'], ['txt', 56, 74, 44, 2, 3, 'lt'], ['img', 117, 12, 17, 76, 3, 'dim'], ['img', 137, 12, 15, 76, 3, 'dim'],
  ],
  projects: [['soft', 8, 8, 16, 6, 3], ['acc', 26, 8, 22, 6, 3], ['soft', 50, 8, 20, 6, 3], ...[8, 58, 108].flatMap((x): Shape[] => [['img', x, 20, 44, 50, 3], ['big', x, 76, 30, 1], ['txt', x, 84, 18]])],
  map: [['soft', 0, 10, 160, 80], ['dark', 0, 40, 160, 2], ['dark', 0, 66, 160, 2], ['dark', 102, 10, 2, 80], ['circ', 120, 48, 5, 'acc'], ['panel', 12, 22, 58, 56, 3, 'b'], ['big', 18, 30, 40, 1], ['txt', 18, 40, 44, 3], ['fbtn', 18, 64, 28]],
  chart: [
    ['big', 8, 8, 50, 1], ['circ', 112, 10, 2, 'acc'], ['txt', 117, 9.5, 12], ['circ', 136, 10, 2], ['txt', 141, 9.5, 12],
    ['wline', 12, 40, 140], ['wline', 12, 62, 140], ['wline', 12, 84, 140],
    ...([[20, 30], [42, 24], [64, 44], [86, 36], [108, 54], [130, 60]] as const).flatMap(([x, h]): Shape[] => [['acc', x, 84 - h, 7, h, 1], ['soft', x + 8, 84 - h * 0.7, 7, h * 0.7, 1]]),
  ],
  hotspots: [['img', 10, 8, 140, 84, 3], ['circ', 44, 34, 4, 'acc'], ['circ', 106, 66, 4, 'acc'], ['circ', 78, 58, 4, 'acc'], ['panel', 52, 18, 50, 30, 3, 'b'], ['big', 57, 24, 30, 1], ['txt', 57, 32, 40, 2]],
  flipBox: [
    ['img', 8, 16, 44, 68, 3], ['big', 12, 70, 30, 1, 'lt'], ['circ', 45, 22, 3, 'lt'],
    ['acc', 58, 16, 44, 68, 3], ['big', 63, 32, 30, 1], ['txt', 63, 42, 34, 4, 5, 'on'], ['panel', 63, 70, 22, 7, 3],
    ['img', 108, 16, 44, 68, 3, 0, 'alt'], ['big', 112, 70, 30, 1, 'lt'], ['circ', 145, 22, 3, 'lt'],
  ],
  priceList: [
    ['big', 8, 8, 50, 1],
    ...[24, 40, 56, 72].flatMap((y): Shape[] => [['big', 8, y, 34, 1], ['wline', 46, y + 3, 88], ['txt', 138, y + 1.5, 14, 1, 3, 'ink'], ['txt', 8, y + 8, 70, 1]]),
  ],
  businessHours: [
    ['big', 8, 10, 50, 1], ['circ', 105, 12, 2, 'acc'], ['txt', 110, 11.5, 40, 1, 3, 'ink'],
    ...[26, 36, 46, 56, 66, 76, 86].flatMap((y, i): Shape[] => [i === 2 ? ['txt', 8, y, 24, 1, 3, 'ink'] : ['txt', 8, y, 24], ['txt', 112, y, i > 4 ? 22 : 40], ['wline', 8, y + 5, 144]]),
  ],
  share: [
    ['txt', 12, 36, 40, 1, 3, 'ink'],
    ...[12, 48, 84, 120].flatMap((x): Shape[] => [['soft', x, 46, 32, 12, 6], ['circ', x + 7, 52, 2.6, 'acc'], ['txt', x + 13, 51.5, 14]]),
  ],
  reviews: [
    ['big', 8, 10, 50, 1], ['panel', 112, 4, 40, 14, 3], ['lbl', 122, 14, '4.8', 'middle', 'ink'], ['sw', 131, 9.5, 3],
    ...[8, 58, 108].flatMap((x): Shape[] => [['panel', x, 24, 44, 68, 3], ['sw', x + 5, 31, 5], ['txt', x + 5, 40, 34, 4, 5], ['circ', x + 9, 82, 3.5], ['txt', x + 15, 81.5, 22]]),
  ],
  toc: [
    ['panel', 8, 12, 56, 76, 3, 'b'], ['txt', 14, 20, 30, 1, 3, 'ink'],
    ['wline', 14, 30, 0], ['txt', 16, 32, 36], ['acc', 14, 40, 2, 7, 0], ['txt', 19, 42, 34, 1, 3, 'ink'], ['txt', 24, 52, 28], ['txt', 16, 62, 38], ['txt', 16, 72, 30],
    ['big', 76, 14, 60, 1], ['txt', 76, 24, 76, 5], ['big', 76, 56, 48, 1], ['txt', 76, 66, 76, 3],
  ],
  breadcrumbs: [
    ['txt', 12, 36, 60, 1], ['circ', 14, 50, 2.6], ['txt', 20, 49.5, 16, 1, 3, 'ink'], ['chev', 42, 50, 'r'], ['txt', 48, 49.5, 22, 1, 3, 'ink'], ['chev', 76, 50, 'r'], ['txt', 82, 49.5, 30],
    ['wline', 12, 62, 136],
  ],
  textPath: [['circ', 80, 50, 34], ['circ', 80, 50, 25], ['circ', 80, 50, 8, 'acc'], ['lbl', 80, 13, 'text around a circle', 'middle']],
  form: [
    ['big', 8, 8, 50, 1], ['txt', 8, 17, 40, 1, 3, 'ink'], ['soft', 8, 20, 144, 2, 1], ['acc', 8, 20, 72, 2, 1],
    ['txt', 8, 29, 20], ['soft', 8, 33, 70, 9, 2], ['txt', 82, 29, 20], ['soft', 82, 33, 70, 9, 2],
    ['txt', 8, 49, 26], ['soft', 8, 53, 144, 20, 2],
    ['panel', 8, 79, 5, 5, 1], ['txt', 16, 81, 60], ['fbtn', 122, 80, 30],
  ],
  savedBlock: [
    ['panel', 16, 16, 128, 68, 4, 'b'], ['acc', 28, 28, 36, 6, 3], ['big', 28, 42, 80, 1], ['txt', 28, 54, 96],
    ['soft', 28, 66, 40, 8, 4], ['circ', 128, 28, 5, 'acc'],
  ],
  lottie: [
    ['circ', 80, 44, 28, 'lt'], ['circ', 80, 44, 13, 'acc'], ['circ', 108, 24, 5, 'acc'], ['circ', 52, 66, 4],
    ['soft', 40, 86, 80, 3, 1.5], ['acc', 40, 86, 30, 3, 1.5],
  ],
  search: [
    ['big', 30, 22, 100, 1],
    ['panel', 20, 40, 120, 16, 8, 'b'], ['circ', 30, 48, 3], ['txt', 38, 47.5, 50], ['acc', 106, 42, 32, 12, 6],
    ['soft', 30, 66, 22, 7, 3.5], ['soft', 56, 66, 28, 7, 3.5], ['soft', 88, 66, 20, 7, 3.5],
  ],
};

/* ── Site chrome, for Appearance ──────────────────────────────────────────── */

type HeaderVariant = (typeof HEADER_VARIANTS)[number];
type MegaVariant = (typeof MEGA_VARIANTS)[number];
type MobileMenuVariant = (typeof MOBILE_MENU_VARIANTS)[number];
type FooterVariant = (typeof FOOTER_VARIANTS)[number];

export const HEADER_WIREFRAMES: Record<HeaderVariant, Wire> = {
  classic: { shapes: [['img', 0, 12, 160, 88], ['panel', 0, 0, 160, 12], ['ink', 6, 4.5, 16, 3.2], ['txt', 58, 6, 9], ['txt', 71, 6, 9], ['txt', 84, 6, 9], ['txt', 97, 6, 9], ['fbtn', 133, 3.5, 21]] },
  centered: { shapes: [['img', 0, 0, 160, 100], ['burger', 6, 4, 'lt'], ['txt', 14, 6.2, 10, 1, 3.2, 'lt'], ['ink', 66, 3, 28, 6, 'lt'], ['circ', 136, 6, 2, 'lt'], ['circ', 144, 6, 2, 'lt'], ['circ', 152, 6, 2, 'lt']] },
  slim: { shapes: [['img', 0, 7, 160, 93], ['panel', 0, 0, 160, 7], ['ink', 6, 2.3, 8, 2.4], ['txt', 50, 3, 8], ['txt', 62, 3, 8], ['txt', 74, 3, 8], ['txt', 86, 3, 8], ['txt', 98, 3, 8], ['circ', 150, 3.5, 1.3]] },
  pill: { shapes: [['dark', 0, 0, 160, 100], ['txt', 104, 2.6, 12, 1, 3, 'lt'], ['txt', 118, 2.6, 12, 1, 3, 'lt'], ['txt', 132, 2.6, 20, 1, 3, 'lt'], ['ink', 6, 9.5, 18, 4, 'lt'], ['acc', 38, 6.5, 116, 10, 5], ['txt', 46, 11.5, 10, 1, 3, 'on'], ['txt', 60, 11.5, 10, 1, 3, 'on'], ['txt', 74, 11.5, 10, 1, 3, 'on'], ['txt', 88, 11.5, 10, 1, 3, 'on'], ['txt', 102, 11.5, 10, 1, 3, 'on'], ['img', 0, 22, 160, 78, 12]] },
  splitLogo: { shapes: [['img', 0, 12, 160, 88], ['panel', 0, 0, 160, 12], ['txt', 18, 6, 9], ['txt', 31, 6, 9], ['txt', 44, 6, 9], ['ink', 72, 3.5, 16, 5], ['txt', 104, 6, 9], ['txt', 117, 6, 9], ['fbtn', 133, 3.5, 21]] },
  stacked: { shapes: [['img', 0, 22, 160, 78], ['panel', 0, 0, 160, 22], ['ink', 68, 3.5, 24, 5], ['fbtn', 133, 3, 21], ['wline', 0, 12, 160], ['txt', 46, 16, 10], ['txt', 60, 16, 10], ['txt', 74, 16, 10], ['txt', 88, 16, 10], ['txt', 102, 16, 10]] },
  boxed: { shapes: [['img', 0, 0, 160, 100], ['panel', 8, 4, 144, 12, 4], ['ink', 13, 8.5, 14, 3.2], ['txt', 58, 10, 9], ['txt', 71, 10, 9], ['txt', 84, 10, 9], ['fbtn', 124, 7.5, 22]] },
  sidebar: { shapes: [['img', 38, 0, 122, 100], ['panel', 0, 0, 38, 100], ['ink', 5, 6, 16, 3.2], ['txt', 5, 20, 22], ['txt', 5, 27, 18], ['txt', 5, 34, 24], ['txt', 5, 41, 16], ['txt', 5, 48, 20], ['fbtn', 5, 88, 28]] },
  rail: { shapes: [['img', 12, 0, 148, 100], ['panel', 0, 0, 12, 100], ['ink', 3, 4, 6, 4], ['burger', 3, 46], ['circ', 6, 88, 1.5], ['circ', 6, 94, 1.5]] },
  // 2.19 — a round menu button, the logo, links and an outline button.
  menuButtonInline: { shapes: [['img', 0, 12, 160, 88], ['panel', 0, 0, 160, 12], ['circ', 9, 6, 3.4], ['ink', 16, 4.5, 16, 3.2], ['txt', 72, 6, 9], ['txt', 85, 6, 9], ['txt', 98, 6, 9], ['txt', 111, 6, 9], ['btn', 133, 3.5, 21]] },
};

export const MEGA_WIREFRAMES: Record<MegaVariant, Wire> = {
  compact: { shapes: [['dark', 0, 0, 160, 100], ['ink', 6, 4, 14, 3, 'lt'], ['txt', 50, 5.5, 9, 1, 3, 'lt'], ['txt', 62, 5.5, 9, 1, 3, 'lt'], ['txt', 74, 5.5, 9, 1, 3, 'lt'], ['panel', 46, 12, 72, 36, 3], ['txt', 51, 17, 14, 5, 5], ['txt', 69, 17, 14, 5, 5], ['img', 87, 16, 13, 28, 2], ['img', 102, 16, 13, 28, 2]] },
  sheet: { shapes: [['img', 0, 48, 160, 52, 0, 'dim'], ['panel', 0, 0, 160, 48], ['txt', 40, 3, 8], ['txt', 52, 3, 8], ['txt', 64, 3, 8], ['big', 20, 12, 34, 6], ['txt', 68, 12, 18, 7, 4], ['txt', 98, 12, 18, 7, 4]] },
  cards: { shapes: [['img', 0, 60, 160, 40, 0, 'dim'], ['panel', 0, 0, 160, 12], ['ink', 6, 4.5, 14, 3], ['txt', 60, 6, 9], ['txt', 73, 6, 9], ['panel', 0, 12, 160, 48], ['txt', 6, 18, 22, 7, 4], ['img', 38, 17, 34, 22, 2], ['txt', 38, 43, 26, 2, 3], ['img', 77, 17, 34, 22, 2], ['txt', 77, 43, 26, 2, 3], ['img', 116, 17, 34, 22, 2], ['txt', 116, 43, 26, 2, 3]] },
  fullscreen: { shapes: [['dark', 0, 0, 160, 100], ['circ', 8, 8, 3, 'lt'], ['txt', 8, 20, 24, 6, 6, 'lt'], ['txt', 44, 20, 28, 10, 5, 'lt'], ['img', 96, 14, 58, 40, 2], ['btn', 109, 62, 32]] },
};

export const MOBILE_MENU_WIREFRAMES: Record<MobileMenuVariant, Wire> = {
  drilldown: { width: 50, shapes: [['panel', 0, 0, 50, 100], ['ink', 3, 4, 12, 3], ['circ', 45, 5.5, 2], ['fbtn', 4, 14, 42], ['txt', 4, 26, 26], ['chev', 45, 26.5, 'r'], ['wline', 4, 30, 42], ['txt', 4, 34, 22], ['chev', 45, 34.5, 'r'], ['wline', 4, 38, 42], ['txt', 4, 42, 28], ['chev', 45, 42.5, 'r']] },
  accordion: { width: 50, shapes: [['panel', 0, 0, 50, 100], ['ink', 3, 4, 10, 3], ['circ', 45, 5.5, 2], ['txt', 4, 18, 24], ['chev', 45, 18.5, 'u'], ['txt', 8, 25, 20, 3, 4], ['txt', 4, 40, 20], ['chev', 45, 40.5, 'd'], ['txt', 4, 48, 18], ['fbtn', 4, 84, 42], ['btn', 4, 91, 42]] },
  drawer: { width: 50, shapes: [['img', 0, 0, 50, 100, 0, 'dim'], ['panel', 16, 0, 34, 100], ['circ', 45, 5, 2], ['big', 20, 16, 16, 5]] },
  push: { width: 50, shapes: [['img', 32, 0, 18, 100], ['panel', 0, 0, 32, 100], ['circ', 5, 5, 2], ['txt', 4, 16, 22, 6, 6], ['lbl', 41, 54, '→', 'middle', 'lt']] },
  fullscreen: { width: 50, shapes: [['dark', 0, 0, 50, 100], ['ink', 3, 4, 10, 3, 'lt'], ['circ', 45, 5.5, 2, 'lt'], ['big', 4, 20, 30, 1, 'lt'], ['lbl', 44, 22, '+', 'middle', 'lt'], ['big', 4, 32, 26, 1, 'lt'], ['lbl', 44, 34, '+', 'middle', 'lt'], ['big', 4, 44, 32, 1, 'lt'], ['big', 4, 56, 22, 1, 'lt']] },
  fullscreenCentered: { width: 50, shapes: [['dark', 0, 0, 50, 100], ['circ', 45, 5.5, 2, 'lt'], ['big', 12, 30, 26, 1, 'lt'], ['big', 14, 40, 22, 1, 'lt'], ['big', 10, 50, 30, 1, 'lt'], ['big', 15, 60, 20, 1, 'lt']] },
  fullscreenCreative: { width: 50, shapes: [['dark', 0, 0, 50, 100], ['circ', 45, 5.5, 2, 'lt'], ['big', 4, 18, 34, 2, 'lt'], ['big', 4, 36, 28, 2, 'acc'], ['wline', 4, 62, 42], ['txt', 4, 68, 30, 3, 4, 'lt'], ['circ', 6, 88, 1.8, 'lt'], ['circ', 12, 88, 1.8, 'lt']] },
};

export const FOOTER_WIREFRAMES: Record<FooterVariant, Wire> = {
  sitemap: { shapes: [['soft', 0, 0, 160, 100], ['txt', 10, 10, 30], ['wline', 10, 16, 140], ...[10, 40, 70, 100, 130].flatMap((x): Shape[] => [['ink', x, 22, 14, 2], ['txt', x, 28, 20, 5, 4]]), ['wline', 10, 84, 140], ['txt', 10, 90, 60], ['txt', 124, 90, 26]] },
  brand: { shapes: [['dark', 0, 0, 160, 100], ['txt', 10, 20, 26, 2, 4, 'lt'], ['circ', 12, 34, 2.5, 'lt'], ['circ', 20, 34, 2.5, 'lt'], ['circ', 28, 34, 2.5, 'lt'], ['btn', 10, 42, 26], ['txt', 60, 20, 16, 6, 5, 'lt'], ['txt', 82, 20, 16, 6, 5, 'lt'], ['txt', 104, 20, 16, 5, 5, 'lt'], ['txt', 126, 20, 16, 4, 5, 'lt']] },
  centered: { shapes: [['dark', 0, 0, 160, 100], ['circ', 80, 22, 8, 'lt'], ['txt', 60, 38, 40, 1, 3, 'lt'], ['txt', 30, 52, 100, 2, 4, 'lt'], ...[64, 72, 80, 88, 96].map((x): Shape => ['circ', x, 72, 1.8, 'lt']), ['txt', 60, 88, 40, 1, 3, 'lt']] },
  inset: { shapes: [['soft', 0, 0, 160, 100], ['dark', 8, 14, 144, 78, 5], ['panel', 60, 10, 40, 8, 4, 'b'], ['txt', 66, 14, 28], ['ink', 14, 80, 26, 4, 'lt'], ['txt', 96, 26, 14, 6, 5, 'lt'], ['txt', 116, 26, 14, 5, 5, 'lt'], ['txt', 136, 26, 12, 4, 5, 'lt']] },
};

/* ── Blog, for Appearance ─────────────────────────────────────────────────── */

export const BLOG_INDEX_WIREFRAMES: Record<BlogIndexLayout, Wire> = {
  grid: { shapes: cardsRow },
  list: { shapes: [16, 44, 72].flatMap((y): Shape[] => [['img', 8, y, 50, 22, 2], ['txt', 64, y + 3, 16, 1, 3, 'ink'], ['big', 64, y + 8, 60, 1], ['txt', 64, y + 15, 80, 1]]) },
  minimal: { shapes: [['wline', 8, 14, 144], ...[20, 40, 60, 80].flatMap((y): Shape[] => [['txt', 8, y + 5, 20], ['big', 36, y + 3, 90, 1], ['chev', 148, y + 6, 'r'], ['wline', 8, y + 14, 144]])] },
  overlay: { shapes: [8, 58, 108].flatMap((x): Shape[] => [['img', x, 16, 44, 70, 3], ['big', x + 4, 66, 32, 1, 'lt'], ['txt', x + 4, 74, 24, 1, 3, 'lt']]) },
  compact: { shapes: [16, 38, 60].flatMap((y): Shape[] => [8, 84].flatMap((x): Shape[] => [['img', x, y, 16, 16, 2], ['big', x + 20, y + 4, 40, 1], ['txt', x + 20, y + 11, 24]])) },
  wide: { shapes: [['img', 8, 10, 84, 38, 3], ['big', 100, 20, 50, 1], ['txt', 100, 28, 52, 2], ['img', 68, 54, 84, 38, 3], ['big', 8, 64, 50, 1], ['txt', 8, 72, 52, 2]] },
};

export const BLOG_POST_WIREFRAMES: Record<BlogPostLayout, Wire> = {
  standard: { shapes: [['txt', 20, 12, 30, 1, 3, 'ink'], ['big', 20, 20, 100, 2], ['txt', 20, 38, 90, 2], ['wline', 20, 50, 120], ['txt', 20, 58, 120, 5, 6]] },
  cover: { shapes: [['txt', 20, 8, 30, 1, 3, 'ink'], ['big', 20, 15, 100, 1], ['txt', 20, 25, 80], ['img', 20, 32, 120, 44, 3], ['txt', 20, 82, 120, 2, 6]] },
  fullscreen: { shapes: [['img', 0, 0, 160, 64], ['g', 0.5, [['dark', 0, 30, 160, 34]]], ['txt', 12, 38, 26, 1, 3, 'lt'], ['big', 12, 45, 90, 1, 'lt'], ['txt', 12, 54, 70, 1, 3, 'lt'], ['txt', 20, 74, 120, 3, 6]] },
  split: { shapes: [['txt', 10, 22, 26, 1, 3, 'ink'], ['big', 10, 30, 64, 2], ['txt', 10, 48, 60, 2], ['img', 86, 10, 64, 64, 3], ['txt', 10, 84, 140, 2, 6]] },
  // 2.18 — the cover at its own shape, then a rounded card holding the title.
  coverThenTitle: { shapes: [['img', 0, 0, 160, 44], ['panel', 18, 36, 124, 36, 4], ['txt', 26, 42, 30, 1, 3, 'ink'], ['big', 26, 49, 90, 1], ['txt', 26, 58, 60], ['txt', 20, 80, 120, 2, 6]] },
};
