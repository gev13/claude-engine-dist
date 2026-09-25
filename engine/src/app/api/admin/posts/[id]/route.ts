import { NextResponse } from 'next/server';
import { z } from 'zod';
import { CSS_MAX, safeCss } from '@/lib/customCode';
import { eq, sql } from 'drizzle-orm';
import { readingMinutes } from '@/lib/utils';
import { toSlug } from '@/lib/slug';
import { blockInput, seoSchema, statusEnum } from '@/server/api/schemas';
import { badRequest, conflict, forbidden, handle, noContent, notFound, ok, readJson } from '@/server/api/respond';
import { requireUser } from '@/server/api/guard';
import { audit } from '@/server/auth/audit';
import { clientIp } from '@/server/auth/rateLimit';
import { ownsOrAdmin } from '@/server/auth/rbac';
import { type AnyBlock, collectInvalidBlocks, parseBlocks } from '@/lib/blocks';
import { revalidateContent } from '@/server/content/revalidate';
import { postPathById } from '@/server/content/posts';
import { getPermalinks } from '@/server/routing/config';
import { POST_LAYOUTS } from '@/lib/blog';
import { blogIndexPath } from '@/lib/permalinks';
import { captureRevision, deleteRevisionsFor } from '@/server/content/revisions';
import { sanitizeRichText } from '@/server/content/sanitize';
import { db } from '@/server/db';
import { postCategories, posts, type Block, type SeoFields } from '@/server/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  slug: z.string().min(1).max(180).optional(),
  title: z.string().min(1).max(300).optional(),
  excerpt: z.string().max(2000).optional(),
  body: z.string().max(500_000).optional(),
  blocks: z.array(blockInput).max(200).optional(),
  /** What the public post shows — the article, the blocks, or both (2.13). */
  layout: z.enum(POST_LAYOUTS).optional(),
  kind: z.enum(['article', 'research']).optional(),
  status: statusEnum.optional(),
  seo: seoSchema.optional(),
  /** CSS for this one page. Sanitised by the schema on the way in. */
  customCss: z.string().max(CSS_MAX).transform(safeCss).optional(),
  coverMediaId: z.string().uuid().nullable().optional(),
  primaryCategoryId: z.string().uuid().nullable().optional(),
  categoryIds: z.array(z.string().uuid()).max(20).optional(),
  publishedAt: z.string().datetime().nullable().optional(),
});

async function load(id: string) {
  const [row] = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
  return row ?? null;
}

/**
 * The renderer drops a block it cannot parse, which turns an editor mistake
 * into a section that quietly vanishes from the live post. Validating on write
 * means a malformed block never reaches the database and the editor is told
 * which one is wrong — the rule the page routes have always followed.
 */
function validateBlocks(
  input: AnyBlock[],
): { ok: true; blocks: Block[] } | { ok: false; response: NextResponse } {
  const problems = collectInvalidBlocks(input);
  if (problems.length > 0) {
    return { ok: false, response: badRequest(`${problems[0]} and was not saved.`, { problems }) };
  }
  // parseBlocks fills in each schema's defaults, so what is stored is complete.
  return { ok: true, blocks: parseBlocks(input) as Block[] };
}

export async function GET(request: Request, ctx: Ctx) {
  return handle(async () => {
    const guard = await requireUser(request, 'posts:read');
    if (!guard.ok) return guard.response;

    const { id } = await ctx.params;
    const row = await load(id);
    if (!row) return notFound('That post no longer exists.');

    const linked = await db
      .select({ categoryId: postCategories.categoryId })
      .from(postCategories)
      .where(eq(postCategories.postId, row.id));

    // Where the post lives under this site's permalinks, for the editor's View link.
    const publicPath = await postPathById(await getPermalinks(), row.id);
    return ok({ ...row, categoryIds: linked.map((l) => l.categoryId), publicPath });
  });
}

