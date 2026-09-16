import { z } from 'zod';
import { and, eq, ne, sql } from 'drizzle-orm';
import { toSlug } from '@/lib/slug';
import { jobPaths } from '@/lib/careers';
import { seoSchema, statusEnum } from '@/server/api/schemas';
import { conflict, forbidden, handle, noContent, notFound, ok, readJson } from '@/server/api/respond';
import { requireUser } from '@/server/api/guard';
import { audit } from '@/server/auth/audit';
import { clientIp } from '@/server/auth/rateLimit';
import { can, ownsOrAdmin } from '@/server/auth/rbac';
import { revalidateContent } from '@/server/content/revalidate';
import { sanitizeRichText } from '@/server/content/sanitize';
import { db } from '@/server/db';
import { applications, jobs, type SeoFields } from '@/server/db/schema';
import { deleteCv } from '@/server/applications/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

const richText = z.string().max(120_000);

const updateSchema = z.object({
  slug: z.string().min(1).max(180).optional(),
  title: z.string().min(1).max(300).optional(),
  excerpt: z.string().max(2000).optional(),

  location: z.string().max(160).optional(),
  contractType: z.string().max(120).optional(),
  workingTime: z.string().max(120).optional(),
  seniority: z.string().max(120).optional(),
  workweek: z.string().max(120).optional(),
  department: z.string().max(160).optional(),

  description: richText.optional(),
  responsibilities: richText.optional(),
  benefits: richText.optional(),

  coverMediaId: z.string().uuid().nullable().optional(),
  seo: seoSchema.optional(),

  postedAt: z.string().datetime().nullable().optional(),
  deadline: z.string().datetime().nullable().optional(),
  isOpen: z.boolean().optional(),
  status: statusEnum.optional(),
  sortOrder: z.number().int().min(-9999).max(9999).optional(),
});

async function load(id: string) {
  const [row] = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
  return row ?? null;
}

/** GET /api/admin/jobs/[id] — the whole row, plus how many people have applied. */
export async function GET(request: Request, ctx: Ctx) {
  return handle(async () => {
    const guard = await requireUser(request, 'jobs:read');
    if (!guard.ok) return guard.response;

    const { id } = await ctx.params;
    const row = await load(id);
    if (!row) return notFound('That role no longer exists.');

    const [count] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(applications)
      .where(eq(applications.jobId, row.id));

    return ok({ ...row, applicationCount: count?.n ?? 0 });
  });
}

