import 'server-only';
import { alias } from 'drizzle-orm/pg-core';
import { and, asc, desc, eq, ilike, inArray, isNull, or, sql, type SQL } from 'drizzle-orm';
import type { AnyBlock } from '@/lib/blocks';
import { localeConfig, type Locale } from '@/lib/locales';
import { projectPath, projectTermPath, type Permalinks, type ProjectTaxonomy } from '@/lib/permalinks';
import { readProjectOptions, type ProjectCard, type ProjectQuery } from '@/lib/projects';
import { db } from '@/server/db';
import { media, projectTermLinks, projectTerms, projects, users, type SeoFields } from '@/server/db/schema';

/* ═══════════════════════════════════════════════════════════════════════════
   Projects — the public read model
   ───────────────────────────────────────────────────────────────────────────
   Every public read goes through `isPublic` (published, not trashed, publish
   date reached), like pages and posts. Cards are one shape everywhere — the
   projects block, the archives, "More projects" and the load-more API — so a
   project looks the same wherever it is listed. Nothing here throws: an
   unreachable database is an empty portfolio, not an error page.
   ═══════════════════════════════════════════════════════════════════════════ */

const isPublic = and(
  eq(projects.status, 'published'),
  isNull(projects.deletedAt),
  sql`${projects.publishedAt} is not null and ${projects.publishedAt} <= now()`,
);

const cover = alias(media, 'cover');
const hover = alias(media, 'hover');
const hero = alias(media, 'hero');

/** Shuffled order that holds still for one process, so page 2 does not repeat page 1. */
const SEED = String(Date.now());

function orderBy(order: ProjectQuery['order']) {
  if (order === 'newest') return [desc(projects.publishedAt)];
  if (order === 'random') return [sql`md5(${projects.id}::text || ${SEED})`];
  return [asc(projects.sortOrder), desc(projects.publishedAt)];
}

function conditions(q: Omit<ProjectQuery, 'limit'>): SQL[] {
  const where: SQL[] = [isPublic!, eq(projects.locale, q.locale ?? localeConfig().defaultLocale)];
  if (q.featuredOnly) where.push(eq(projects.featured, true));
  if (q.excludeId) where.push(sql`${projects.id} <> ${q.excludeId}`);
  if (q.ids) where.push(q.ids.length ? inArray(projects.id, q.ids) : sql`false`);
  for (const [taxonomy, slugs] of [['category', q.categories], ['tag', q.tags]] as const) {
    if (!slugs?.length) continue;
    const ids = db
      .select({ id: projectTermLinks.projectId })
      .from(projectTermLinks)
      .innerJoin(projectTerms, eq(projectTerms.id, projectTermLinks.termId))
      .where(and(eq(projectTerms.taxonomy, taxonomy), inArray(projectTerms.slug, slugs)));
    where.push(inArray(projects.id, ids));
  }
  return where;
}

/** Each project's categories, primary first, for a set of ids. */
async function categoriesFor(ids: string[]): Promise<Map<string, { slug: string; name: string }[]>> {
  const out = new Map<string, { slug: string; name: string }[]>();
  if (ids.length === 0) return out;
  const rows = await db
    .select({ projectId: projectTermLinks.projectId, slug: projectTerms.slug, name: projectTerms.name })
    .from(projectTermLinks)
    .innerJoin(projectTerms, eq(projectTerms.id, projectTermLinks.termId))
    .where(and(inArray(projectTermLinks.projectId, ids), eq(projectTerms.taxonomy, 'category')))
    .orderBy(desc(projectTermLinks.isPrimary), asc(projectTerms.sortOrder), asc(projectTerms.name));
  for (const row of rows) {
    const list = out.get(row.projectId) ?? [];
    list.push({ slug: row.slug, name: row.name });
    out.set(row.projectId, list);
  }
  return out;
}

export async function listProjectCards(q: ProjectQuery, permalinks: Permalinks): Promise<ProjectCard[]> {
  try {
    const rows = await db
      .select({
        id: projects.id,
        slug: projects.slug,
        title: projects.title,
        summary: projects.summary,
        year: projects.year,
        client: projects.client,
        coverUrl: cover.url,
        hoverUrl: hover.url,
      })
      .from(projects)
      .leftJoin(cover, eq(cover.id, projects.coverMediaId))
      .leftJoin(hover, eq(hover.id, projects.hoverMediaId))
      .where(and(...conditions(q)))
      .orderBy(...orderBy(q.order))
      .limit(Math.min(Math.max(q.limit, 1), 100))
      .offset(q.offset ?? 0);
    const cats = await categoriesFor(rows.map((row) => row.id));
    return rows.map((row) => ({
      ...row,
      href: projectPath(permalinks, row.slug),
      categories: (cats.get(row.id) ?? []).map((c) => ({ ...c, href: projectTermPath(permalinks, 'category', c.slug) })),
    }));
  } catch {
    return [];
  }
}

