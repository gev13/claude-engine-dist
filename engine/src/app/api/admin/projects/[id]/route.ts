import { eq, sql } from 'drizzle-orm';
import { toSlug } from '@/lib/slug';
import { type AnyBlock } from '@/lib/blocks';
import { conflict, forbidden, handle, noContent, notFound, ok, readJson } from '@/server/api/respond';
import { requireUser } from '@/server/api/guard';
import { audit } from '@/server/auth/audit';
import { clientIp } from '@/server/auth/rateLimit';
import { can, ownsOrAdmin } from '@/server/auth/rbac';
import { projectPathById } from '@/server/content/projects';
import { cleanIntro, linkTerms, projectFields, termIdsOf, validateProjectBlocks } from '@/server/content/projectWrites';
import { revalidateEverything } from '@/server/content/revalidate';
import { captureRevision, deleteRevisionsFor } from '@/server/content/revisions';
import { getPermalinks } from '@/server/routing/config';
import { db } from '@/server/db';
import { projects, type SeoFields } from '@/server/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

const updateSchema = projectFields.partial();

async function load(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  return row ?? null;
}

export async function GET(request: Request, ctx: Ctx) {
  return handle(async () => {
    const guard = await requireUser(request, 'projects:read');
    if (!guard.ok) return guard.response;
    const row = await load((await ctx.params).id);
    if (!row) return notFound('That project no longer exists.');
    return ok({ ...row, ...(await termIdsOf(row.id)), publicPath: await projectPathById(await getPermalinks(), row.id) });
  });
}

export async function PATCH(request: Request, ctx: Ctx) {
  return handle(async () => {
    const guard = await requireUser(request, 'projects:write');
    if (!guard.ok) return guard.response;
    const row = await load((await ctx.params).id);
    if (!row) return notFound('That project no longer exists.');
    if (!ownsOrAdmin(guard.user, row.authorId)) return forbidden('You can only edit your own projects.');

    const parsed = await readJson(request, updateSchema);
    if (!parsed.ok) return parsed.response;
    const input = parsed.data;
    const nextStatus = input.status ?? row.status;
    if (nextStatus !== row.status && (nextStatus === 'published' || row.status === 'published') && !can(guard.user, 'projects:publish')) {
      return forbidden('You can write projects; an editor publishes and unpublishes them.');
    }

    const validated = validateProjectBlocks((input.blocks ?? []) as AnyBlock[]);
    if (!validated.ok) return validated.response;

    if (input.slug) {
      const slug = toSlug(input.slug, row.slug);
      const [clash] = await db
        .select({ id: projects.id })
        .from(projects)
        .where(sql`${projects.slug} = ${slug} and ${projects.locale} = ${row.locale} and ${projects.id} <> ${row.id}`)
        .limit(1);
      if (clash) return conflict('A project with that slug already exists.');
      input.slug = slug;
    }

    // Publishing for the first time stamps the date; unpublishing keeps it, so the order holds.
    const publishedAt =
      input.publishedAt !== undefined
        ? input.publishedAt
          ? new Date(input.publishedAt)
          : null
        : nextStatus === 'published' && !row.publishedAt
          ? new Date()
          : row.publishedAt;

    const [updated] = await db
      .update(projects)
      .set({
        ...(input.slug !== undefined ? { slug: input.slug } : {}),
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.summary !== undefined ? { summary: input.summary } : {}),
        ...(input.excerpt !== undefined ? { excerpt: input.excerpt } : {}),
        ...(input.intro !== undefined ? { intro: cleanIntro(input.intro) } : {}),
        ...(input.coverMediaId !== undefined ? { coverMediaId: input.coverMediaId } : {}),
        ...(input.hoverMediaId !== undefined ? { hoverMediaId: input.hoverMediaId } : {}),
        ...(input.heroMediaId !== undefined ? { heroMediaId: input.heroMediaId } : {}),
        ...(input.client !== undefined ? { client: input.client } : {}),
        ...(input.year !== undefined ? { year: input.year } : {}),
        ...(input.url !== undefined ? { url: input.url } : {}),
        ...(input.blocks !== undefined ? { blocks: validated.blocks } : {}),
        ...(input.seo !== undefined ? { seo: input.seo as SeoFields } : {}),
        ...(input.customCss !== undefined ? { customCss: input.customCss } : {}),
        ...(input.options !== undefined ? { options: input.options } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        ...(input.featured !== undefined ? { featured: input.featured } : {}),
        publishedAt,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, row.id))
      .returning();

    await linkTerms(row.id, input);

    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: row.status === nextStatus ? 'project.update' : `project.status.${nextStatus}`,
      targetType: 'project',
      targetId: row.id,
      summary: `Updated project "${updated?.title ?? row.title}"`,
      metadata: { from: row.status, to: nextStatus },
      ip: clientIp(request.headers),
    });
    if (updated) {
      await captureRevision({
        entityType: 'project',
        entityId: updated.id,
        row: updated as unknown as Record<string, unknown>,
        actorId: guard.user.id,
        actorEmail: guard.user.email,
      });
    }

    // Whatever lists it — on any page — has to see the change, or its going.
    if (row.status === 'published' || nextStatus === 'published') revalidateEverything();
    return ok({ ...updated, ...(await termIdsOf(row.id)), publicPath: await projectPathById(await getPermalinks(), row.id) });
  });
}

export async function DELETE(request: Request, ctx: Ctx) {
  return handle(async () => {
    const guard = await requireUser(request, 'projects:delete');
    if (!guard.ok) return guard.response;
    const row = await load((await ctx.params).id);
    if (!row) return notFound('That project no longer exists.');
    if (!ownsOrAdmin(guard.user, row.authorId)) return forbidden('You can only delete your own projects.');

    /* First DELETE trashes, `?permanent=true` erases — status moves to
       `archived` with it, so a missed filter cannot leak a trashed project. */
    const permanent = new URL(request.url).searchParams.get('permanent') === 'true';
    if (!permanent && row.deletedAt === null) {
      await db.update(projects).set({ deletedAt: new Date(), status: 'archived', updatedAt: new Date() }).where(eq(projects.id, row.id));
    } else {
      await db.delete(projects).where(eq(projects.id, row.id));
      await deleteRevisionsFor('project', [row.id]);
    }

    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: permanent || row.deletedAt !== null ? 'project.delete' : 'project.trash',
      targetType: 'project',
      targetId: row.id,
      summary: `Deleted project "${row.title}"`,
      metadata: { slug: row.slug, status: row.status },
      ip: clientIp(request.headers),
    });

    if (row.status === 'published') revalidateEverything();
    return noContent();
  });
}
