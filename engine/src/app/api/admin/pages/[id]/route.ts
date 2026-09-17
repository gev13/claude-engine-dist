import { NextResponse } from 'next/server';
import { z } from 'zod';
import { CSS_MAX, safeCss } from '@/lib/customCode';
import { and, eq, ne } from 'drizzle-orm';
import { type AnyBlock, collectInvalidBlocks, parseBlocks } from '@/lib/blocks';
import { toPath, toSlug } from '@/lib/slug';
import { badRequest, conflict, forbidden, handle, notFound, ok, readJson } from '@/server/api/respond';
import { blockInput } from '@/server/api/schemas';
import { captureRevision, deleteRevisionsFor } from '@/server/content/revisions';
import { requireUser } from '@/server/api/guard';
import { audit } from '@/server/auth/audit';
import { ownsOrAdmin } from '@/server/auth/rbac';
import { clientIp } from '@/server/auth/rateLimit';
import { revalidateContent, revalidateEverything } from '@/server/content/revalidate';
import { db } from '@/server/db';
import { pages, type Block, type SeoFields } from '@/server/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

const updateSchema = z.object({
  slug: z.string().min(1).max(180).optional(),
  path: z.string().min(1).max(300).optional(),
  title: z.string().min(1).max(300).optional(),
  navLabel: z.string().max(120).nullable().optional(),
  summary: z.string().max(300).optional(),
  excerpt: z.string().max(2000).optional(),
  status: statusEnum.optional(),
  /**
   * When the page goes live (P5). A time in the future keeps it off the site
   * until then: the public queries ask for `published_at <= now()`, and pages
   * revalidate every five minutes, so a scheduled page appears within that
   * window without anything having to run on a timer. Null clears the date.
   */
  publishedAt: z.string().datetime().nullable().optional(),
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
 * A block the renderer cannot parse disappears from the live page without a
 * word, so it is rejected here instead — with the position of the bad one.
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
  return { ok: true, blocks: parseBlocks(input) as Block[] };
}

export async function GET(request: Request, context: Context) {
  return handle(async () => {
    const guard = await requireUser(request, 'pages:read');
    // requireUser types its rejection as Response; handle() is typed on NextResponse.
    if (!guard.ok) return guard.response as NextResponse;

    const { id } = await context.params;
    if (!UUID.test(id)) return notFound('That page does not exist.');

    const [row] = await db.select().from(pages).where(eq(pages.id, id)).limit(1);
    if (!row) return notFound('That page does not exist.');

    return ok(row);
  });
}

export async function PATCH(request: Request, context: Context) {
  return handle(async () => {
    const guard = await requireUser(request, 'pages:write');
    if (!guard.ok) return guard.response as NextResponse;

    const { id } = await context.params;
    if (!UUID.test(id)) return notFound('That page does not exist.');

    const [row] = await db.select().from(pages).where(eq(pages.id, id)).limit(1);
    if (!row) return notFound('That page does not exist.');
    if (!ownsOrAdmin(guard.user, row.authorId)) return forbidden();

    const parsed = await readJson(request, updateSchema);
    if (!parsed.ok) return parsed.response;
    const data = parsed.data;

    /* ── Slug, parent and path ───────────────────────────────────────────── */

    let slug = row.slug;
    if (data.slug !== undefined) {
      slug = toSlug(data.slug);
      if (slug !== row.slug) {
        const [clash] = await db
          .select({ id: pages.id })
          .from(pages)
          .where(and(eq(pages.slug, slug), ne(pages.id, id)))
          .limit(1);
        if (clash) return conflict(`The slug "${slug}" is already used by another page.`);
      }
    }

    let parentId = row.parentId;
    if (data.parentId !== undefined) {
      if (data.parentId === id) return badRequest('A page cannot be its own parent.');
      parentId = data.parentId;
    }

    let parentPath: string | null = null;
    if (parentId) {
      const [parent] = await db.select({ path: pages.path }).from(pages).where(eq(pages.id, parentId)).limit(1);
      if (!parent) return badRequest('That parent page no longer exists.');
      parentPath = parent.path;
    }

    // An explicit path always wins; otherwise it is re-derived only when one of
    // its inputs actually moved, so an unrelated edit never rewrites a live URL.
    let path = row.path;
    if (data.path !== undefined) {
      path = normalisePath(data.path);
    } else if (slug !== row.slug || parentId !== row.parentId) {
      path = normalisePath(toPath(slug, parentPath));
    }

    if (path !== row.path) {
      const [clash] = await db
        .select({ id: pages.id })
        .from(pages)
        .where(and(eq(pages.path, path), ne(pages.id, id)))
        .limit(1);
      if (clash) return conflict(`The path ${path} is already used by another page.`);
    }

    /* ── Blocks ──────────────────────────────────────────────────────────── */

    let blocks = row.blocks;
    if (data.blocks !== undefined) {
      const validated = validateBlocks(data.blocks);
      if (!validated.ok) return validated.response;
      blocks = validated.blocks;
    }

    /* ── Status ──────────────────────────────────────────────────────────── */

    const status = data.status ?? row.status;
    let publishedAt = row.publishedAt;
    // An explicit date wins — including a future one, which schedules the page.
    if (data.publishedAt !== undefined) publishedAt = data.publishedAt ? new Date(data.publishedAt) : null;
    else if (status === 'published' && !publishedAt) publishedAt = new Date();

    const [updated] = await db
      .update(pages)
      .set({
        slug,
        path,
        title: data.title ?? row.title,
        navLabel: data.navLabel !== undefined ? data.navLabel : row.navLabel,
        summary: data.summary ?? row.summary,
        excerpt: data.excerpt ?? row.excerpt,
        status,
        blocks,
        seo: data.seo !== undefined ? (data.seo as SeoFields) : row.seo,
        customCss: data.customCss !== undefined ? data.customCss : row.customCss,
        parentId,
        sortOrder: data.sortOrder ?? row.sortOrder,
        template: data.template ?? row.template,
        priorityTier: data.priorityTier !== undefined ? data.priorityTier : row.priorityTier,
        publishedAt,
        updatedAt: new Date(),
      })
      .where(eq(pages.id, id))
      .returning();

    if (!updated) return notFound('That page does not exist.');

    // Both paths, so a moved page stops serving from its old URL too.
    await captureRevision({
      entityType: 'page',
      entityId: updated.id,
      row: updated as unknown as Record<string, unknown>,
      actorId: guard.user.id,
      actorEmail: guard.user.email,
    });

    revalidateContent([updated.path, row.path]);
    // A service page is part of the catalogue, which the services index, the
    // contact form's checkboxes, llms.txt and the default footer menu all read.
    // That is global state, so the whole tree goes stale, not one path.
    if (updated.template === 'service' || row.template === 'service') revalidateEverything();

    const statusChanged = status !== row.status;
    const action = statusChanged
      ? status === 'published'
        ? 'page.publish'
        : row.status === 'published'
          ? 'page.unpublish'
          : 'page.update'
      : 'page.update';

    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action,
      targetType: 'page',
      targetId: updated.id,
      summary: statusChanged
        ? `Changed page "${updated.title}" from ${row.status} to ${status}`
        : `Updated page "${updated.title}" (${updated.path})`,
      metadata: {
        fields: Object.keys(data),
        pathFrom: row.path,
        pathTo: updated.path,
        statusFrom: row.status,
        statusTo: status,
      },
      ip: clientIp(request.headers),
    });

    return ok(updated);
  });
}

