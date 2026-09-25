import { z } from 'zod';

/* ═══════════════════════════════════════════════════════════════════════════
   Permalinks — where the blog lives, and what its addresses look like
   ───────────────────────────────────────────────────────────────────────────
   A site moving from somewhere else keeps its addresses or loses what search
   engines know about it. So the blog's three shapes are a setting (Settings →
   Permalinks), not a folder name:

     • the post URL — under the blog index (`/blog/<slug>`, the default and
       what every existing site has), under its category
       (`/<category>/<slug>`), or at the root (`/<slug>`);
     • the category archive base — `/blog/category` by default;
     • the blog index itself — `/blog` by default.

   Plus a trailing-slash mode: `never` (today, and the default) or `always`,
   where every URL the engine writes ends in `/` and the other form 301s.

   This file imports nothing but zod. The middleware reads it, the catch-all
   route resolves with it, and every link the engine writes to a post goes
   through `postPath` — one builder, so a card, the sitemap and the JSON-LD
   cannot disagree about where a post is.
   ═══════════════════════════════════════════════════════════════════════════ */

export const PERMALINKS_SETTING_KEY = 'permalinks';

export const POST_PATTERNS = ['index', 'category', 'root'] as const;
export type PostPattern = (typeof POST_PATTERNS)[number];

export const TRAILING_SLASH_MODES = ['never', 'always'] as const;
export type TrailingSlashMode = (typeof TRAILING_SLASH_MODES)[number];

export const POST_PATTERN_LABELS: Record<PostPattern, { label: string; example: string }> = {
  index: { label: 'Under the blog', example: '/blog/%slug%' },
  category: { label: 'Under its category', example: '/%category%/%slug%' },
  root: { label: 'At the top level', example: '/%slug%' },
};

/**
 * First path segments the blog may never claim. Each is either a route of the
 * engine's own or a file the middleware leaves alone; a blog index at `/admin`
 * would put a login screen where the articles are.
 */
export const RESERVED_SEGMENTS = [
  'admin',
  'api',
  'install',
  'preview',
  'media',
  '_next',
  '_search',
  'sitemaps',
  'careers',
  'robots.txt',
  'sitemap.xml',
  'llms.txt',
  'feed',
] as const;

