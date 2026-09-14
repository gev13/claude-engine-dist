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

export const blogSchema = z.object({
  index: z.enum(BLOG_INDEX_LAYOUTS).optional(),
  /** A few at a time, in the browser: the layouts other than the card grid. */
  pagination: z.enum(['none', 'more', 'pages']).optional(),
  perPage: z.number().int().min(2).max(24).optional(),
  post: z.enum(BLOG_POST_LAYOUTS).optional(),
  /** P3-C6 — a bar across the top of the screen that fills as a post is read. */
  progress: z.boolean().optional(),
});

export type BlogSettings = z.infer<typeof blogSchema>;
export type ResolvedBlog = {
  index: BlogIndexLayout;
  pagination: 'none' | 'more' | 'pages';
  perPage: number;
  post: BlogPostLayout;
  progress: boolean;
};

export function resolveBlog(blog: BlogSettings | undefined): ResolvedBlog {
  return {
    index: blog?.index ?? 'grid',
    pagination: blog?.pagination ?? 'none',
    perPage: blog?.perPage ?? 9,
    post: blog?.post ?? 'standard',
    progress: blog?.progress ?? false,
  };
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
