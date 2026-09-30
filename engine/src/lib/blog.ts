import { z } from 'zod';
import { type CardHover, cardHoverSchema } from './cardHover';
import { SHARE_NETWORKS, type ShareNetwork } from './share';

/** 3.22 — a plain length (80px, 5rem, 0). Kept here rather than imported: theme.ts imports this file. */
const isLength = (value: string) => /^(0|\d*\.?\d+(px|rem|em|vw|vh|%))$/.test(value.trim());

/* ═══════════════════════════════════════════════════════════════════════════
   Blog layouts (BL1, BL2)
   ───────────────────────────────────────────────────────────────────────────
   How the blog's own pages look: the list on the blog index (when no Blog
   page has been built in Pages), the category and research pages, and a
   single post. Picked in Appearance → Blog and stored in the theme row.
   `grid` and `standard` are what the blog looked like before this existed.
   ═══════════════════════════════════════════════════════════════════════════ */

export const BLOG_INDEX_LAYOUTS = ['grid', 'list', 'minimal', 'overlay', 'compact', 'wide'] as const;
export type BlogIndexLayout = (typeof BLOG_INDEX_LAYOUTS)[number];

/** `coverThenTitle` (2.18): the cover full-width at its own shape, then a card with the title and details. */
/** `coverThenColumn` (3.23): the cover, then the title and details opening the article's own column — no card. */
export const BLOG_POST_LAYOUTS = ['standard', 'cover', 'fullscreen', 'split', 'coverThenTitle', 'coverThenColumn'] as const;
export type BlogPostLayout = (typeof BLOG_POST_LAYOUTS)[number];

/* ── What a post shows (T3, 2.13) ────────────────────────────────────────
   A post has a body (the rich-text editor) and blocks (the builder). Before
   2.13 the public post showed only the body and the preview only the blocks,
   so the two disagreed about what a post was. `body` is the default because
   it is what every published post already shows. */
export const POST_LAYOUTS = ['body', 'blocks', 'bodyThenBlocks', 'blocksThenBody'] as const;
export type PostLayout = (typeof POST_LAYOUTS)[number];

export const POST_LAYOUT_LABELS: Record<PostLayout, { label: string; hint: string }> = {
  body: { label: 'Article only', hint: 'The text from the editor — what every post showed before' },
  blocks: { label: 'Blocks only', hint: 'Built with the page builder instead of the editor' },
  bodyThenBlocks: { label: 'Article, then blocks', hint: 'The text, then an FAQ, a gallery or a call to action' },
  blocksThenBody: { label: 'Blocks, then article', hint: 'An opening section from the builder above the text' },
};

export function resolvePostLayout(value: unknown): PostLayout {
  return (POST_LAYOUTS as readonly string[]).includes(value as string) ? (value as PostLayout) : 'body';
}

/**
 * Blocks that open a page. A post already opens with its own title, so the
 * builder offers these only when the layout puts the blocks first.
 */
export const POST_OPENER_BLOCKS = ['hero'] as const;

/** Whether the builder should offer opening blocks (heroes) to this post. */
export const postTakesOpeners = (layout: PostLayout) => layout === 'blocks' || layout === 'blocksThenBody';

/* ── Archives: the blog index, categories, research (T2, 2.13) ──────────── */
export const ARCHIVE_PAGERS = ['numbers', 'prevNext', 'loadMore'] as const;
export type ArchivePager = (typeof ARCHIVE_PAGERS)[number];

export const ARCHIVE_PAGER_LABELS: Record<ArchivePager, string> = {
  numbers: 'Numbered pages',
  prevNext: 'Previous and next',
  loadMore: '“Load more” button',
};

/**
 * Before 2.13 the index showed the newest 24 and a category the newest 48,
 * with no way to reach the rest. Those stay the numbers until somebody sets
 * one — a site with fewer posts than that sees nothing change — and past
 * them the archive now pages instead of stopping.
 */
export const LEGACY_INDEX_PER_PAGE = 24;
export const LEGACY_ARCHIVE_PER_PAGE = 48;
export const MAX_ARCHIVE_PER_PAGE = 48;

