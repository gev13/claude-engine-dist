import { z } from 'zod';
import { isColor, isLength } from './theme';
import { projectCardSchema } from './projectCard';

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

/* 3.28 — the template details' small fields. */
const lookLength = z.string().trim().max(40).refine((v) => isLength(v), 'Not a valid CSS length').optional();
const lookColour = z.string().trim().max(60).refine((v) => isColor(v), 'Not a colour').optional();
const lookWeight = z.enum(['300', '400', '500', '600', '700', '800']).optional();

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
      /** 3.24 — the cards' own look, as the projects block has it. */
      card: projectCardSchema.optional(),
    })
    .prefault({}),
  /** Include published projects in the site's search results. */
  inSearch: z.boolean().default(false),
  /** 3.23 — the full-width hero's height (e.g. 640px), and on phones; unset is the picture's 16:9 (4:3 on phones). */
  heroHeight: z.string().trim().max(40).refine((v) => isLength(v), 'Not a valid CSS length').optional(),
  heroHeightMobile: z.string().trim().max(40).refine((v) => isLength(v), 'Not a valid CSS length').optional(),
  /** 3.23 — how wide the title and the intro run (e.g. 520px or 40%); unset is 20ch for the title and 62ch for the intro. */
  headWidth: z.string().trim().max(40).refine((v) => isLength(v), 'Not a valid CSS length').optional(),
  /** 3.23 — the categories above the title as chips (as before) or as plain text. */
  categoryStyle: z.enum(['chips', 'plain']).optional(),
  /** 3.22 — every project page's colour, unless a project sets its own; unset is the site's. */
  background: z
    .string()
    .trim()
    .max(60)
    .refine((value) => value === '' || isColor(value), 'A colour such as #000000')
    .optional(),
  /**
   * Blocks shown after every project — a call to action, usually. Ordinary
   * blocks, checked with `collectInvalidBlocks` on save like a popup's.
   */
  cta: z.array(z.unknown()).max(20).default([]),
  /** 3.28 — the project page's and its archives' last details; written by `projectLookCss`, each unset as drawn. */
  look: z
    .object({
      /** The hero picture grows a little (to 1.05) over the first 400px of scrolling. */
      heroZoom: z.boolean().optional(),
      /** A round "back" button at the top left that goes back in history, on project pages and their archives. */
      backLink: z.boolean().optional(),
      /** The tags in a column of their own beside the title and intro (under them on phones). */
      tagsColumn: z.boolean().optional(),
      /** 3.28.1 — the twelfth the tags column starts at (7 is halfway); unset is 8, after a 7/12 heading. */
      tagsStart: z.number().int().min(2).max(11).optional(),
      tagsTitleSize: lookLength,
      tagsTitleWeight: lookWeight,
      tagsColor: lookColour,
      titleSize: lookLength,
      titleSizeLaptop: lookLength,
      titleSizeTablet: lookLength,
      titleSizeMobile: lookLength,
      /** The space from the hero to the category line, its weight, the space under it and under the title. */
      heroGap: lookLength,
      categoryWeight: lookWeight,
      categoryGap: lookLength,
      introGap: lookLength,
      /** A category's or a tag's page: the title's size, the space above it, and from it to the cards. */
      archiveTitleSize: lookLength,
      archiveTop: lookLength,
      archiveTopMobile: lookLength,
      archiveGap: lookLength,
      archiveGapMobile: lookLength,
    })
    .optional(),
});

export type ProjectTemplate = z.output<typeof projectTemplateSchema>;
export type ProjectLook = NonNullable<ProjectTemplate['look']>;

/**
 * 3.28 — the template's details as CSS for the project page and its
 * archives (a <style> they render). Each rule only when its value is set;
 * every value checked again, since it lands in a <style> element.
 */
export function projectLookCss(look: ProjectLook | undefined): string {
  if (!look) return '';
  const len = (v: unknown) => (typeof v === 'string' && isLength(v) ? v : undefined);
  const col = (v: unknown) => (typeof v === 'string' && isColor(v) ? v : undefined);
  const wgt = (v: unknown) => (typeof v === 'string' && /^[3-8]00$/.test(v) ? v : undefined);
  const rule = (selector: string, decls: [string, string | undefined][]) => {
    const body = decls.filter(([, v]) => v).map(([p, v]) => `${p}:${v}`).join(';');
    return body ? `${selector}{${body}}` : '';
  };
  const at = (query: string, css: string) => (css ? `@media ${query}{${css}}` : '');
  const out = [
    rule('.he-prj-head h1', [['font-size', len(look.titleSize)], ['max-width', len(look.titleSize) ? 'none' : undefined]]),
    at('(max-width:1440px)', rule('.he-prj-head h1', [['font-size', len(look.titleSizeLaptop)]])),
    at('(max-width:1024px)', rule('.he-prj-head h1', [['font-size', len(look.titleSizeTablet)]])),
    at('(max-width:768px)', rule('.he-prj-head h1', [['font-size', len(look.titleSizeMobile)]])),
    // (3.28.1) Each the whole space: the section's inner column carries the padding.
    rule('.he-prj-head>.shell', [['padding-top', len(look.heroGap)]]),
    rule('.he-prj-head .he-prj-chips', [['margin-bottom', len(look.categoryGap)]]),
    rule('.he-prj-head .he-prj-chips a', [['font-weight', wgt(look.categoryWeight)]]),
    rule('.he-prj-head .he-prj-intro', [['margin-top', len(look.introGap)]]),
    rule('.he-prj-tags__title', [['font-size', len(look.tagsTitleSize)], ['font-weight', wgt(look.tagsTitleWeight)]]),
    rule('.he-prj-tags a', [['color', col(look.tagsColor)]]),
    rule('.he-prja-head h1', [['font-size', len(look.archiveTitleSize)], ['max-width', len(look.archiveTitleSize) ? 'none' : undefined]]),
    rule('.he-prja-head>.shell', [['padding-top', len(look.archiveTop)]]),
    at('(max-width:768px)', rule('.he-prja-head>.shell', [['padding-top', len(look.archiveTopMobile)]])),
    len(look.archiveGap) ? `.he-prja-head>.shell{padding-bottom:0}.he-prja-head+.he-proj-sec{padding-top:${len(look.archiveGap)}}` : '',
    at('(max-width:768px)', len(look.archiveGapMobile) ? `.he-prja-head+.he-proj-sec{padding-top:${len(look.archiveGapMobile)}}` : ''),
  ];
  return out.filter(Boolean).join('');
}

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
  /** 2.19 — the site's alternate palette for this project's page. */
  scheme: z.enum(['inherit', 'alt', 'alt2']).optional(),
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
    // 3.28 — the project's name, as the picture's alt text.
    alt: card.title.slice(0, 200),
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

