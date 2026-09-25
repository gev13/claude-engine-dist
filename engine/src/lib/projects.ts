import { z } from 'zod';
import { isColor } from './theme';

/* ═══════════════════════════════════════════════════════════════════════════
   Projects (2.14) — what a project page looks like, and what a project can
   change for itself
   ───────────────────────────────────────────────────────────────────────────
   A project is content (its own table, its own admin), and how its page is
   laid out is a site-wide setting — one `projects` settings row, edited at
   Projects → Page template. The defaults are a plain portfolio: a full-width
   hero, the title and intro, the project's own blocks, then three more
   projects from the same category.

   Everything here is data the pure render reads; nothing in it names a site.
   ═══════════════════════════════════════════════════════════════════════════ */

export const PROJECTS_SETTING_KEY = 'projects';

export const PROJECT_HEADERS = ['fullBleed', 'split', 'minimal'] as const;
export type ProjectHeader = (typeof PROJECT_HEADERS)[number];

export const PROJECT_HEADER_LABELS: Record<ProjectHeader, { label: string; hint: string }> = {
  fullBleed: { label: 'Full-width hero', hint: 'The hero picture or video across the page, then the title and intro' },
  split: { label: 'Title beside the hero', hint: 'Title, intro and details on one side, the hero on the other' },
  minimal: { label: 'Title only', hint: 'The title and intro, no hero — the blocks carry the pictures' },
};

/** Where "More projects" finds its projects. */
export const MORE_SOURCES = ['category', 'latest'] as const;

export const PROJECT_ORDERS = ['manual', 'newest', 'random'] as const;
export type ProjectOrder = (typeof PROJECT_ORDERS)[number];

export const PROJECT_ORDER_LABELS: Record<ProjectOrder, string> = {
  manual: 'The order set on each project',
  newest: 'Newest first',
  random: 'Shuffled (again on each rebuild)',
};

const text = (max: number) => z.string().trim().max(max);

export const projectTemplateSchema = z.object({
  header: z.enum(PROJECT_HEADERS).default('fullBleed'),
  /** Client, year and a link to the live work, under the intro. */
  showDetails: z.boolean().default(true),
  /** Category chips above the title. */
  showCategories: z.boolean().default(true),
  more: z
    .object({
      enabled: z.boolean().default(true),
      title: text(120).default('More projects'),
      /** Same primary category, falling back to the newest; or simply the newest. */
      source: z.enum(MORE_SOURCES).default('category'),
      count: z.number().int().min(1).max(6).default(3),
      layout: z.enum(['grid', 'carousel']).default('grid'),
    })
    .prefault({}),
  archive: z
    .object({
      /** The card layouts the projects block has. */
      layout: z.enum(['classic', 'overlay', 'minimal', 'metro', 'list']).default('classic'),
      columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(3),
      perPage: z.number().int().min(1).max(48).default(12),
    })
    .prefault({}),
  /** Include published projects in the site's search results. */
  inSearch: z.boolean().default(false),
  /**
   * Blocks shown after every project — a call to action, usually. Ordinary
   * blocks, checked with `collectInvalidBlocks` on save like a popup's.
   */
  cta: z.array(z.unknown()).max(20).default([]),
});

export type ProjectTemplate = z.output<typeof projectTemplateSchema>;

/** Never throws: an unreadable row is the plain defaults. */
export function resolveProjectTemplate(value: unknown): ProjectTemplate {
  const parsed = projectTemplateSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : projectTemplateSchema.parse({});
}

/** What one project can change for itself. Checked on write and on read — the colour lands in a style. */
export const projectOptionsSchema = z.object({
  hideMore: z.boolean().optional(),
  background: z
    .string()
    .trim()
    .max(60)
    .refine((value) => value === '' || isColor(value), 'A colour such as #000000')
    .optional(),
});

export function readProjectOptions(value: unknown): z.output<typeof projectOptionsSchema> {
  const parsed = projectOptionsSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : {};
}

/* ── The projects block, filled from the collection (T6) ─────────────────── */

/** The filters a projects block set to `collection` reads. */
export type ProjectQuery = {
  categories?: string[];
  tags?: string[];
  featuredOnly?: boolean;
  /** Leave out the project whose page this is. */
  excludeId?: string;
  order?: ProjectOrder;
  /** Only these projects — what a search matched. */
  ids?: string[];
  limit: number;
  offset?: number;
  locale?: string;
};

/** A project as a card needs it — the shape the block, the archives and the API share. */
export type ProjectCard = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  year: string;
  client: string;
  coverUrl: string | null;
  hoverUrl: string | null;
  href: string;
  categories: { slug: string; name: string; href: string }[];
};

/** A card as the block's items expect it. */
export function projectItem(card: ProjectCard) {
  return {
    title: card.title.slice(0, 100),
    category: card.categories[0]?.name.slice(0, 40) ?? '',
    year: card.year.slice(0, 12),
    summary: card.summary,
    imageUrl: card.coverUrl ?? undefined,
    hoverImageUrl: card.hoverUrl ?? undefined,
    alt: '',
    href: card.href,
    chips: card.categories.map((category) => ({ label: category.name, href: category.href })),
  };
}

/** The block's own filters as a query string for `/api/projects` — nothing else goes in it. */
export function projectQueryString(q: Omit<ProjectQuery, 'offset'>): string {
  const params = new URLSearchParams();
  for (const slug of q.categories ?? []) params.append('category', slug);
  for (const slug of q.tags ?? []) params.append('tag', slug);
  if (q.featuredOnly) params.set('featured', '1');
  if (q.excludeId) params.set('exclude', q.excludeId);
  if (q.order) params.set('order', q.order);
  if (q.locale) params.set('locale', q.locale);
  params.set('limit', String(q.limit));
  return params.toString();
}