/* ── A post's extras, and the archives' (2.18) ─────────────────────────── */
/** `beside` (3.22): a column of its own beside the article, following the reader — inside the post, not over the page's edge. */
export const POST_SHARE_POSITIONS = ['off', 'top', 'bottom', 'side', 'beside'] as const;
export type PostSharePosition = (typeof POST_SHARE_POSITIONS)[number];
export const POST_TOC_POSITIONS = ['off', 'left', 'right', 'top'] as const;
export type PostTocPosition = (typeof POST_TOC_POSITIONS)[number];
export const PREV_NEXT_STYLES = ['off', 'bottom', 'floating'] as const;
export type PrevNextStyle = (typeof PREV_NEXT_STYLES)[number];
/** `kind` — posts of the same kind, what "Keep reading" always showed. */
export const RELATED_SOURCES = ['kind', 'primary', 'any', 'off'] as const;
export type RelatedSource = (typeof RELATED_SOURCES)[number];

export const blogSchema = z.object({
  index: z.enum(BLOG_INDEX_LAYOUTS).optional(),
  /** A few at a time, in the browser: the layouts other than the card grid. */
  pagination: z.enum(['none', 'more', 'pages']).optional(),
  perPage: z.number().int().min(2).max(24).optional(),
  post: z.enum(BLOG_POST_LAYOUTS).optional(),
  /** P3-C6 — a bar across the top of the screen that fills as a post is read. */
  progress: z.boolean().optional(),
  /** T2 — posts per archive page, on the server; unset keeps 24 / 48. */
  archivePerPage: z.number().int().min(1).max(MAX_ARCHIVE_PER_PAGE).optional(),
  /** 3.23 — posts per page on a category's archive, when it should differ from the index; unset follows the setting above. */
  categoryPerPage: z.number().int().min(1).max(MAX_ARCHIVE_PER_PAGE).optional(),
  archivePager: z.enum(ARCHIVE_PAGERS).optional(),
  /** “Showing 1–12 of 110 results” above an archive. */
  resultCount: z.boolean().optional(),

  /* ── A post (T19, 2.18) — each off, or as before, until chosen ───────── */
  /** Share buttons: above or below the article, or a bar down the side. */
  share: z.object({ position: z.enum(POST_SHARE_POSITIONS).default('off'), networks: z.array(z.enum(SHARE_NETWORKS)).min(1).max(10).optional() }).optional(),
  /** Contents: a sticky column beside the article, or a list above it. */
  toc: z.object({ position: z.enum(POST_TOC_POSITIONS).default('off'), levels: z.enum(['h2', 'h2h3']).default('h2h3'), title: z.string().trim().max(80).optional() }).optional(),
  /** The previous and next posts: under the article, or a card in the corner. */
  prevNext: z.enum(PREV_NEXT_STYLES).optional(),
  /** "Keep reading": which posts, how many, and how. `kind` is what it always showed. */
  related: z
    .object({
      source: z.enum(RELATED_SOURCES).default('kind'),
      count: z.number().int().min(2).max(6).default(3),
      layout: z.enum(['grid', 'carousel']).default('grid'),
      title: z.string().trim().max(80).optional(),
      /** 3.22 — the grid's cards: text cards (unset, as before) or the archive's own cards, pictures and all. */
      cards: z.enum(['text', 'archive']).optional(),
    })
    .optional(),
  /** The author's picture, name, bio and links under the article (Profile). */
  authorBox: z.boolean().optional(),
  /**
   * 3.6 — the blog switched off: its index, categories, research, posts,
   * search and feeds answer "not found" and its sitemap is empty, until it
   * is switched back on. Nothing is deleted.
   */
  off: z.boolean().optional(),
  /** "← Back to the blog" above the title. */
  backLink: z.boolean().optional(),
  /** The line above the title; `{category}`, `{date}` and `{minutes}` are filled in. Empty is what it always said. */
  eyebrow: z.string().trim().max(80).optional(),
  /** 3.22 — that line after a short rule (unset, as before), with the category as a chip linking to it, or as plain text. */
  eyebrowStyle: z.enum(['rule', 'chip', 'plain']).optional(),
  /** 3.22 — the row under the title (author, reading time, categories): each part, or the row, can be left out. */
  meta: z.object({ off: z.boolean().optional(), author: z.boolean().optional(), readingTime: z.boolean().optional(), categories: z.boolean().optional() }).optional(),
  /** 3.22 — the excerpt under the title (unset or true, as before). */
  excerpt: z.boolean().optional(),
  /** 3.22 — Cover, then a title card: how far the card rides up over the cover (e.g. 80px, 0 for none); unset is the drawn 48–120px. */
  coverOverlap: z.string().trim().max(40).refine(isLength, 'Not a valid CSS length').optional(),
  /** 3.23 — the full-width cover's height (e.g. 600px), and on phones; unset is the picture's own shape. */
  coverHeight: z.string().trim().max(40).refine(isLength, 'Not a valid CSS length').optional(),
  coverHeightMobile: z.string().trim().max(40).refine(isLength, 'Not a valid CSS length').optional(),
  /** 3.22 — the card in the corner: also on phones, and closed for this post only rather than for the visit. */
  upNext: z.object({ phones: z.boolean().optional(), dismiss: z.enum(['visit', 'post']).optional() }).optional(),

  /* ── The blog's archives (T20, 2.18) ─────────────────────────────────── */
  /** The "All" chip. */
  chipAll: z.boolean().optional(),
  /** The "Research" chip: only when there is research (`auto`), always, or never. */
  chipResearch: z.enum(['auto', 'show', 'hide']).optional(),
  /** Categories as chips, or one "Categories" menu. */
  filterStyle: z.enum(['chips', 'dropdown']).optional(),
  /** Home › Blog › Category above an archive's title. */
  archiveBreadcrumbs: z.boolean().optional(),
  /** What each card in an archive shows. Unset is what it always showed. */
  card: z
    .object({
      date: z.boolean().optional(),
      readingTime: z.boolean().optional(),
      category: z.boolean().optional(),
      readMore: z.boolean().optional(),
      ratio: z.enum(['16/9', '4/3', '3/2', '1/1']).optional(),
      /** 2.19 — how each card answers the pointer. */
      hover: cardHoverSchema.optional(),
      /** 3.22 — the card grid: each post's cover at the top of its card. */
      image: z.boolean().optional(),
      /** 3.23 — the excerpt: shown or left out; unset is as each layout draws it. */
      excerpt: z.boolean().optional(),
      /** 3.23 — the category in the line with the date (as the card grid has it), or as a chip under the title. */
      categoryPlace: z.enum(['line', 'under']).optional(),
      /** 3.24 — the title cut to two or three lines, with an ellipsis; unset is every line. */
      titleLines: z.union([z.literal(2), z.literal(3)]).optional(),
    })
    .optional(),
  /** A category's own heading: the name, or the name with its description and picture. */
  categoryHero: z.enum(['title', 'full']).optional(),
  /** 2.22 — the search box at the end of the category bar instead of below it. */
  searchInBar: z.boolean().optional(),
  /** 2.22 — the newest post as a large card, picture left, above the list on the blog's first page. */
  featured: z.boolean().optional(),
  /** 3.3 — the category bar (with the search, when it is in the bar) on every category and research page too. */
  archiveBar: z.boolean().optional(),
  /** 3.3 — with the search in the bar: on its own row under the chips, labelled, instead of at the end. */
  searchBelow: z.boolean().optional(),
  /** 3.22 — no search box on the blog's pages (searching by address still works). */
  searchOff: z.boolean().optional(),
  /** 3.22 — one row under the title: breadcrumbs on the left, the result count and the categories on the right. */
  toolbar: z.boolean().optional(),
  /** 3.22 — the chips' "Browse" label (unset or true, as before). */
  browseLabel: z.boolean().optional(),
  /** 3.23 — the built-in blog index's search title and description, when no page stands at its address. */
  indexSeo: z
    .object({ title: z.string().trim().max(300).optional(), description: z.string().trim().max(1000).optional(), exactTitle: z.boolean().optional() })
    .optional(),
  /** 3.23 — a category's page: the "Blog" eyebrow above its title (unset, as before), a label under it, or neither. */
  categoryLabel: z.enum(['eyebrow', 'subtitle', 'none']).optional(),
});