/** PUT /api/admin/jobs/[id] — update. */
export async function PUT(request: Request, ctx: Ctx) {
  return handle(async () => {
    const guard = await requireUser(request, 'jobs:write');
    if (!guard.ok) return guard.response;

    const { id } = await ctx.params;
    const row = await load(id);
    if (!row) return notFound('That role no longer exists.');
    if (!ownsOrAdmin(guard.user, row.authorId)) return forbidden('You can only edit your own roles.');

    const parsed = await readJson(request, updateSchema);
    if (!parsed.ok) return parsed.response;
    const input = parsed.data;

    const nextStatus = input.status ?? row.status;
    if (nextStatus === 'published' && row.status !== 'published' && !can(guard.user, 'jobs:publish')) {
      return forbidden('You can write a role, but not publish it.');
    }

    /* Uniqueness is (locale, slug), so the clash check is scoped to this
       advert's own language — a Russian and an English advert may share one. */
    let slug = row.slug;
    if (input.slug && input.slug !== row.slug) {
      slug = toSlug(input.slug, 'role');
      const [clash] = await db
        .select({ id: jobs.id })
        .from(jobs)
        .where(and(eq(jobs.locale, row.locale), eq(jobs.slug, slug), ne(jobs.id, row.id)))
        .limit(1);
      if (clash) return conflict('A role with that slug already exists in this language.');
    }

    /* Publishing for the first time stamps both dates: `publishedAt` is what
       the public query filters on, `postedAt` is what the advert shows. An
       advert that is edited later keeps the date it was first posted. */
    const becomingPublic = nextStatus === 'published' && row.publishedAt === null;
    const publishedAt = becomingPublic ? new Date() : row.publishedAt;

    const [updated] = await db
      .update(jobs)
      .set({
        slug,
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.excerpt !== undefined ? { excerpt: input.excerpt } : {}),
        ...(input.location !== undefined ? { location: input.location } : {}),
        ...(input.contractType !== undefined ? { contractType: input.contractType } : {}),
        ...(input.workingTime !== undefined ? { workingTime: input.workingTime } : {}),
        ...(input.seniority !== undefined ? { seniority: input.seniority } : {}),
        ...(input.workweek !== undefined ? { workweek: input.workweek } : {}),
        ...(input.department !== undefined ? { department: input.department } : {}),
        ...(input.description !== undefined ? { description: sanitizeRichText(input.description) } : {}),
        ...(input.responsibilities !== undefined
          ? { responsibilities: sanitizeRichText(input.responsibilities) }
          : {}),
        ...(input.benefits !== undefined ? { benefits: sanitizeRichText(input.benefits) } : {}),
        ...(input.coverMediaId !== undefined ? { coverMediaId: input.coverMediaId } : {}),
        ...(input.seo !== undefined ? { seo: input.seo as SeoFields } : {}),
        ...(input.postedAt !== undefined
          ? { postedAt: input.postedAt ? new Date(input.postedAt) : null }
          : becomingPublic && row.postedAt === null
            ? { postedAt: publishedAt }
            : {}),
        ...(input.deadline !== undefined ? { deadline: input.deadline ? new Date(input.deadline) : null } : {}),
        ...(input.isOpen !== undefined ? { isOpen: input.isOpen } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        status: nextStatus,
        publishedAt,
        updatedAt: new Date(),
      })
      .where(eq(jobs.id, row.id))
      .returning();

    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: row.status === nextStatus ? 'job.update' : `job.status.${nextStatus}`,
      targetType: 'job',
      targetId: row.id,
      summary: `Updated role "${updated?.title ?? row.title}"`,
      metadata: { from: row.status, to: nextStatus, open: updated?.isOpen ?? row.isOpen },
      ip: clientIp(request.headers),
    });

    // Both slugs, so a renamed advert stops serving at its old URL.
    revalidateContent([
      ...jobPaths(row.slug, row.locale),
      ...jobPaths(updated?.slug ?? row.slug, row.locale),
    ]);

    return ok(updated);
  });
}

/**
 * DELETE /api/admin/jobs/[id] — trash, then erase.
 *
 * Erasing a job cascades to its applications, and every one of those has a CV
 * on disk that the database cannot unlink. So the files are removed here,
 * before the rows go: after the cascade there is nothing left to say which
 * files belonged to this advert, and they would sit in the applications
 * directory for ever.
 */
export async function DELETE(request: Request, ctx: Ctx) {
  return handle(async () => {
    const guard = await requireUser(request, 'jobs:delete');
    if (!guard.ok) return guard.response;

    const { id } = await ctx.params;
    const row = await load(id);
    if (!row) return notFound('That role no longer exists.');
    if (!ownsOrAdmin(guard.user, row.authorId)) return forbidden('You can only delete your own roles.');

    const permanent = new URL(request.url).searchParams.get('permanent') === 'true';

    if (!permanent && row.deletedAt === null) {
      await db
        .update(jobs)
        .set({ deletedAt: new Date(), status: 'archived', isOpen: false, updatedAt: new Date() })
        .where(eq(jobs.id, row.id));
    } else {
      /* Erasing applications is erasing personal data, which is not something
         an advert's author gets to do as a side effect of tidying up. */
      const [pending] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(applications)
        .where(eq(applications.jobId, row.id));

      if ((pending?.n ?? 0) > 0 && !can(guard.user, 'applications:write')) {
        return forbidden(
          `This role holds ${pending!.n} application${pending!.n === 1 ? '' : 's'}. An administrator has to erase those first.`,
        );
      }

      const files = await db
        .select({ cvFilename: applications.cvFilename })
        .from(applications)
        .where(eq(applications.jobId, row.id));
      for (const file of files) {
        if (file.cvFilename) await deleteCv(file.cvFilename);
      }

      await db.delete(jobs).where(eq(jobs.id, row.id));
    }

    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: permanent || row.deletedAt !== null ? 'job.delete' : 'job.trash',
      targetType: 'job',
      targetId: row.id,
      summary: `Deleted role "${row.title}"`,
      metadata: { slug: row.slug, status: row.status },
      ip: clientIp(request.headers),
    });

    revalidateContent(jobPaths(row.slug, row.locale));

    return noContent();
  });
}
