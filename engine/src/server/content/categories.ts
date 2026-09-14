import 'server-only';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/server/db';
import { categories } from '@/server/db/schema';

export type CategoryRef = {
  id: string;
  slug: string;
  name: string;
  description: string;
  seo: Record<string, unknown>;
};

export async function listCategories(): Promise<CategoryRef[]> {
  try {
    const rows = await db
      .select({
        id: categories.id,
        slug: categories.slug,
        name: categories.name,
        description: categories.description,
        seo: categories.seo,
      })
      .from(categories)
      .orderBy(asc(categories.sortOrder), asc(categories.name));
    return rows.map((r) => ({ ...r, seo: (r.seo ?? {}) as Record<string, unknown> }));
  } catch {
    return [];
  }
}

export async function getCategory(slug: string): Promise<CategoryRef | null> {
  try {
    const [row] = await db
      .select({
        id: categories.id,
        slug: categories.slug,
        name: categories.name,
        description: categories.description,
        seo: categories.seo,
      })
      .from(categories)
      .where(eq(categories.slug, slug))
      .limit(1);
    return row ? { ...row, seo: (row.seo ?? {}) as Record<string, unknown> } : null;
  } catch {
    return null;
  }
}