export type BlogSettings = z.infer<typeof blogSchema>;

/**
 * What a post card shows (2.18). Unset means what that layout always showed —
 * the card grid a date, the list layouts a category chip and a date — so the
 * options change a card only once somebody sets one.
 */
export type PostCardOptions = Partial<{ date: boolean; readingTime: boolean; category: boolean; readMore: boolean; ratio: '16/9' | '4/3' | '3/2' | '1/1'; hover: CardHover; image: boolean; excerpt: boolean; categoryPlace: 'line' | 'under'; titleLines: 2 | 3 }>;
export type ResolvedBlog = {
  index: BlogIndexLayout;
  pagination: 'none' | 'more' | 'pages';
  perPage: number;
  post: BlogPostLayout;
  progress: boolean;
  /** Undefined means "as before 2.13": 24 on the index, 48 elsewhere. */
  archivePerPage?: number;
  categoryPerPage?: number;
  archivePager: ArchivePager;
  resultCount: boolean;
  share: { position: PostSharePosition; networks: ShareNetwork[] };
  toc: { position: PostTocPosition; levels: 'h2' | 'h2h3'; title?: string };
  prevNext: PrevNextStyle;
  related: { source: RelatedSource; count: number; layout: 'grid' | 'carousel'; title?: string; cards: 'text' | 'archive' };
  eyebrowStyle: 'rule' | 'chip' | 'plain';
  meta: { show: boolean; author: boolean; readingTime: boolean; categories: boolean };
  excerpt: boolean;
  coverOverlap?: string;
  coverHeight?: string;
  coverHeightMobile?: string;
  upNext: { phones: boolean; dismiss: 'visit' | 'post' };
  authorBox: boolean;
  backLink: boolean;
  eyebrow?: string;
  chipAll: boolean;
  chipResearch: 'auto' | 'show' | 'hide';
  filterStyle: 'chips' | 'dropdown';
  archiveBreadcrumbs: boolean;
  card: PostCardOptions;
  categoryHero: 'title' | 'full';
  searchInBar: boolean;
  featured: boolean;
  archiveBar: boolean;
  searchBelow: boolean;
  off: boolean;
  searchOff: boolean;
  toolbar: boolean;
  browseLabel: boolean;
  indexSeo: { title?: string; description?: string; exactTitle?: boolean };
  categoryLabel: 'eyebrow' | 'subtitle' | 'none';
};

