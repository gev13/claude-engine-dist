import { NextResponse } from 'next/server';
import { z } from 'zod';
import { CSS_MAX, safeCss } from '@/lib/customCode';
import { and, asc, eq, ilike, isNotNull, isNull, or, sql, type SQL } from 'drizzle-orm';
import { type AnyBlock, collectInvalidBlocks, parseBlocks } from '@/lib/blocks';
import { toPath, toSlug, uniqueSlug } from '@/lib/slug';
import { badRequest, conflict, created, handle, ok, readJson } from '@/server/api/respond';
import { blockInput } from '@/server/api/schemas';
import { captureRevision } from '@/server/content/revisions';
import { requireUser } from '@/server/api/guard';
import { audit } from '@/server/auth/audit';
import { clientIp } from '@/server/auth/rateLimit';
import { revalidateContent, revalidateEverything } from '@/server/content/revalidate';
import { db } from '@/server/db';
import { pages, type Block, type SeoFields } from '@/server/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const statusEnum = z.enum(['draft', 'published', 'archived']);

const seoSchema = z.object({
  title: z.string().max(300).optional(),
  description: z.string().max(1000).optional(),
  canonicalUrl: z.string().max(500).optional(),
  robots: z.string().max(120).optional(),
  ogTitle: z.string().max(300).optional(),
  ogDescription: z.string().max(1000).optional(),
  ogImageId: z.string().max(64).optional(),
  twitterCard: z.enum(['summary', 'summary_large_image']).optional(),
  jsonLd: z.array(z.unknown()).max(20).optional(),
  extraMeta: z
    .array(z.object({ name: z.string().optional(), property: z.string().optional(), content: z.string() }))
    .max(40)
    .optional(),
});

const createSchema = z.object({
  slug: z.string().min(1).max(180).optional(),
  path: z.string().min(1).max(300).optional(),
  title: z.string().min(1).max(300),
  navLabel: z.string().max(120).nullable().optional(),
  summary: z.string().max(300).optional(),
  excerpt: z.string().max(2000).optional(),
  status: statusEnum.optional(),
  blocks: z.array(blockInput).max(200).optional(),
  seo: seoSchema.optional(),
  /** CSS for this one page. Sanitised by the schema on the way in. */
  customCss: z.string().max(CSS_MAX).transform(safeCss).optional(),
  parentId: z.string().uuid().nullable().optional(),
  sortOrder: z.number().int().min(-10_000).max(10_000).optional(),
  template: z.enum(['default', 'service', 'blog', 'contact', 'legal', 'library']).optional(),
  priorityTier: z.enum(['primary', 'secondary']).nullable().optional(),
});

/** Leading slash, no trailing slash, `/` for the root. */
function normalisePath(input: string): string {
  const trimmed = input.trim();
  if (!trimmed || trimmed === '/') return '/';
  const withSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withSlash.replace(/\/+$/, '') || '/';
}

/**
 * The renderer silently drops a block it cannot parse, which turns an editor
 * mistake into a section that quietly vanishes from the live page. Validating
 * on write instead means a malformed block never reaches the database and the
 * editor is told which one is wrong.
 */
function validateBlocks(
  input: AnyBlock[],
): { ok: true; blocks: Block[] } | { ok: false; response: NextResponse } {
  // Recurses into rows, so a broken block inside a column is reported rather
  // than silently dropped when the page renders.
  const problems = collectInvalidBlocks(input);
  if (problems.length > 0) {
    return {
      ok: false,
      response: badRequest(`${problems[0]} and was not saved.`, { problems }),
    };
  }
  // parseBlocks fills in each schema's defaults, so what is stored is complete.
  return { ok: true, blocks: parseBlocks(input) as Block[] };
}