/** Lowercase segments, one to three of them. Nothing a person would not type. */
const BASE_PATH = /^(\/[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?){1,3}$/;
const SEGMENT = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;

/** Research sits under the blog index — `/blog/research`. A function, so the schema below can call it at load. */
function researchBase(blogIndex: string): string {
  return `${blogIndex === '/' ? '' : blogIndex}/research`;
}

const basePath = (fallback: string) =>
  z
    .string()
    .trim()
    .toLowerCase()
    .transform((value) => (value.replace(/\/+$/, '') || '/'))
    .refine((value) => BASE_PATH.test(value), 'A path such as /blog — lowercase letters, digits and dashes')
    .refine((value) => !isReservedPath(value), 'That address belongs to the engine')
    .default(fallback);

export const permalinksSchema = z
  .object({
    postPattern: z.enum(POST_PATTERNS).default('index'),
    blogIndex: basePath('/blog'),
    categoryBase: basePath('/blog/category'),
    /** `/blog/page/2` — WordPress calls it `page`, and so does everybody moving from it. */
    pageSegment: z
      .string()
      .trim()
      .toLowerCase()
      .refine((value) => SEGMENT.test(value), 'One word — lowercase letters, digits and dashes')
      .default('page'),
    trailingSlash: z.enum(TRAILING_SLASH_MODES).default('never'),
    /* ── Projects (2.14) ── WordPress portfolio themes use /portfolio,
       /portfolio-category and /portfolio-tag; a new site gets the plainer
       /projects family. */
    projectBase: basePath('/projects'),
    projectCategoryBase: basePath('/projects/category'),
    projectTagBase: basePath('/projects/tag'),
    /* ── Feeds (2.18) ── `/feed` for the blog and `/blog/category/x/feed` for
       a category, as WordPress served them, so subscribers keep theirs. */
    feeds: z.boolean().default(true),
    feedSegment: z
      .string()
      .trim()
      .toLowerCase()
      .refine((value) => SEGMENT.test(value), 'One word — lowercase letters, digits and dashes')
      .default('feed'),
  })
  .superRefine((value, ctx) => {
    const bases = [
      ['blogIndex', value.blogIndex],
      ['categoryBase', value.categoryBase],
      ['projectBase', value.projectBase],
      ['projectCategoryBase', value.projectCategoryBase],
      ['projectTagBase', value.projectTagBase],
    ] as const;
    bases.forEach(([key, path], index) => {
      const clash = bases.slice(0, index).find(([, other]) => other === path);
      if (clash) ctx.addIssue({ code: 'custom', path: [key], message: `The same address as the ${clash[0]}` });
    });
    if (value.categoryBase === value.blogIndex) {
      ctx.addIssue({ code: 'custom', path: ['categoryBase'], message: 'The category base cannot be the blog index itself' });
    }
    if (value.categoryBase === researchBase(value.blogIndex)) {
      ctx.addIssue({ code: 'custom', path: ['categoryBase'], message: 'That is where research lives' });
    }
  });

export type Permalinks = z.output<typeof permalinksSchema>;

export const DEFAULT_PERMALINKS: Permalinks = permalinksSchema.parse({});

/** Never throws: anything unreadable is the shipped defaults, which are today's URLs. */
export function resolvePermalinks(value: unknown): Permalinks {
  const parsed = permalinksSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : DEFAULT_PERMALINKS;
}

export function isReservedPath(path: string): boolean {
  const first = path.split('/')[1] ?? '';
  return (RESERVED_SEGMENTS as readonly string[]).includes(first);
}

/* ── Building addresses ──────────────────────────────────────────────────── */


/** `/blog/page/2`; page 1 is the base itself, never `/page/1`. */
export function pagedPath(base: string, page: number | undefined, p: Permalinks = DEFAULT_PERMALINKS): string {
  if (!page || page <= 1) return base;
  return `${base === '/' ? '' : base}/${p.pageSegment}/${page}`;
}

export function blogIndexPath(p: Permalinks = DEFAULT_PERMALINKS, page?: number): string {
  return pagedPath(p.blogIndex, page, p);
}

export function researchPath(p: Permalinks = DEFAULT_PERMALINKS, page?: number): string {
  return pagedPath(researchBase(p.blogIndex), page, p);
}

/** The blog's RSS feed, or null when feeds are off (2.18). */
export function feedPath(p: Permalinks, categorySlug?: string): string | null {
  if (!p.feeds) return null;
  return categorySlug ? `${p.categoryBase}/${categorySlug}/${p.feedSegment}` : `/${p.feedSegment}`;
}

/**
 * Which feed an address asks for: the blog's, a category's, or none. Pure,
 * for the middleware, which rewrites a feed to the one route that writes it.
 */
export function feedTarget(p: Permalinks, path: string): { category?: string } | null {
  if (!p.feeds) return null;
  if (path === `/${p.feedSegment}`) return {};
  const prefix = `${p.categoryBase}/`;
  const suffix = `/${p.feedSegment}`;
  if (!path.startsWith(prefix) || !path.endsWith(suffix)) return null;
  const slug = path.slice(prefix.length, -suffix.length);
  return /^[a-z0-9-]{1,200}$/.test(slug) ? { category: slug } : null;
}

export function categoryPath(p: Permalinks, slug: string, page?: number): string {
  return pagedPath(`${p.categoryBase}/${slug}`, page, p);
}

/**
 * Where a post lives.
 *
 * `categorySlug` is the post's primary category — or its first one when no
 * primary is set, which is the caller's to decide because only the caller
 * has the list. A post with no category at all under the category pattern
 * sits under the blog index, the way WordPress files it under "uncategorised"
 * rather than inventing a word for it.
 */
/** Where a project lives: `/projects/<slug>`, or `/portfolio/<slug>` on a site that says so. */
export function projectPath(p: Permalinks, slug: string): string {
  return `${p.projectBase}/${slug}`;
}

export type ProjectTaxonomy = 'category' | 'tag';

/** A project category's or tag's archive, and its pages. */
export function projectTermPath(p: Permalinks, taxonomy: ProjectTaxonomy, slug: string, page?: number): string {
  return pagedPath(`${taxonomy === 'category' ? p.projectCategoryBase : p.projectTagBase}/${slug}`, page, p);
}

export function postPath(p: Permalinks, post: { slug: string; categorySlug?: string | null }): string {
  if (p.postPattern === 'root') return `/${post.slug}`;
  if (p.postPattern === 'category' && post.categorySlug) return `/${post.categorySlug}/${post.slug}`;
  return `${p.blogIndex === '/' ? '' : p.blogIndex}/${post.slug}`;
}

/* ── Reading addresses ───────────────────────────────────────────────────── */

export type BlogMatch =
  | { kind: 'project'; slug: string }
  | { kind: 'projectTerm'; taxonomy: ProjectTaxonomy; slug: string; page: number }
  | { kind: 'blogIndex'; page: number }
  | { kind: 'research'; page: number }
  | { kind: 'category'; slug: string; page: number }
  | { kind: 'paged'; base: string; page: number }
  | { kind: 'post'; slug: string; categorySlug?: string };

/**
 * What a site path could be, as far as the URL shapes alone can say.
 *
 * Several answers can be true at once — `/learn/link-building` is a page
 * path *and* a post path under the category pattern — so this returns every
 * candidate in the order the resolver should try them, and the database
 * decides. `path` is locale-free and has no trailing slash.
 */
export function matchBlogPath(p: Permalinks, path: string): BlogMatch[] {
  const matches: BlogMatch[] = [];
  const paged = new RegExp(`^(.*)/${escapeRegExp(p.pageSegment)}/(\\d{1,5})$`).exec(path);
  const base = paged ? paged[1] || '/' : path;
  const page = paged ? Number(paged[2]) : 1;

  if (base === p.blogIndex) matches.push({ kind: 'blogIndex', page });
  if (base === researchBase(p.blogIndex)) matches.push({ kind: 'research', page });

  if (base.startsWith(`${p.categoryBase}/`)) {
    const slug = base.slice(p.categoryBase.length + 1);
    if (SLUG.test(slug)) matches.push({ kind: 'category', slug, page });
  }

  for (const [taxonomy, termBase] of [['category', p.projectCategoryBase], ['tag', p.projectTagBase]] as const) {
    if (base.startsWith(`${termBase}/`)) {
      const slug = base.slice(termBase.length + 1);
      if (SLUG.test(slug)) matches.push({ kind: 'projectTerm', taxonomy, slug, page });
    }
  }

  // Any page may carry a paginated list; the resolver checks it has one.
  if (paged) {
    matches.push({ kind: 'paged', base, page });
    return matches;
  }

  const segments = path.split('/').filter(Boolean);
  const last = segments[segments.length - 1];
  if (!last || !SLUG.test(last)) return matches;

  if (path === `${p.projectBase}/${last}`) matches.push({ kind: 'project', slug: last });

  const underIndex = path === `${p.blogIndex === '/' ? '' : p.blogIndex}/${last}`;
  if (p.postPattern === 'index' && underIndex) matches.push({ kind: 'post', slug: last });
  if (p.postPattern === 'root' && segments.length === 1) matches.push({ kind: 'post', slug: last });
  if (p.postPattern === 'category') {
    if (segments.length === 2) matches.push({ kind: 'post', slug: last, categorySlug: segments[0] });
    else if (underIndex) matches.push({ kind: 'post', slug: last });
  }
  return matches;
}

const SLUG = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/* ── Collisions ──────────────────────────────────────────────────────────── */

/**
 * What would stop these permalinks from working, given what the site has.
 *
 * Checked on save rather than at request time, because a collision found at
 * request time has already been resolved one way — silently — and somebody's
 * page or post has vanished behind the other.
 */
export function permalinkCollisions(
  p: Permalinks,
  site: { pagePaths: string[]; categorySlugs: string[]; locales?: string[] },
): string[] {
  const problems: string[] = [];
  const pagePaths = new Set(site.pagePaths);

  for (const slug of site.categorySlugs) {
    const archive = `${p.categoryBase}/${slug}`;
    if (pagePaths.has(archive)) problems.push(`The page ${archive} has the same address as the “${slug}” category archive.`);
  }

  if (p.postPattern === 'category') {
    const topLevel = new Set(site.pagePaths.map((path) => path.split('/')[1]).filter(Boolean));
    for (const slug of site.categorySlugs) {
      if (topLevel.has(slug)) {
        problems.push(`The category “${slug}” shares its first segment with the page /${slug} — posts filed there would sit under that page’s address.`);
      }
      if (`/${slug}` === p.categoryBase.split('/').slice(0, 2).join('/')) {
        problems.push(`The category “${slug}” has the same name as the start of the category base.`);
      }
    }
  }

  if (p.postPattern === 'category') {
    const projectFirst = p.projectBase.split('/')[1];
    if (site.categorySlugs.includes(projectFirst ?? '')) {
      problems.push(`The category “${projectFirst}” has the same name as the start of the project address ${p.projectBase}.`);
    }
  }

  for (const code of site.locales ?? []) {
    for (const [label, value] of [['blog index', p.blogIndex], ['category base', p.categoryBase]] as const) {
      if (value.split('/')[1] === code) problems.push(`The ${label} starts with /${code}, which is a language prefix on this site.`);
    }
  }

  return problems;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Trailing slash
   ───────────────────────────────────────────────────────────────────────────
   The mode is one site-wide value, read by the middleware on every request
   and by anything that writes a URL. Server code sets it once per process
   from the settings row (`setSlashMode`, called by the cached reader); a
   browser reads it off `<html data-slash>`, which the site layout writes —
   so a client component renders the same href during hydration as the server
   did. `never` is the default and writes exactly what was written before.
   ═══════════════════════════════════════════════════════════════════════════ */

type SlashGlobal = { __heSlashMode?: TrailingSlashMode };

export function setSlashMode(mode: TrailingSlashMode): void {
  (globalThis as SlashGlobal).__heSlashMode = mode;
}

export function slashMode(): TrailingSlashMode {
  if (typeof document !== 'undefined') {
    return document.documentElement.dataset.slash === 'always' ? 'always' : 'never';
  }
  return (globalThis as SlashGlobal).__heSlashMode ?? 'never';
}

/**
 * A site-relative href in the site's trailing-slash form.
 *
 * Only site paths are touched — an off-site URL, a `mailto:`, an anchor and
 * a file (anything whose last segment has an extension) are returned as they
 * are, because `/report.pdf/` is a different file. Under `never` nothing is
 * rewritten at all, so a default site renders byte-for-byte what it did.
 */
export function withSlash(href: string, mode: TrailingSlashMode = slashMode()): string {
  if (mode !== 'always' || !href.startsWith('/') || href.startsWith('//')) return href;
  const cut = href.search(/[?#]/);
  const path = cut === -1 ? href : href.slice(0, cut);
  const tail = cut === -1 ? '' : href.slice(cut);
  if (path === '/' || path.endsWith('/')) return href;
  const last = path.slice(path.lastIndexOf('/') + 1);
  if (/\.[a-z0-9]{1,8}$/i.test(last)) return href;
  return `${path}/${tail}`;
}

/** The same, for an absolute URL on this site (canonicals, sitemaps, JSON-LD). */
export function absoluteWithSlash(origin: string, path: string, mode: TrailingSlashMode = slashMode()): string {
  const withTrailing = withSlash(path === '' ? '/' : path, mode);
  return `${origin}${withTrailing}`;
}
