import { z } from 'zod';
import { and, asc, desc, eq, ilike, isNotNull, isNull, or, sql, type SQL } from 'drizzle-orm';
import { localeConfig } from '@/lib/locales';
import { toSlug, uniqueSlug } from '@/lib/slug';
import { readListParams, seoSchema, statusEnum } from '@/server/api/schemas';
import { badRequest, conflict, created, forbidden, handle, ok, readJson } from '@/server/api/respond';
import { requireUser } from '@/server/api/guard';
import { audit } from '@/server/auth/audit';
import { can } from '@/server/auth/rbac';
import { clientIp } from '@/server/auth/rateLimit';
import { revalidateContent } from '@/server/content/revalidate';
import { CAREERS_PATH, jobPath } from '@/lib/careers';
import { sanitizeRichText } from '@/server/content/sanitize';
import { db } from '@/server/db';
import { applications, jobs, users, type SeoFields } from '@/server/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* ═══════════════════════════════════════════════════════════════════════════
   Job adverts
   ───────────────────────────────────────────────────────────────────────────
   A job is content and follows the content rules: drafts, scheduled
   publishing, a two-step delete, and an author who may write one without
   being able to put it on the careers page.

   It is not a page, so it has no block tree. The three body sections are rich
   text sanitised on write, and the meta grid is six short strings — a careers
   page reads the same six labels on every advert, which is the whole reason
   they are columns rather than a free-form block list.
   ═══════════════════════════════════════════════════════════════════════════ */

/** The three rich-text sections. Sanitised on write; `<Prose>` trusts them on read. */
const richText = z.string().max(120_000);

const jobFields = {
  slug: z.string().min(1).max(180).optional(),
  title: z.string().min(1).max(300),
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
  locale: z.string().min(2).max(5).optional(),
  translationGroupId: z.string().uuid().optional(),

  postedAt: z.string().datetime().nullable().optional(),
  deadline: z.string().datetime().nullable().optional(),
  isOpen: z.boolean().optional(),
  status: statusEnum.optional(),
  sortOrder: z.number().int().min(-9999).max(9999).optional(),
};

const createSchema = z.object(jobFields);

/** GET /api/admin/jobs — paginated, searchable, with the application count. */
export async function GET(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'jobs:read');
    if (!guard.ok) return guard.response;

    const url = new URL(request.url);
    const { page, perPage, offset, q, status } = readListParams(url);
    const locale = url.searchParams.get('locale') ?? '';
    const openness = url.searchParams.get('open') ?? '';

    const filters: SQL[] = [];
    if (q) filters.push(or(ilike(jobs.title, `%${q}%`), ilike(jobs.slug, `%${q}%`))!);
    if (status === 'draft' || status === 'published' || status === 'archived') {
      filters.push(eq(jobs.status, status));
    }
    if (locale) filters.push(eq(jobs.locale, locale));
    if (openness === 'open' || openness === 'closed') filters.push(eq(jobs.isOpen, openness === 'open'));

    const trashed = url.searchParams.get('trashed') === '1';
    filters.push(trashed ? isNotNull(jobs.deletedAt) : isNull(jobs.deletedAt));

    const where = filters.length ? and(...filters) : undefined;

    const [items, [count]] = await Promise.all([
      db
        .select({
          id: jobs.id,
          slug: jobs.slug,
          locale: jobs.locale,
          title: jobs.title,
          department: jobs.department,
          location: jobs.location,
          contractType: jobs.contractType,
          status: jobs.status,
          isOpen: jobs.isOpen,
          deletedAt: jobs.deletedAt,
          postedAt: jobs.postedAt,
          deadline: jobs.deadline,
          publishedAt: jobs.publishedAt,
          updatedAt: jobs.updatedAt,
          authorId: jobs.authorId,
          authorFirst: users.firstName,
          authorLast: users.lastName,
          /* The count is the reason anybody opens this screen, so it is joined
             here rather than left to a request per row. */
          applicationCount: sql<number>`(select count(*)::int from ${applications} where ${applications.jobId} = ${jobs.id})`,
        })
        .from(jobs)
        .leftJoin(users, eq(users.id, jobs.authorId))
        .where(where)
        .orderBy(desc(jobs.isOpen), asc(jobs.sortOrder), desc(jobs.updatedAt))
        .limit(perPage)
        .offset(offset),
      db.select({ n: sql<number>`count(*)::int` }).from(jobs).where(where),
    ]);

    return ok({ items, total: count?.n ?? 0, page, perPage });
  });
}

/** POST /api/admin/jobs — create. */
export async function POST(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'jobs:write');
    if (!guard.ok) return guard.response;

    const parsed = await readJson(request, createSchema);
    if (!parsed.ok) return parsed.response;
    const input = parsed.data;

    const status = input.status ?? 'draft';
    if (status === 'published' && !can(guard.user, 'jobs:publish')) {
      return forbidden('You can write a role, but not publish it.');
    }

    const config = localeConfig();
    const locale = input.locale && config.locales.includes(input.locale) ? input.locale : config.defaultLocale;

    /* Uniqueness is (locale, slug), so a translation may keep the original's
       slug — and a clash is only a clash within one language. */
    const taken = (
      await db.select({ slug: jobs.slug }).from(jobs).where(eq(jobs.locale, locale))
    ).map((r) => r.slug);
    const base = toSlug(input.slug ?? input.title, 'role');
    const slug = input.slug ? base : uniqueSlug(base, taken);

    if (input.slug && taken.includes(slug)) {
      return conflict('A role with that slug already exists in this language.');
    }

    /* "Posted" is what the advert shows and what the listing sorts by, so it
       defaults to the moment it goes live rather than to the moment somebody
       started drafting it. */
    const publishedAt =
      input.postedAt !== undefined && input.postedAt !== null
        ? new Date(input.postedAt)
        : status === 'published'
          ? new Date()
          : null;

    const [row] = await db
      .insert(jobs)
      .values({
        slug,
        locale,
        ...(input.translationGroupId ? { translationGroupId: input.translationGroupId } : {}),
        title: input.title,
        excerpt: input.excerpt ?? '',
        location: input.location ?? '',
        contractType: input.contractType ?? '',
        workingTime: input.workingTime ?? '',
        seniority: input.seniority ?? '',
        workweek: input.workweek ?? '',
        department: input.department ?? '',
        description: sanitizeRichText(input.description ?? ''),
        responsibilities: sanitizeRichText(input.responsibilities ?? ''),
        benefits: sanitizeRichText(input.benefits ?? ''),
        coverMediaId: input.coverMediaId ?? null,
        seo: (input.seo ?? {}) as SeoFields,
        postedAt: input.postedAt ? new Date(input.postedAt) : publishedAt,
        deadline: input.deadline ? new Date(input.deadline) : null,
        isOpen: input.isOpen ?? true,
        status,
        sortOrder: input.sortOrder ?? 0,
        publishedAt,
        authorId: guard.user.id,
      })
      .returning();

    if (!row) return badRequest('Could not create the role.');

    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: 'job.create',
      targetType: 'job',
      targetId: row.id,
      summary: `Created role "${row.title}" (${row.status})`,
      ip: clientIp(request.headers),
    });

    if (row.status === 'published') {
      revalidateContent([jobPath(row.slug, row.locale), CAREERS_PATH]);
    }

    return created(row);
  });
}
