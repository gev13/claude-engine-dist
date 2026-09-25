import { NextResponse } from 'next/server';
import { z } from 'zod';
import { CSS_MAX, safeCss } from '@/lib/customCode';
import { and, desc, eq, ilike, isNotNull, isNull, or, sql, type SQL } from 'drizzle-orm';
import { readingMinutes } from '@/lib/utils';
import { toSlug, uniqueSlug } from '@/lib/slug';
import { blockInput, readListParams, seoSchema, statusEnum } from '@/server/api/schemas';
import { badRequest, conflict, created, handle, ok, readJson } from '@/server/api/respond';
import { requireUser } from '@/server/api/guard';
import { audit } from '@/server/auth/audit';
import { clientIp } from '@/server/auth/rateLimit';
import { type AnyBlock, collectInvalidBlocks, parseBlocks } from '@/lib/blocks';
import { revalidateContent } from '@/server/content/revalidate';
import { firstCategory, postPathById } from '@/server/content/posts';
import { getPermalinks } from '@/server/routing/config';
import { POST_LAYOUTS } from '@/lib/blog';
import { blogIndexPath, postPath } from '@/lib/permalinks';
import { captureRevision } from '@/server/content/revisions';
import { sanitizeRichText } from '@/server/content/sanitize';
import { db } from '@/server/db';
import { categories, postCategories, posts, users, type Block, type SeoFields } from '@/server/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const createSchema = z.object({
  slug: z.string().min(1).max(180).optional(),
  title: z.string().min(1).max(300),
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

/** GET /api/admin/posts — paginated list with search and status filter. */
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

export async function GET(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'posts:read');
    if (!guard.ok) return guard.response;

    const url = new URL(request.url);
    const { page, perPage, offset, q, status } = readListParams(url);
    const kind = url.searchParams.get('kind') ?? '';

    const filters: SQL[] = [];
    if (q) filters.push(or(ilike(posts.title, `%${q}%`), ilike(posts.slug, `%${q}%`))!);
    if (status === 'draft' || status === 'published' || status === 'archived') {
      filters.push(eq(posts.status, status));
    }
    if (kind === 'article' || kind === 'research') filters.push(eq(posts.kind, kind));

    /* The trash is a separate view, not a status. `?trashed=1` shows only
       deleted items; every other listing hides them. */
    const trashed = url.searchParams.get('trashed') === '1';
    filters.push(trashed ? isNotNull(posts.deletedAt) : isNull(posts.deletedAt));

    const where = filters.length ? and(...filters) : undefined;

    const [items, [count]] = await Promise.all([
      db
        .select({
          id: posts.id,
          slug: posts.slug,
          title: posts.title,
          excerpt: posts.excerpt,
          kind: posts.kind,
          status: posts.status,
          deletedAt: posts.deletedAt,
          readingMinutes: posts.readingMinutes,
          publishedAt: posts.publishedAt,
          updatedAt: posts.updatedAt,
          authorId: posts.authorId,
          categoryName: categories.name,
          categorySlug: firstCategory('slug'),
          authorFirst: users.firstName,
          authorLast: users.lastName,
        })
        .from(posts)
        .leftJoin(categories, eq(categories.id, posts.primaryCategoryId))
        .leftJoin(users, eq(users.id, posts.authorId))
        .where(where)
        .orderBy(desc(posts.updatedAt))
        .limit(perPage)
        .offset(offset),
      db.select({ n: sql<number>`count(*)::int` }).from(posts).where(where),
    ]);

    // Where each post lives under this site's permalinks, for the list's own labels.
    const permalinks = await getPermalinks();
    return ok({
      items: items.map((item) => ({ ...item, publicPath: postPath(permalinks, item) })),
      total: count?.n ?? 0,
      page,
      perPage,
    });
  });
}

/** POST /api/admin/posts — create. */
export async function POST(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'posts:write');
    if (!guard.ok) return guard.response;

    const parsed = await readJson(request, createSchema);
    if (!parsed.ok) return parsed.response;
    const input = parsed.data;

    const validated = validateBlocks((input.blocks ?? []) as AnyBlock[]);
    if (!validated.ok) return validated.response;

    const existingSlugs = (await db.select({ slug: posts.slug }).from(posts)).map((r) => r.slug);
    const base = toSlug(input.slug ?? input.title, 'post');
    const slug = input.slug ? base : uniqueSlug(base, existingSlugs);

    if (input.slug && existingSlugs.includes(slug)) {
      return conflict('A post with that slug already exists.');
    }

    const body = sanitizeRichText(input.body ?? '');
    const status = input.status ?? 'draft';
    const publishedAt =
      input.publishedAt !== undefined
        ? input.publishedAt
          ? new Date(input.publishedAt)
          : null
        : status === 'published'
          ? new Date()
          : null;

    const [row] = await db
      .insert(posts)
      .values({
        slug,
        title: input.title,
        excerpt: input.excerpt ?? '',
        body,
        blocks: validated.blocks,
        layout: input.layout ?? 'body',
        kind: input.kind ?? 'article',
        status,
        seo: (input.seo ?? {}) as SeoFields,
        customCss: input.customCss ?? '',
        coverMediaId: input.coverMediaId ?? null,
        primaryCategoryId: input.primaryCategoryId ?? null,
        readingMinutes: readingMinutes(body),
        publishedAt,
        authorId: guard.user.id,
      })
      .returning();

    if (!row) return badRequest('Could not create the post.');

    const categoryIds = new Set(input.categoryIds ?? []);
    if (input.primaryCategoryId) categoryIds.add(input.primaryCategoryId);
    if (categoryIds.size > 0) {
      await db
        .insert(postCategories)
        .values([...categoryIds].map((categoryId) => ({ postId: row.id, categoryId })))
        .onConflictDoNothing();
    }

    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: 'post.create',
      targetType: 'post',
      targetId: row.id,
      summary: `Created post "${row.title}" (${row.status})`,
      ip: clientIp(request.headers),
    });

    await captureRevision({
      entityType: 'post',
      entityId: row.id,
      row: row as unknown as Record<string, unknown>,
      reason: 'create',
      actorId: guard.user.id,
      actorEmail: guard.user.email,
    });

    const permalinks = await getPermalinks();
    const publicPath = await postPathById(permalinks, row.id);
    if (row.status === 'published' && publicPath) revalidateContent([publicPath, blogIndexPath(permalinks)]);

    return created({ ...row, publicPath });
  });
}