export async function PATCH(request: Request, ctx: Ctx) {
  return handle(async () => {
    const guard = await requireUser(request, 'posts:write');
    if (!guard.ok) return guard.response;

    const { id } = await ctx.params;
    const row = await load(id);
    if (!row) return notFound('That post no longer exists.');
    if (!ownsOrAdmin(guard.user, row.authorId)) return forbidden('You can only edit your own posts.');

    const parsed = await readJson(request, updateSchema);
    if (!parsed.ok) return parsed.response;
    const input = parsed.data;

    const validated = validateBlocks((input.blocks ?? []) as AnyBlock[]);
    if (!validated.ok) return validated.response;

    if (input.slug) {
      const slug = toSlug(input.slug, row.slug);
      const [clash] = await db
        .select({ id: posts.id })
        .from(posts)
        .where(sql`${posts.slug} = ${slug} and ${posts.id} <> ${row.id}`)
        .limit(1);
      if (clash) return conflict('A post with that slug already exists.');
      input.slug = slug;
    }

    const body = input.body !== undefined ? sanitizeRichText(input.body) : undefined;
    const nextStatus = input.status ?? row.status;
    const permalinks = await getPermalinks();
    // The address before the save: a new slug or category moves the post, and the old one must stop serving.
    const oldPath = await postPathById(permalinks, row.id);

    // Publishing for the first time stamps the date; unpublishing keeps it, so
    // re-publishing does not silently reorder the blog.
    const publishedAt =
      input.publishedAt !== undefined
        ? input.publishedAt
          ? new Date(input.publishedAt)
          : null
        : nextStatus === 'published' && !row.publishedAt
          ? new Date()
          : row.publishedAt;

    const [updated] = await db
      .update(posts)
      .set({
        ...(input.slug !== undefined ? { slug: input.slug } : {}),
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.excerpt !== undefined ? { excerpt: input.excerpt } : {}),
        ...(body !== undefined ? { body, readingMinutes: readingMinutes(body) } : {}),
        ...(input.blocks !== undefined ? { blocks: validated.blocks } : {}),
        ...(input.layout !== undefined ? { layout: input.layout } : {}),
        ...(input.kind !== undefined ? { kind: input.kind } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.seo !== undefined ? { seo: input.seo as SeoFields } : {}),
        ...(input.customCss !== undefined ? { customCss: input.customCss } : {}),
        ...(input.coverMediaId !== undefined ? { coverMediaId: input.coverMediaId } : {}),
        ...(input.primaryCategoryId !== undefined ? { primaryCategoryId: input.primaryCategoryId } : {}),
        publishedAt,
      })
      .where(eq(posts.id, row.id))
      .returning();

    if (input.categoryIds) {
      const ids = new Set(input.categoryIds);
      if (input.primaryCategoryId) ids.add(input.primaryCategoryId);
      await db.delete(postCategories).where(eq(postCategories.postId, row.id));
      if (ids.size > 0) {
        await db
          .insert(postCategories)
          .values([...ids].map((categoryId) => ({ postId: row.id, categoryId })))
          .onConflictDoNothing();
      }
    }

    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: row.status === nextStatus ? 'post.update' : `post.status.${nextStatus}`,
      targetType: 'post',
      targetId: row.id,
      summary: `Updated post "${updated?.title ?? row.title}"`,
      metadata: { from: row.status, to: nextStatus },
      ip: clientIp(request.headers),
    });

    // Revalidate both slugs when the slug changed, so the old URL stops serving.
    if (updated) {
      await captureRevision({
        entityType: 'post',
        entityId: updated.id,
        row: updated as unknown as Record<string, unknown>,
        actorId: guard.user.id,
        actorEmail: guard.user.email,
      });
    }

    const newPath = await postPathById(permalinks, row.id);
    revalidateContent([oldPath, newPath, blogIndexPath(permalinks)].filter((p): p is string => Boolean(p)));

    return ok({ ...updated, publicPath: newPath });
  });
}

export async function DELETE(request: Request, ctx: Ctx) {
  return handle(async () => {
    const guard = await requireUser(request, 'posts:delete');
    if (!guard.ok) return guard.response;

    const { id } = await ctx.params;
    const row = await load(id);
    if (!row) return notFound('That post no longer exists.');
    if (!ownsOrAdmin(guard.user, row.authorId)) return forbidden('You can only delete your own posts.');
    const permalinks = await getPermalinks();
    const path = await postPathById(permalinks, row.id);

    /* First DELETE trashes; ?permanent=true erases. See the page route for why
       `status` moves to `archived` at the same time. */
    const permanent = new URL(request.url).searchParams.get('permanent') === 'true';

    if (!permanent && row.deletedAt === null) {
      await db
        .update(posts)
        .set({ deletedAt: new Date(), status: 'archived', updatedAt: new Date() })
        .where(eq(posts.id, row.id));
    } else {
      await db.delete(posts).where(eq(posts.id, row.id));
      // History goes with the content it describes.
      await deleteRevisionsFor('post', [row.id]);
    }

    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: permanent || row.deletedAt !== null ? 'post.delete' : 'post.trash',
      targetType: 'post',
      targetId: row.id,
      summary: `Deleted post "${row.title}"`,
      metadata: { slug: row.slug, status: row.status },
      ip: clientIp(request.headers),
    });

    revalidateContent([path, blogIndexPath(permalinks)].filter((p): p is string => Boolean(p)));

    return noContent();
  });
}