export async function GET(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'pages:read');
    // requireUser types its rejection as Response; handle() is typed on NextResponse.
    if (!guard.ok) return guard.response as NextResponse;

    const url = new URL(request.url);
    const q = (url.searchParams.get('q') ?? '').trim();
    const statusParam = url.searchParams.get('status');
    const page = Math.max(1, Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
    const perPage = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get('perPage') ?? '20', 10) || 20));

    const conditions: SQL[] = [];

    if (q) {
      const like = `%${q}%`;
      conditions.push(or(ilike(pages.title, like), ilike(pages.slug, like), ilike(pages.path, like))!);
    }

    if (statusParam && statusParam !== 'all') {
      const status = statusEnum.safeParse(statusParam);
      if (!status.success) return badRequest('Unknown status filter.');
      conditions.push(eq(pages.status, status.data));
    }
    /* The trash is a separate view, not a status. `?trashed=1` shows only
       deleted items; every other listing hides them. */
    const trashed = url.searchParams.get('trashed') === '1';
    conditions.push(trashed ? isNotNull(pages.deletedAt) : isNull(pages.deletedAt));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [totals] = await db.select({ n: sql<number>`count(*)::int` }).from(pages).where(where);

    const items = await db
      .select({
        id: pages.id,
        slug: pages.slug,
        path: pages.path,
        title: pages.title,
        navLabel: pages.navLabel,
        excerpt: pages.excerpt,
        status: pages.status,
        deletedAt: pages.deletedAt,
        parentId: pages.parentId,
        sortOrder: pages.sortOrder,
        template: pages.template,
        priorityTier: pages.priorityTier,
        isSystem: pages.isSystem,
        authorId: pages.authorId,
        publishedAt: pages.publishedAt,
        createdAt: pages.createdAt,
        updatedAt: pages.updatedAt,
        // The block tree is far too heavy for a list; its size is all the UI needs.
        blockCount: sql<number>`coalesce(jsonb_array_length(${pages.blocks}), 0)::int`,
      })
      .from(pages)
      .where(where)
      .orderBy(asc(pages.sortOrder), asc(pages.path))
      .limit(perPage)
      .offset((page - 1) * perPage);

    return ok({ items, total: totals?.n ?? 0, page, perPage });
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'pages:write');
    if (!guard.ok) return guard.response as NextResponse;

    const parsed = await readJson(request, createSchema);
    if (!parsed.ok) return parsed.response;
    const data = parsed.data;

    // A parent supplies the path prefix, so it has to exist before we derive one.
    let parentPath: string | null = null;
    if (data.parentId) {
      const [parent] = await db
        .select({ path: pages.path })
        .from(pages)
        .where(eq(pages.id, data.parentId))
        .limit(1);
      if (!parent) return badRequest('That parent page no longer exists.');
      parentPath = parent.path;
    }

    const existing = await db.select({ slug: pages.slug }).from(pages);
    const takenSlugs = existing.map((row) => row.slug);

    let slug: string;
    if (data.slug) {
      slug = toSlug(data.slug);
      if (takenSlugs.includes(slug)) return conflict(`The slug "${slug}" is already used by another page.`);
    } else {
      slug = uniqueSlug(toSlug(data.title), takenSlugs);
    }

    const path = normalisePath(data.path ?? toPath(slug, parentPath));
    const [pathClash] = await db.select({ id: pages.id }).from(pages).where(eq(pages.path, path)).limit(1);
    if (pathClash) return conflict(`The path ${path} is already used by another page.`);

    const validated = validateBlocks(data.blocks ?? []);
    if (!validated.ok) return validated.response;

    const status = data.status ?? 'draft';

    const [row] = await db
      .insert(pages)
      .values({
        slug,
        path,
        title: data.title,
        navLabel: data.navLabel ?? null,
        summary: data.summary ?? '',
        excerpt: data.excerpt ?? '',
        status,
        blocks: validated.blocks,
        seo: (data.seo ?? {}) as SeoFields,
        customCss: data.customCss ?? '',
        parentId: data.parentId ?? null,
        sortOrder: data.sortOrder ?? 0,
        template: data.template ?? 'default',
        priorityTier: data.priorityTier ?? null,
        publishedAt: status === 'published' ? new Date() : null,
        authorId: guard.user.id,
      })
      .returning();

    if (!row) throw new Error('Page insert returned no row.');

    await captureRevision({
      entityType: 'page',
      entityId: row.id,
      row: row as unknown as Record<string, unknown>,
      reason: 'create',
      actorId: guard.user.id,
      actorEmail: guard.user.email,
    });

    revalidateContent([row.path]);
    // A service page is part of the catalogue, which the services index, the
    // contact form's checkboxes, llms.txt and the default footer menu all read.
    // That is global state, so the whole tree goes stale, not one path.
    if (row.template === 'service') revalidateEverything();

    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: 'page.create',
      targetType: 'page',
      targetId: row.id,
      summary: `Created page "${row.title}" at ${row.path} (${row.status})`,
      metadata: { path: row.path, slug: row.slug, status: row.status, blocks: validated.blocks.length },
      ip: clientIp(request.headers),
    });

    return created(row);
  });
}
