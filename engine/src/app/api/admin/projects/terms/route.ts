import { and, asc, eq, sql } from 'drizzle-orm';
import { toSlug } from '@/lib/slug';
import { localeConfig } from '@/lib/locales';
import { conflict, created, handle, ok, readJson } from '@/server/api/respond';
import { requireUser } from '@/server/api/guard';
import { termSchema } from '@/server/content/projectWrites';
import { audit } from '@/server/auth/audit';
import { clientIp } from '@/server/auth/rateLimit';
import { db } from '@/server/db';
import { projectTermLinks, projectTerms, type SeoFields } from '@/server/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';


/** Every project category and tag, with how many projects use each. */
export async function GET(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'projects:read');
    if (!guard.ok) return guard.response;
    const items = await db
      .select({
        id: projectTerms.id,
        taxonomy: projectTerms.taxonomy,
        slug: projectTerms.slug,
        name: projectTerms.name,
        description: projectTerms.description,
        seo: projectTerms.seo,
        sortOrder: projectTerms.sortOrder,
        locale: projectTerms.locale,
        count: sql<number>`(select count(*)::int from ${projectTermLinks} where ${projectTermLinks.termId} = ${projectTerms.id})`,
      })
      .from(projectTerms)
      .orderBy(asc(projectTerms.taxonomy), asc(projectTerms.sortOrder), asc(projectTerms.name));
    return ok({ items });
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'projectTerms:write');
    if (!guard.ok) return guard.response;
    const parsed = await readJson(request, termSchema);
    if (!parsed.ok) return parsed.response;
    const input = parsed.data;
    const locale = localeConfig().defaultLocale;
    const slug = toSlug(input.slug || input.name, input.taxonomy);

    const [clash] = await db
      .select({ id: projectTerms.id })
      .from(projectTerms)
      .where(and(eq(projectTerms.taxonomy, input.taxonomy), eq(projectTerms.slug, slug), eq(projectTerms.locale, locale)))
      .limit(1);
    if (clash) return conflict(`There is already a ${input.taxonomy} with the slug “${slug}”.`);

    const [row] = await db
      .insert(projectTerms)
      .values({ ...input, slug, locale, seo: (input.seo ?? {}) as SeoFields })
      .returning();

    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: 'projectTerm.create',
      targetType: 'projectTerm',
      targetId: row?.id,
      summary: `Created the project ${input.taxonomy} "${input.name}"`,
      ip: clientIp(request.headers),
    });
    return created(row);
  });
}
