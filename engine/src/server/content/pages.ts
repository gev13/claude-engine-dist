import 'server-only';
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '@/server/db';
import { pages } from '@/server/db/schema';
import type { AnyBlock } from '@/lib/blocks';
import type { SeoFields } from '@/server/db/schema';
import { localeConfig, type Locale } from '@/lib/locales';
import { pageDefinitions, pageDefinitionByPath } from '@/content/pages';

export type PublicPage = {
  id: string;
  path: string;
  slug: string;
  locale: Locale;
  /** Translations of one another share this. */
  translationGroupId: string;
  title: string;
  summary: string;
  excerpt: string;
  template: string;
  priorityTier: string | null;
  blocks: AnyBlock[];
  seo: SeoFields;
  /** CSS for this page alone, written into a <style> after the theme. */
  customCss: string;
  updatedAt: Date;
  publishedAt: Date | null;
  /** True when this came from the bundled definitions, not the database. */
  fallback: boolean;
};

/**
 * The bundled definitions are the fallback for an unreachable database, and
 * they are **English only** — they are the repo's own copy of the site.
 *
 * So they answer for the default locale and nobody else. Serving them under an
 * Armenian URL would put English content behind an `hreflang="hy"` promise,
 * which is worse than a 404: it tells a search engine the translation exists.
 */
function fromDefinition(path: string, locale: Locale): PublicPage | null {
  if (locale !== localeConfig().defaultLocale) return null;
  const def = pageDefinitionByPath(path);
  if (!def) return null;
  return {
    id: `def:${def.path}`,
    path: def.path,
    slug: def.slug,
    locale,
    translationGroupId: `def:${def.path}`,
    title: def.title,
    summary: def.summary ?? '',
    excerpt: def.excerpt,
    template: def.template ?? 'default',
    priorityTier: def.priorityTier ?? null,
    blocks: def.blocks,
    seo: def.seo,
    customCss: '',
    updatedAt: new Date(),
    publishedAt: new Date(),
    fallback: true,
  };
}

/**
 * A page is public when it is published *and* its publish date has passed.
 *
 * The date half was missing: a page scheduled for next week went live the
 * moment it was saved, while a post scheduled the same way correctly waited.
 * Scheduling now means the same thing for both.
 */
const isPublic = and(
  eq(pages.status, 'published'),
  isNull(pages.deletedAt),
  sql`${pages.publishedAt} is not null and ${pages.publishedAt} <= now()`,
);

const normalise = (path: string) => (path === '' ? '/' : path.replace(/\/+$/, '') || '/');

function toPublic(row: typeof pages.$inferSelect): PublicPage {
  return {
    id: row.id,
    path: row.path,
    slug: row.slug,
    locale: row.locale as Locale,
    translationGroupId: row.translationGroupId,
    title: row.title,
    summary: row.summary,
    excerpt: row.excerpt,
    template: row.template,
    priorityTier: row.priorityTier,
    blocks: (row.blocks ?? []) as AnyBlock[],
    seo: (row.seo ?? {}) as SeoFields,
    customCss: row.customCss ?? '',
    updatedAt: row.updatedAt,
    publishedAt: row.publishedAt,
    fallback: false,
  };
}

/**
 * Resolve a public page by path *within a language*. Database first (so admin
 * edits win), bundled definition second (so a fresh clone renders before any
 * DB exists).
 *
 * The locale defaults to English so every existing caller keeps working.
 */
export async function getPageByPath(path: string, requested?: Locale): Promise<PublicPage | null> {
  const locale = requested ?? localeConfig().defaultLocale;
  const normalised = normalise(path);

  try {
    const [row] = await db
      .select()
      .from(pages)
      .where(and(eq(pages.locale, locale), eq(pages.path, normalised), isPublic))
      .limit(1);

    if (row) return toPublic(row);
  } catch {
    // fall through to bundled definitions
  }

  return fromDefinition(normalised, locale);
}

/**
 * A public page by its id — the page chosen as the 404 (2.18). Its
 * translation in `requested` when one exists, else the page itself.
 */
export async function getPublicPageById(id: string, requested?: Locale): Promise<PublicPage | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  try {
    const [row] = await db.select().from(pages).where(and(eq(pages.id, id), isPublic)).limit(1);
    if (!row) return null;
    if (requested && row.locale !== requested) {
      const [translated] = await db
        .select()
        .from(pages)
        .where(and(eq(pages.translationGroupId, row.translationGroupId), eq(pages.locale, requested), isPublic))
        .limit(1);
      if (translated) return toPublic(translated);
    }
    return toPublic(row);
  } catch {
    return null;
  }
}

