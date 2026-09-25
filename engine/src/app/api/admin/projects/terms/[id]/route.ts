import { and, eq, sql } from 'drizzle-orm';
import { toSlug } from '@/lib/slug';
import { conflict, handle, noContent, notFound, ok, readJson } from '@/server/api/respond';
import { requireUser } from '@/server/api/guard';
import { audit } from '@/server/auth/audit';
import { clientIp } from '@/server/auth/rateLimit';
import { revalidateEverything } from '@/server/content/revalidate';
import { db } from '@/server/db';
import { projectTerms, type SeoFields } from '@/server/db/schema';
import { termSchema } from '@/server/content/projectWrites';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

const updateSchema = termSchema.omit({ taxonomy: true }).partial();

async function load(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await db.select().from(projectTerms).where(eq(projectTerms.id, id)).limit(1);
  return row ?? null;
}

export async function PATCH(request: Request, ctx: Ctx) {
  return handle(async () => {
    const guard = await requireUser(request, 'projectTerms:write');
    if (!guard.ok) return guard.response;
    const row = await load((await ctx.params).id);
    if (!row) return notFound('That term no longer exists.');
    const parsed = await readJson(request, updateSchema);
    if (!parsed.ok) return parsed.response;
    const input = parsed.data;

    const slug = input.slug !== undefined ? toSlug(input.slug || input.name || row.name, row.taxonomy) : row.slug;
    if (slug !== row.slug) {
      const [clash] = await db
        .select({ id: projectTerms.id })
        .from(projectTerms)
        .where(and(eq(projectTerms.taxonomy, row.taxonomy), eq(projectTerms.slug, slug), eq(projectTerms.locale, row.locale), sql`${projectTerms.id} <> ${row.id}`))
        .limit(1);
      if (clash) return conflict(`There is already a ${row.taxonomy} with the slug “${slug}”.`);
    }

    const [updated] = await db
      .update(projectTerms)
      .set({ ...input, slug, ...(input.seo ? { seo: input.seo as SeoFields } : {}), updatedAt: new Date() })
      .where(eq(projectTerms.id, row.id))
      .returning();

    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: 'projectTerm.update',
      targetType: 'projectTerm',
      targetId: row.id,
      summary: `Updated the project ${row.taxonomy} "${updated?.name ?? row.name}"`,
      ip: clientIp(request.headers),
    });
    // Its name is on every card filed under it, and its slug is in their chips' links.
    revalidateEverything();
    return ok(updated);
  });
}

export async function DELETE(request: Request, ctx: Ctx) {
  return handle(async () => {
    const guard = await requireUser(request, 'projectTerms:write');
    if (!guard.ok) return guard.response;
    const row = await load((await ctx.params).id);
    if (!row) return notFound('That term no longer exists.');
    // The links cascade; the projects stay, filed under whatever else they had.
    await db.delete(projectTerms).where(eq(projectTerms.id, row.id));
    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: 'projectTerm.delete',
      targetType: 'projectTerm',
      targetId: row.id,
      summary: `Deleted the project ${row.taxonomy} "${row.name}"`,
      metadata: { slug: row.slug },
      ip: clientIp(request.headers),
    });
    revalidateEverything();
    return noContent();
  });
}
