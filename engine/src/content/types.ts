import type { AnyBlock } from '@/lib/blocks';
import type { SeoFields } from '@/server/db/schema';

/**
 * A page as it ships in the repo. The seed writes these into the database; the
 * public site then reads from the database, falling back to these definitions
 * when the database is unreachable (fresh clone, before `npm run setup`).
 */
export type PageDefinition = {
  /** URL path, leading slash, no trailing slash. '/' for the homepage. */
  path: string;
  slug: string;
  title: string;
  navLabel?: string;
  /** One line for cards and menus; shorter than the excerpt. */
  summary?: string;
  excerpt: string;
  /** `library` prints every block's name above it and keeps the page out of search. */
  template?: 'default' | 'service' | 'blog' | 'contact' | 'legal' | 'library';
  priorityTier?: 'primary' | 'secondary';
  /** Locked against deletion in the admin panel. */
  isSystem?: boolean;
  seo: SeoFields;
  blocks: AnyBlock[];
};
