import { z } from 'zod';
import { eq, sql } from 'drizzle-orm';
import { toSlug } from '@/lib/slug';
import { seoSchema } from '@/server/api/schemas';
import { conflict, handle, noContent, notFound, ok, readJson } from '@/server/api/respond';
import { requireUser } from '@/server/api/guard';
import { audit } from '@/server/auth/audit';
import { clientIp } from '@/server/auth/rateLimit';
import { revalidateContent } from '@/server/content/revalidate';
import { db } from '@/server/db';
import { categories, postCategories, posts, type SeoFields } from '@/server/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  slug: z.string().min(1).max(180).optional(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  seo: seoSchema.optional(),
  parentId: z.string().uuid().nullable().optional(),
  sortOrder: z.number().int().min(-10_000).max(10_000).optional(),
});

async function load(id: string) {
  const [row] = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
  return row ?? null;
}

export async function GET(request: Request, ctx: Ctx) {
  return handle(async () => {
    const guard = await requireUser(request, 'categories:read');
    if (!guard.ok) return guard.response;
    const { id } = await ctx.params;
    const row = await load(id);
    return row ? ok(row) : notFound('That category no longer exists.');
  });
}

export async function PATCH(request: Request, ctx: Ctx) {
  return handle(async () => {
    const guard = await requireUser(request, 'categories:write');
    if (!guard.ok) return guard.response;

    const { id } = await ctx.params;
    const row = await load(id);
    if (!row) return notFound('That category no longer exists.');

    const parsed = await readJson(request, updateSchema);
    if (!parsed.ok) return parsed.response;
    const input = parsed.data;

    if (input.slug) {
      const slug = toSlug(input.slug, row.slug);
      const [clash] = await db
        .select({ id: categories.id })
        .from(categories)
        .where(sql`${categories.slug} = ${slug} and ${categories.id} <> ${row.id}`)
        .limit(1);
      if (clash) return conflict('A category with that slug already exists.');
      input.slug = slug;
    }

    const [updated] = await db
      .update(categories)
      .set({
        ...(input.slug !== undefined ? { slug: input.slug } : {}),
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.seo !== undefined ? { seo: input.seo as SeoFields } : {}),
        ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      })
      .where(eq(categories.id, row.id))
      .returning();

    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: 'category.update',
      targetType: 'category',
      targetId: row.id,
      summary: `Updated category "${updated?.name ?? row.name}"`,
      ip: clientIp(request.headers),
    });

    revalidateContent([`/blog/category/${row.slug}`, `/blog/category/${updated?.slug ?? row.slug}`, '/blog']);

    return ok(updated);
  });
}

/**
 * Deleting a category must not delete the writing filed under it. Posts are
 * detached first — join rows removed, primary category nulled — and the audit
 * entry records how many were affected so the change is traceable.
 */
export async function DELETE(request: Request, ctx: Ctx) {
  return handle(async () => {
    const guard = await requireUser(request, 'categories:delete');
    if (!guard.ok) return guard.response;

    const { id } = await ctx.params;
    const row = await load(id);
    if (!row) return notFound('That category no longer exists.');
    if (row.isSystem) return conflict('This category is part of the site structure and cannot be deleted.');

    const detached = await db
      .update(posts)
      .set({ primaryCategoryId: null })
      .where(eq(posts.primaryCategoryId, row.id))
      .returning({ id: posts.id, slug: posts.slug });

    const links = await db
      .delete(postCategories)
      .where(eq(postCategories.categoryId, row.id))
      .returning({ postId: postCategories.postId });

    await db.delete(categories).where(eq(categories.id, row.id));

    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: 'category.delete',
      targetType: 'category',
      targetId: row.id,
      summary: `Deleted category "${row.name}" — ${detached.length} post(s) lost their primary category, ${links.length} link(s) removed`,
      metadata: { slug: row.slug, detachedPosts: detached.length, removedLinks: links.length },
      ip: clientIp(request.headers),
    });

    revalidateContent([`/blog/category/${row.slug}`, '/blog', ...detached.map((p) => `/blog/${p.slug}`)]);

    return noContent();
  });
}
