import { and, desc, eq, ilike, inArray, isNotNull, isNull, or, sql, type SQL } from 'drizzle-orm';
import { toSlug, uniqueSlug } from '@/lib/slug';
import { readListParams } from '@/server/api/schemas';
import { badRequest, conflict, created, forbidden, handle, ok, readJson } from '@/server/api/respond';
import { requireUser } from '@/server/api/guard';
import { audit } from '@/server/auth/audit';
import { clientIp } from '@/server/auth/rateLimit';
import { can } from '@/server/auth/rbac';
import { type AnyBlock } from '@/lib/blocks';
import { projectPathById } from '@/server/content/projects';
import { cleanIntro, linkTerms, projectFields, validateProjectBlocks } from '@/server/content/projectWrites';
import { revalidateEverything } from '@/server/content/revalidate';
import { captureRevision } from '@/server/content/revisions';
import { getPermalinks } from '@/server/routing/config';
import { db } from '@/server/db';
import { media, projectTermLinks, projects, users, type SeoFields } from '@/server/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/admin/projects — search, status, trash, and a category or tag filter. */
export async function GET(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'projects:read');
    if (!guard.ok) return guard.response;

    const url = new URL(request.url);
    const { page, perPage, offset, q, status } = readListParams(url);
    const filters: SQL[] = [];
    if (q) filters.push(or(ilike(projects.title, `%${q}%`), ilike(projects.slug, `%${q}%`), ilike(projects.client, `%${q}%`))!);
    if (status === 'draft' || status === 'published' || status === 'archived') filters.push(eq(projects.status, status));
    const term = url.searchParams.get('term') ?? '';
    if (/^[0-9a-f-]{36}$/i.test(term)) {
      filters.push(
        inArray(projects.id, db.select({ id: projectTermLinks.projectId }).from(projectTermLinks).where(eq(projectTermLinks.termId, term))),
      );
    }
    if (url.searchParams.get('featured') === '1') filters.push(eq(projects.featured, true));
    const trashed = url.searchParams.get('trashed') === '1';
    filters.push(trashed ? isNotNull(projects.deletedAt) : isNull(projects.deletedAt));
    const where = and(...filters);

    const [items, [count]] = await Promise.all([
      db
        .select({
          id: projects.id,
          slug: projects.slug,
          title: projects.title,
          client: projects.client,
          year: projects.year,
          status: projects.status,
          featured: projects.featured,
          sortOrder: projects.sortOrder,
          deletedAt: projects.deletedAt,
          publishedAt: projects.publishedAt,
          updatedAt: projects.updatedAt,
          authorId: projects.authorId,
          coverUrl: media.url,
          authorFirst: users.firstName,
          authorLast: users.lastName,
        })
        .from(projects)
        .leftJoin(media, eq(media.id, projects.coverMediaId))
        .leftJoin(users, eq(users.id, projects.authorId))
        .where(where)
        .orderBy(desc(projects.updatedAt))
        .limit(perPage)
        .offset(offset),
      db.select({ n: sql<number>`count(*)::int` }).from(projects).where(where),
    ]);

    return ok({ items, total: count?.n ?? 0, page, perPage });
  });
}

/** POST /api/admin/projects — create. Publishing needs `projects:publish`, not just `:write`. */
export async function POST(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'projects:write');
    if (!guard.ok) return guard.response;

    const parsed = await readJson(request, projectFields);
    if (!parsed.ok) return parsed.response;
    const input = parsed.data;
    const status = input.status ?? 'draft';
    if (status === 'published' && !can(guard.user, 'projects:publish')) {
      return forbidden('You can write projects; an editor publishes them.');
    }

    const validated = validateProjectBlocks((input.blocks ?? []) as AnyBlock[]);
    if (!validated.ok) return validated.response;

    const taken = (await db.select({ slug: projects.slug }).from(projects)).map((row) => row.slug);
    const base = toSlug(input.slug ?? input.title, 'project');
    const slug = input.slug ? base : uniqueSlug(base, taken);
    if (input.slug && taken.includes(slug)) return conflict('A project with that slug already exists.');

    const publishedAt =
      input.publishedAt !== undefined ? (input.publishedAt ? new Date(input.publishedAt) : null) : status === 'published' ? new Date() : null;

    const [row] = await db
      .insert(projects)
      .values({
        slug,
        title: input.title,
        summary: input.summary ?? '',
        excerpt: input.excerpt ?? '',
        intro: cleanIntro(input.intro) ?? '',
        coverMediaId: input.coverMediaId ?? null,
        hoverMediaId: input.hoverMediaId ?? null,
        heroMediaId: input.heroMediaId ?? null,
        client: input.client ?? '',
        year: input.year ?? '',
        url: input.url ?? '',
        blocks: validated.blocks,
        seo: (input.seo ?? {}) as SeoFields,
        customCss: input.customCss ?? '',
        options: input.options ?? {},
        status,
        publishedAt,
        sortOrder: input.sortOrder ?? 0,
        featured: input.featured ?? false,
        authorId: guard.user.id,
      })
      .returning();
    if (!row) return badRequest('Could not create the project.');

    await linkTerms(row.id, input);

    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: 'project.create',
      targetType: 'project',
      targetId: row.id,
      summary: `Created project "${row.title}" (${row.status})`,
      ip: clientIp(request.headers),
    });
    await captureRevision({
      entityType: 'project',
      entityId: row.id,
      row: row as unknown as Record<string, unknown>,
      reason: 'create',
      actorId: guard.user.id,
      actorEmail: guard.user.email,
    });

    const publicPath = await projectPathById(await getPermalinks(), row.id);
    /* A published project appears in every collection that selects it — the
       home page's highlights, a listing page, a service page's related work —
       and nothing short of the whole site names all of those. */
    if (row.status === 'published') revalidateEverything();
    return created({ ...row, publicPath });
  });
}