export async function countProjects(q: Omit<ProjectQuery, 'limit'>): Promise<number> {
  try {
    const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(projects).where(and(...conditions(q)));
    return row?.n ?? 0;
  } catch {
    return 0;
  }
}

/* ── One project ─────────────────────────────────────────────────────────── */

export type ProjectDetail = {
  id: string;
  slug: string;
  locale: Locale;
  translationGroupId: string;
  title: string;
  summary: string;
  excerpt: string;
  intro: string;
  client: string;
  year: string;
  url: string;
  coverUrl: string | null;
  hero: { url: string; mimeType: string; width: number | null; height: number | null } | null;
  blocks: AnyBlock[];
  seo: SeoFields;
  customCss: string;
  options: ReturnType<typeof readProjectOptions>;
  status: string;
  featured: boolean;
  publishedAt: Date | null;
  updatedAt: Date;
  authorName: string | null;
  categories: { slug: string; name: string; primary: boolean }[];
  tags: { slug: string; name: string }[];
};

export async function getProject(slug: string, requested?: Locale): Promise<ProjectDetail | null> {
  const locale = requested ?? localeConfig().defaultLocale;
  return loadProject(and(eq(projects.slug, slug), eq(projects.locale, locale), isPublic));
}

/** Whatever its status — the preview shows a draft exactly as it will look. Never used by a public route. */
export async function getProjectForPreview(id: string): Promise<ProjectDetail | null> {
  return loadProject(eq(projects.id, id));
}

async function loadProject(where: SQL | undefined): Promise<ProjectDetail | null> {
  try {
    const [row] = await db
      .select({
        project: projects,
        coverUrl: cover.url,
        heroUrl: hero.url,
        heroMime: hero.mimeType,
        heroWidth: hero.width,
        heroHeight: hero.height,
        authorFirst: users.firstName,
        authorLast: users.lastName,
      })
      .from(projects)
      .leftJoin(cover, eq(cover.id, projects.coverMediaId))
      .leftJoin(hero, eq(hero.id, projects.heroMediaId))
      .leftJoin(users, eq(users.id, projects.authorId))
      .where(where)
      .limit(1);
    if (!row) return null;
    const p = row.project;

    const terms = await db
      .select({ taxonomy: projectTerms.taxonomy, slug: projectTerms.slug, name: projectTerms.name, primary: projectTermLinks.isPrimary })
      .from(projectTermLinks)
      .innerJoin(projectTerms, eq(projectTerms.id, projectTermLinks.termId))
      .where(eq(projectTermLinks.projectId, p.id))
      .orderBy(desc(projectTermLinks.isPrimary), asc(projectTerms.sortOrder), asc(projectTerms.name));

    return {
      id: p.id,
      slug: p.slug,
      locale: p.locale as Locale,
      translationGroupId: p.translationGroupId,
      title: p.title,
      summary: p.summary,
      excerpt: p.excerpt,
      intro: p.intro,
      client: p.client,
      year: p.year,
      url: p.url,
      coverUrl: row.coverUrl,
      hero: row.heroUrl
        ? { url: row.heroUrl, mimeType: row.heroMime ?? '', width: row.heroWidth, height: row.heroHeight }
        : null,
      blocks: (p.blocks ?? []) as AnyBlock[],
      seo: (p.seo ?? {}) as SeoFields,
      customCss: p.customCss ?? '',
      options: readProjectOptions(p.options),
      status: p.status,
      featured: p.featured,
      publishedAt: p.publishedAt,
      updatedAt: p.updatedAt,
      authorName: [row.authorFirst, row.authorLast].filter(Boolean).join(' ').trim() || null,
      categories: terms.filter((t) => t.taxonomy === 'category').map(({ slug, name, primary }) => ({ slug, name, primary })),
      tags: terms.filter((t) => t.taxonomy === 'tag').map(({ slug, name }) => ({ slug, name })),
    };
  } catch {
    return null;
  }
}

/** A project's public path by id, for the admin's View link and for revalidation. */
export async function projectPathById(p: Permalinks, id: string): Promise<string | null> {
  try {
    const [row] = await db.select({ slug: projects.slug }).from(projects).where(eq(projects.id, id)).limit(1);
    return row ? projectPath(p, row.slug) : null;
  } catch {
    return null;
  }
}

/* ── Categories and tags ─────────────────────────────────────────────────── */

export type ProjectTermRef = {
  id: string;
  taxonomy: ProjectTaxonomy;
  slug: string;
  name: string;
  description: string;
  seo: SeoFields;
  locale: Locale;
  translationGroupId: string;
};