export function resolveBlog(blog: BlogSettings | undefined): ResolvedBlog {
  return {
    index: blog?.index ?? 'grid',
    pagination: blog?.pagination ?? 'none',
    perPage: blog?.perPage ?? 9,
    post: blog?.post ?? 'standard',
    progress: blog?.progress ?? false,
    archivePerPage: blog?.archivePerPage,
    categoryPerPage: blog?.categoryPerPage,
    archivePager: blog?.archivePager ?? 'numbers',
    resultCount: blog?.resultCount ?? false,
    share: { position: blog?.share?.position ?? 'off', networks: blog?.share?.networks ?? ['facebook', 'x', 'pinterest', 'linkedin'] },
    toc: { position: blog?.toc?.position ?? 'off', levels: blog?.toc?.levels ?? 'h2h3', title: blog?.toc?.title },
    prevNext: blog?.prevNext ?? 'off',
    related: { source: blog?.related?.source ?? 'kind', count: blog?.related?.count ?? 3, layout: blog?.related?.layout ?? 'grid', title: blog?.related?.title, cards: blog?.related?.cards ?? 'text' },
    eyebrowStyle: blog?.eyebrowStyle ?? 'rule',
    meta: {
      show: blog?.meta?.off !== true,
      author: blog?.meta?.author !== false,
      readingTime: blog?.meta?.readingTime !== false,
      categories: blog?.meta?.categories !== false,
    },
    excerpt: blog?.excerpt !== false,
    coverOverlap: blog?.coverOverlap && isLength(blog.coverOverlap) ? blog.coverOverlap : undefined,
    coverHeight: blog?.coverHeight && isLength(blog.coverHeight) ? blog.coverHeight : undefined,
    coverHeightMobile: blog?.coverHeightMobile && isLength(blog.coverHeightMobile) ? blog.coverHeightMobile : undefined,
    upNext: { phones: blog?.upNext?.phones === true, dismiss: blog?.upNext?.dismiss ?? 'visit' },
    authorBox: blog?.authorBox ?? false,
    off: blog?.off ?? false,
    backLink: blog?.backLink ?? false,
    eyebrow: blog?.eyebrow || undefined,
    chipAll: blog?.chipAll ?? true,
    chipResearch: blog?.chipResearch ?? 'auto',
    filterStyle: blog?.filterStyle ?? 'chips',
    archiveBreadcrumbs: blog?.archiveBreadcrumbs ?? false,
    card: blog?.card ?? {},
    categoryHero: blog?.categoryHero ?? 'title',
    searchInBar: blog?.searchInBar ?? false,
    featured: blog?.featured ?? false,
    archiveBar: blog?.archiveBar ?? false,
    searchBelow: blog?.searchBelow ?? false,
    searchOff: blog?.searchOff ?? false,
    toolbar: blog?.toolbar ?? false,
    browseLabel: blog?.browseLabel !== false,
    indexSeo: blog?.indexSeo ?? {},
    categoryLabel: blog?.categoryLabel ?? 'eyebrow',
  };
}