export async function DELETE(request: Request, context: Context) {
  return handle(async () => {
    const guard = await requireUser(request, 'pages:delete');
    if (!guard.ok) return guard.response as NextResponse;

    const { id } = await context.params;
    if (!UUID.test(id)) return notFound('That page does not exist.');

    const [row] = await db.select().from(pages).where(eq(pages.id, id)).limit(1);
    if (!row) return notFound('That page does not exist.');
    if (!ownsOrAdmin(guard.user, row.authorId)) return forbidden();
    if (row.isSystem) return conflict('This page is part of the site structure and cannot be deleted.');

    // parentId carries no foreign key, so orphans have to be cut loose by hand
    // or they keep pointing at a page that no longer exists.
    const orphaned = await db
      .update(pages)
      .set({ parentId: null, updatedAt: new Date() })
      .where(eq(pages.parentId, id))
      .returning({ id: pages.id });

    /* Deleting is a two-step: the first DELETE moves a page to the trash, and
       only an explicit ?permanent=true erases it. `status` goes to `archived`
       alongside `deletedAt` so that every public query's existing
       `status = 'published'` filter already excludes it — a missed `deletedAt`
       filter cannot put trashed content back on the site. */
    const permanent = new URL(request.url).searchParams.get('permanent') === 'true';

    if (!permanent && row.deletedAt === null) {
      await db
        .update(pages)
        .set({ deletedAt: new Date(), status: 'archived', updatedAt: new Date() })
        .where(eq(pages.id, id));
    } else {
      await db.delete(pages).where(eq(pages.id, id));
      // History goes with the content it describes.
      await deleteRevisionsFor('page', [id]);
    }

    revalidateContent([row.path]);
    // A service page is part of the catalogue, which the services index, the
    // contact form's checkboxes, llms.txt and the default footer menu all read.
    // That is global state, so the whole tree goes stale, not one path.
    if (row.template === 'service') revalidateEverything();

    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: permanent || row.deletedAt !== null ? 'page.delete' : 'page.trash',
      targetType: 'page',
      targetId: row.id,
      summary: `${permanent || row.deletedAt !== null ? 'Deleted' : 'Moved to trash'} page "${row.title}" (${row.path})${
        orphaned.length > 0 ? ` and detached ${orphaned.length} child page(s)` : ''
      }`,
      metadata: { path: row.path, slug: row.slug, status: row.status, childrenDetached: orphaned.length },
      ip: clientIp(request.headers),
    });

    return ok({ id: row.id, deleted: true });
  });
}
