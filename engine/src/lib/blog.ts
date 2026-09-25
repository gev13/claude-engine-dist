import { z } from 'zod';

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

export const BLOG_POST_LAYOUTS = ['standard', 'cover', 'fullscreen', 'split'] as const;
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
});

export type BlogSettings = z.infer<typeof blogSchema>;
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
  };
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
  standard: { label: 'Standard', hint: 'Title, excerpt and the article' },
  cover: { label: 'Cover image', hint: 'A wide cover image under the title' },
  fullscreen: { label: 'Full-screen cover', hint: 'The title over a full-width cover image' },
  split: { label: 'Title beside the cover', hint: 'Title and details on the left, cover on the right' },
};
