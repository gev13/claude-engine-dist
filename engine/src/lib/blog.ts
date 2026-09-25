import { z } from 'zod';
import { type CardHover, cardHoverSchema } from './cardHover';
import { SHARE_NETWORKS, type ShareNetwork } from './share';

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
export const BLOG_POST_LAYOUTS = ['standard', 'cover', 'fullscreen', 'split', 'coverThenTitle'] as const;
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
export const POST_SHARE_POSITIONS = ['off', 'top', 'bottom', 'side'] as const;
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
    })
    .optional(),
  /** The author's picture, name, bio and links under the article (Profile). */
  authorBox: z.boolean().optional(),
  /** "← Back to the blog" above the title. */
  backLink: z.boolean().optional(),
  /** The line above the title; `{category}`, `{date}` and `{minutes}` are filled in. Empty is what it always said. */
  eyebrow: z.string().trim().max(80).optional(),

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
    })
    .optional(),
  /** A category's own heading: the name, or the name with its description and picture. */
  categoryHero: z.enum(['title', 'full']).optional(),
});

export type BlogSettings = z.infer<typeof blogSchema>;

/**
 * What a post card shows (2.18). Unset means what that layout always showed —
 * the card grid a date, the list layouts a category chip and a date — so the
 * options change a card only once somebody sets one.
 */
export type PostCardOptions = Partial<{ date: boolean; readingTime: boolean; category: boolean; readMore: boolean; ratio: '16/9' | '4/3' | '3/2' | '1/1'; hover: CardHover }>;
export type ResolvedBlog = {
  index: BlogIndexLayout;
  pagination: 'none' | 'more' | 'pages';
  perPage: number;
  post: BlogPostLayout;
  progress: boolean;
  /** Undefined means "as before 2.13": 24 on the index, 48 elsewhere. */
  archivePerPage?: number;
  archivePager: ArchivePager;
  resultCount: boolean;
  share: { position: PostSharePosition; networks: ShareNetwork[] };
  toc: { position: PostTocPosition; levels: 'h2' | 'h2h3'; title?: string };
  prevNext: PrevNextStyle;
  related: { source: RelatedSource; count: number; layout: 'grid' | 'carousel'; title?: string };
  authorBox: boolean;
  backLink: boolean;
  eyebrow?: string;
  chipAll: boolean;
  chipResearch: 'auto' | 'show' | 'hide';
  filterStyle: 'chips' | 'dropdown';
  archiveBreadcrumbs: boolean;
  card: PostCardOptions;
  categoryHero: 'title' | 'full';
};

export function resolveBlog(blog: BlogSettings | undefined): ResolvedBlog {
  return {
    index: blog?.index ?? 'grid',
    pagination: blog?.pagination ?? 'none',
    perPage: blog?.perPage ?? 9,
    post: blog?.post ?? 'standard',
    progress: blog?.progress ?? false,
    archivePerPage: blog?.archivePerPage,
    archivePager: blog?.archivePager ?? 'numbers',
    resultCount: blog?.resultCount ?? false,
    share: { position: blog?.share?.position ?? 'off', networks: blog?.share?.networks ?? ['facebook', 'x', 'pinterest', 'linkedin'] },
    toc: { position: blog?.toc?.position ?? 'off', levels: blog?.toc?.levels ?? 'h2h3', title: blog?.toc?.title },
    prevNext: blog?.prevNext ?? 'off',
    related: { source: blog?.related?.source ?? 'kind', count: blog?.related?.count ?? 3, layout: blog?.related?.layout ?? 'grid', title: blog?.related?.title },
    authorBox: blog?.authorBox ?? false,
    backLink: blog?.backLink ?? false,
    eyebrow: blog?.eyebrow || undefined,
    chipAll: blog?.chipAll ?? true,
    chipResearch: blog?.chipResearch ?? 'auto',
    filterStyle: blog?.filterStyle ?? 'chips',
    archiveBreadcrumbs: blog?.archiveBreadcrumbs ?? false,
    card: blog?.card ?? {},
    categoryHero: blog?.categoryHero ?? 'title',
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

/** Posts per page on one archive: the setting, or what that archive showed before it existed. */
export function archivePerPage(blog: ResolvedBlog, archive: 'index' | 'category' | 'research'): number {
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
