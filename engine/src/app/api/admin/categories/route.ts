import { z } from 'zod';
import { imageUrl } from '@/lib/navigation';
import { asc, sql } from 'drizzle-orm';
import { toSlug, uniqueSlug } from '@/lib/slug';
import { seoSchema } from '@/server/api/schemas';
import { badRequest, conflict, created, handle, ok, readJson } from '@/server/api/respond';
import { requireUser } from '@/server/api/guard';
import { audit } from '@/server/auth/audit';
import { clientIp } from '@/server/auth/rateLimit';
import { getPermalinks } from '@/server/routing/config';
import { blogIndexPath, categoryPath } from '@/lib/permalinks';
import { revalidateContent } from '@/server/content/revalidate';
import { db } from '@/server/db';
import { categories, postCategories, type SeoFields } from '@/server/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const createSchema = z.object({
  slug: z.string().min(1).max(180).optional(),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  /** 2.18 — the picture its archive can open with. */
  imageUrl: imageUrl.nullable().optional(),
  seo: seoSchema.optional(),
  parentId: z.string().uuid().nullable().optional(),
  sortOrder: z.number().int().min(-10_000).max(10_000).optional(),
});

/** GET — the whole list, with a post count. Categories are few; no pagination. */
export async function GET(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'categories:read');
    if (!guard.ok) return guard.response;

    const items = await db
      .select({
        id: categories.id,
        slug: categories.slug,
        name: categories.name,
        description: categories.description,
        imageUrl: categories.imageUrl,
        seo: categories.seo,
        parentId: categories.parentId,
        sortOrder: categories.sortOrder,
        isSystem: categories.isSystem,
        updatedAt: categories.updatedAt,
        postCount: sql<number>`(select count(*)::int from ${postCategories} where ${postCategories.categoryId} = ${categories.id})`,
      })
      .from(categories)
      .orderBy(asc(categories.sortOrder), asc(categories.name));

    return ok({ items, total: items.length, page: 1, perPage: items.length });
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'categories:write');
    if (!guard.ok) return guard.response;

    const parsed = await readJson(request, createSchema);
    if (!parsed.ok) return parsed.response;
    const input = parsed.data;

    const existing = (await db.select({ slug: categories.slug }).from(categories)).map((r) => r.slug);
    const base = toSlug(input.slug ?? input.name, 'category');
    const slug = input.slug ? base : uniqueSlug(base, existing);
    if (existing.includes(slug)) return conflict('A category with that slug already exists.');

    const [row] = await db
      .insert(categories)
      .values({
        slug,
        name: input.name,
        description: input.description ?? '',
        imageUrl: input.imageUrl ?? null,
        seo: (input.seo ?? {}) as SeoFields,
        parentId: input.parentId ?? null,
        sortOrder: input.sortOrder ?? 0,
      })
      .returning();

    if (!row) return badRequest('Could not create the category.');

    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: 'category.create',
      targetType: 'category',
      targetId: row.id,
      summary: `Created category "${row.name}"`,
      ip: clientIp(request.headers),
    });

    const permalinks = await getPermalinks();
    revalidateContent([categoryPath(permalinks, row.slug), blogIndexPath(permalinks)]);

    return created(row);
  });
}