/** `{category} · {minutes} min read` → the line above a post's title (2.18). */
export function fillEyebrow(template: string, values: { category: string; date: string; minutes: number; minRead: string }): string {
  return template
    .replace(/\{category\}/g, values.category)
    .replace(/\{date\}/g, values.date)
    .replace(/\{minutes\}/g, String(values.minutes))
    .replace(/\{minRead\}/g, values.minRead)
    .replace(/\s*[·—|-]\s*$/u, '')
    .trim();
}

/**
 * 3.22 — the line above a post's title in two halves around `{category}`,
 * for the chip style: "{category} · {minutes} min read" → "", "· 17 min read".
 * Null when the line names no category, which is then shown as plain text.
 */
export function eyebrowAroundCategory(
  template: string | undefined,
  values: { date: string; minutes: number; minRead: string },
): { before: string; after: string } | null {
  const line = template || '{category} — {date}';
  const at = line.indexOf('{category}');
  if (at < 0) return null;
  const fill = (part: string) => fillEyebrow(part, { ...values, category: '' });
  return { before: fill(line.slice(0, at)), after: fill(line.slice(at + '{category}'.length)) };
}

/** Posts per page on one archive: the setting, or what that archive showed before it existed. */
export function archivePerPage(blog: ResolvedBlog, archive: 'index' | 'category' | 'research'): number {
  if (archive === 'category' && blog.categoryPerPage) return blog.categoryPerPage;
  return blog.archivePerPage ?? (archive === 'index' ? LEGACY_INDEX_PER_PAGE : LEGACY_ARCHIVE_PER_PAGE);
}

export const BLOG_INDEX_LABELS: Record<BlogIndexLayout, { label: string; hint: string }> = {
  grid: { label: 'Card grid', hint: 'Three text cards to a row' },
  list: { label: 'List', hint: 'Cover beside each title and excerpt' },
  minimal: { label: 'Minimal', hint: 'Dates and large titles, one per line' },
  overlay: { label: 'Text over the cover', hint: 'Cards with the title on the picture' },
  compact: { label: 'Compact', hint: 'Small thumbnails, two columns' },
  wide: { label: 'Wide', hint: 'One post per row, large picture, alternating sides' },
};

export const BLOG_POST_LABELS: Record<BlogPostLayout, { label: string; hint: string }> = {
  coverThenTitle: { label: 'Cover, then a title card', hint: 'The cover full-width at its own shape, then a rounded card with the title and details' },
  coverThenColumn: { label: 'Cover, then the title in the article', hint: 'The cover full-width, then the title and details at the top of the article’s own column — no card' },
  standard: { label: 'Standard', hint: 'Title, excerpt and the article' },
  cover: { label: 'Cover image', hint: 'A wide cover image under the title' },
  fullscreen: { label: 'Full-screen cover', hint: 'The title over a full-width cover image' },
  split: { label: 'Title beside the cover', hint: 'Title and details on the left, cover on the right' },
};

/* ── Category pages (T20, 2.18) ───────────────────────────────────────────
   Blocks above and below the list on every category archive — an intro
   band, a newsletter sign-up, a call to action. One `blogArchive` settings
   row per language, like the project template. Empty is what an archive
   always was. */
export const BLOG_ARCHIVE_SETTING_KEY = 'blogArchive';

export const blogArchiveSchema = z.object({
  before: z.array(z.unknown()).max(12).default([]),
  after: z.array(z.unknown()).max(12).default([]),
});

export type BlogArchiveTemplate = { before: unknown[]; after: unknown[] };

export function resolveBlogArchive(stored: unknown): BlogArchiveTemplate {
  const parsed = blogArchiveSchema.safeParse(stored ?? {});
  return parsed.success ? parsed.data : { before: [], after: [] };
}

/** 3.24 — a card list whose titles stop at two or three lines: its class and custom property, or nothing. */
export function titleClamp(card: { titleLines?: 2 | 3 } | undefined): { className?: string; style: Record<string, number> } {
  const lines = card?.titleLines;
  return lines === 2 || lines === 3 ? { className: 'has-title-lines', style: { '--he-card-lines': lines } } : { style: {} };
}