/**
 * Where else this page exists, as `{ locale, path }`.
 *
 * This is what the language switcher offers and what `hreflang` is built from
 * — and it is why the switcher never advertises a translation that does not
 * exist. A page that has only been written in English says so by returning
 * only English.
 */
export async function getTranslations(translationGroupId: string): Promise<{ locale: Locale; path: string }[]> {
  if (translationGroupId.startsWith('def:')) return [];
  try {
    const rows = await db
      .select({ locale: pages.locale, path: pages.path })
      .from(pages)
      .where(and(eq(pages.translationGroupId, translationGroupId), isPublic))
      .orderBy(asc(pages.locale));
    return rows.map((row) => ({ locale: row.locale as Locale, path: row.path }));
  } catch {
    return [];
  }
}

/** Every published path in one language, for sitemaps and static params. */
export async function allPublishedPagePaths(
  requested?: Locale,
): Promise<{ path: string; title: string; updatedAt: Date; template: string; priorityTier: string | null; indexable?: boolean }[]> {
  const locale = requested ?? localeConfig().defaultLocale;
  try {
    const rows = await db
      .select({
        indexable: sql<boolean>`coalesce(${pages.seo}->>'robots', '') !~* 'noindex'`,
        path: pages.path,
        title: pages.title,
        updatedAt: pages.updatedAt,
        template: pages.template,
        priorityTier: pages.priorityTier,
      })
      .from(pages)
      .where(and(eq(pages.locale, locale), isPublic))
      .orderBy(asc(pages.path));
    if (rows.length > 0) return rows;
  } catch {
    // fall through
  }

  // The bundled definitions are the default language; others have no fallback.
  if (locale !== localeConfig().defaultLocale) return [];
  return pageDefinitions.map((d) => ({
    path: d.path,
    title: d.title,
    updatedAt: new Date(),
    template: d.template ?? 'default',
    priorityTier: d.priorityTier ?? null,
  }));
}

/**
 * Every published page in every language, grouped by translation, for the
 * sitemap — which carries each URL once with its alternates beside it, rather
 * than one sitemap per language.
 */
export async function allPublishedPagesByGroup(): Promise<
  {
    path: string;
    locale: Locale;
    updatedAt: Date;
    template: string;
    priorityTier: string | null;
    alternates: { locale: Locale; path: string }[];
    id: string;
    /** False when the page's own robots field says noindex (2.18) — the sitemap leaves it out. */
    indexable: boolean;
  }[]
> {
  try {
    const rows = await db
      .select({
        id: pages.id,
        indexable: sql<boolean>`coalesce(${pages.seo}->>'robots', '') !~* 'noindex'`,
        path: pages.path,
        locale: pages.locale,
        updatedAt: pages.updatedAt,
        template: pages.template,
        priorityTier: pages.priorityTier,
        groupId: pages.translationGroupId,
      })
      .from(pages)
      .where(isPublic)
      .orderBy(asc(pages.path));

    const byGroup = new Map<string, { locale: Locale; path: string }[]>();
    for (const row of rows) {
      const list = byGroup.get(row.groupId) ?? [];
      list.push({ locale: row.locale as Locale, path: row.path });
      byGroup.set(row.groupId, list);
    }

    return rows.map((row) => ({
      id: row.id,
      indexable: row.indexable,
      path: row.path,
      locale: row.locale as Locale,
      updatedAt: row.updatedAt,
      template: row.template,
      priorityTier: row.priorityTier,
      alternates: byGroup.get(row.groupId) ?? [],
    }));
  } catch {
    return [];
  }
}

/** Paths that exist in a language, used to decide what to prerender. */
export async function publishedPathsForLocales(locales: readonly Locale[]): Promise<Map<Locale, string[]>> {
  const out = new Map<Locale, string[]>();
  try {
    const rows = await db
      .select({ path: pages.path, locale: pages.locale })
      .from(pages)
      .where(and(inArray(pages.locale, [...locales]), isPublic));
    for (const row of rows) {
      const list = out.get(row.locale as Locale) ?? [];
      list.push(row.path);
      out.set(row.locale as Locale, list);
    }
  } catch {
    /* nothing prerendered is not an error — dynamicParams covers it */
  }
  return out;
}
