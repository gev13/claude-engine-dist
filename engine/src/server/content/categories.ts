import 'server-only';
import { and, asc, eq } from 'drizzle-orm';
import { localeConfig, type Locale } from '@/lib/locales';
import { db } from '@/server/db';
import { categories } from '@/server/db/schema';

export type CategoryRef = {
  id: string;
  slug: string;
  name: string;
  description: string;
  seo: Record<string, unknown>;
  locale: Locale;
  /** Translations of one another share this (package 8). */
  translationGroupId: string;
};

const columns = {
  id: categories.id,
  slug: categories.slug,
  name: categories.name,
  description: categories.description,
  seo: categories.seo,
  locale: categories.locale,
  translationGroupId: categories.translationGroupId,
};

const shape = (row: {
  id: string;
  slug: string;
  name: string;
  description: string;
  seo: unknown;
  locale: string;
  translationGroupId: string;
}): CategoryRef => ({
  ...row,
  seo: (row.seo ?? {}) as Record<string, unknown>,
  locale: row.locale as Locale,
});

/** Categories in one language — the blog is per language, so these are too. */
export async function listCategories(requested?: Locale): Promise<CategoryRef[]> {
  const locale = requested ?? localeConfig().defaultLocale;
  try {
    const rows = await db
      .select(columns)
      .from(categories)
      .where(eq(categories.locale, locale))
      .orderBy(asc(categories.sortOrder), asc(categories.name));
    return rows.map(shape);
  } catch {
    return [];
  }
}

export async function getCategory(slug: string, requested?: Locale): Promise<CategoryRef | null> {
  const locale = requested ?? localeConfig().defaultLocale;
  try {
    const [row] = await db
      .select(columns)
      .from(categories)
      .where(and(eq(categories.slug, slug), eq(categories.locale, locale)))
      .limit(1);
    return row ? shape(row) : null;
  } catch {
    return null;
  }
}

/**
 * Where else this category exists, as `{ locale, slug }` — for `hreflang` and
 * the language switcher, exactly as pages and posts do it.
 */
export async function getCategoryTranslations(
  translationGroupId: string,
): Promise<{ locale: Locale; slug: string }[]> {
  try {
    const rows = await db
      .select({ locale: categories.locale, slug: categories.slug })
      .from(categories)
      .where(eq(categories.translationGroupId, translationGroupId));
    return rows.map((row) => ({ locale: row.locale as Locale, slug: row.slug }));
  } catch {
    return [];
  }
}