const termColumns = {
  id: projectTerms.id,
  taxonomy: projectTerms.taxonomy,
  slug: projectTerms.slug,
  name: projectTerms.name,
  description: projectTerms.description,
  seo: projectTerms.seo,
  locale: projectTerms.locale,
  translationGroupId: projectTerms.translationGroupId,
};

const shapeTerm = (row: { taxonomy: string; seo: unknown; locale: string } & Omit<ProjectTermRef, 'taxonomy' | 'seo' | 'locale'>) => ({
  ...row,
  taxonomy: (row.taxonomy === 'tag' ? 'tag' : 'category') as ProjectTaxonomy,
  seo: (row.seo ?? {}) as SeoFields,
  locale: row.locale as Locale,
});

export async function listProjectTerms(taxonomy: ProjectTaxonomy, requested?: Locale): Promise<ProjectTermRef[]> {
  const locale = requested ?? localeConfig().defaultLocale;
  try {
    const rows = await db
      .select(termColumns)
      .from(projectTerms)
      .where(and(eq(projectTerms.taxonomy, taxonomy), eq(projectTerms.locale, locale)))
      .orderBy(asc(projectTerms.sortOrder), asc(projectTerms.name));
    return rows.map(shapeTerm);
  } catch {
    return [];
  }
}

export async function getProjectTerm(taxonomy: ProjectTaxonomy, slug: string, requested?: Locale): Promise<ProjectTermRef | null> {
  const locale = requested ?? localeConfig().defaultLocale;
  try {
    const [row] = await db
      .select(termColumns)
      .from(projectTerms)
      .where(and(eq(projectTerms.taxonomy, taxonomy), eq(projectTerms.slug, slug), eq(projectTerms.locale, locale)))
      .limit(1);
    return row ? shapeTerm(row) : null;
  } catch {
    return null;
  }
}

/* ── Enumerations, for the sitemap and llms.txt ──────────────────────────── */

export async function allPublishedProjects(): Promise<
  { id: string; slug: string; title: string; summary: string; locale: Locale; updatedAt: Date; groupId: string; indexable: boolean }[]
> {
  try {
    const rows = await db
      .select({
        indexable: sql<boolean>`coalesce(${projects.seo}->>'robots', '') !~* 'noindex'`,
        id: projects.id,
        slug: projects.slug,
        title: projects.title,
        summary: projects.summary,
        locale: projects.locale,
        updatedAt: projects.updatedAt,
        groupId: projects.translationGroupId,
      })
      .from(projects)
      .where(isPublic)
      .orderBy(asc(projects.sortOrder), desc(projects.publishedAt));
    return rows.map((row) => ({ ...row, locale: row.locale as Locale }));
  } catch {
    return [];
  }
}

/** Terms that have at least one published project — an empty archive is not worth a sitemap entry. */
export async function termsWithProjects(): Promise<{ taxonomy: ProjectTaxonomy; slug: string; locale: Locale }[]> {
  try {
    const rows = await db
      .selectDistinct({ taxonomy: projectTerms.taxonomy, slug: projectTerms.slug, locale: projectTerms.locale })
      .from(projectTerms)
      .innerJoin(projectTermLinks, eq(projectTermLinks.termId, projectTerms.id))
      .innerJoin(projects, eq(projects.id, projectTermLinks.projectId))
      .where(isPublic);
    return rows.map((row) => ({
      taxonomy: row.taxonomy === 'tag' ? 'tag' : 'category',
      slug: row.slug,
      locale: row.locale as Locale,
    }));
  } catch {
    return [];
  }
}

/** Where else this project exists, for hreflang. */
export async function getProjectTranslations(groupId: string): Promise<{ locale: Locale; slug: string }[]> {
  try {
    const rows = await db
      .select({ locale: projects.locale, slug: projects.slug })
      .from(projects)
      .where(and(eq(projects.translationGroupId, groupId), isPublic));
    return rows.map((row) => ({ locale: row.locale as Locale, slug: row.slug }));
  } catch {
    return [];
  }
}

/** Site search, when the template says projects belong in it. A plain match on the words a card shows. */
export async function searchProjectCards(query: string, permalinks: Permalinks, limit = 12): Promise<ProjectCard[]> {
  const like = `%${query.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
  try {
    const ids = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(isPublic, or(ilike(projects.title, like), ilike(projects.summary, like), ilike(projects.excerpt, like), ilike(projects.client, like))))
      .limit(limit);
    if (ids.length === 0) return [];
    return listProjectCards({ ids: ids.map((row) => row.id), limit, order: 'newest' }, permalinks);
  } catch {
    return [];
  }
}
