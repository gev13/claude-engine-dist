import { and, eq, inArray, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { badRequest, handle, ok, readJson } from '@/server/api/respond';
import { requireUser } from '@/server/api/guard';
import { audit } from '@/server/auth/audit';
import { clientIp } from '@/server/auth/rateLimit';
import { localeConfig } from '@/lib/locales';
import {
  PERMALINKS_SETTING_KEY,
  categoryPath,
  permalinkCollisions,
  permalinksSchema,
  postPath,
  projectPath,
  projectTermPath,
  type Permalinks,
} from '@/lib/permalinks';
import { collapseChains, type MatchType, type RedirectRule } from '@/lib/redirectRules';
import { revalidateEverything } from '@/server/content/revalidate';
import { db } from '@/server/db';
import { categories, pages, posts, postCategories, projectTerms, projects, redirects, settings } from '@/server/db/schema';
import { getPermalinks, invalidateRouting } from '@/server/routing/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* ═══════════════════════════════════════════════════════════════════════════
   Settings → Permalinks
   ───────────────────────────────────────────────────────────────────────────
   Admin only (`settings:*`): changing where the blog lives changes every
   address it has, which is the kind of reach Settings has and a manager's
   day-to-day screens do not.

   A save is refused while it would collide with something the site already
   has — a page at a category archive's address, a category named like a
   top-level page under the category pattern. And a live site can ask for
   "Create 301s from old URLs", which writes a redirect from every post's and
   category's current address to its new one in the same save, so moving the
   blog does not break a single inbound link.
   ═══════════════════════════════════════════════════════════════════════════ */

async function siteShape() {
  const [pageRows, categoryRows] = await Promise.all([
    db.select({ path: pages.path }).from(pages).where(isNull(pages.deletedAt)),
    db.select({ slug: categories.slug }).from(categories),
  ]);
  return {
    pagePaths: pageRows.map((row) => row.path),
    categorySlugs: [...new Set(categoryRows.map((row) => row.slug))],
    locales: localeConfig().locales,
  };
}

/** Every published post's and category's address under `from` and under `to`. */
async function movedAddresses(from: Permalinks, to: Permalinks): Promise<{ from: string; to: string }[]> {
  const [postRows, categoryRows] = await Promise.all([
    db
      .select({ id: posts.id, slug: posts.slug, primary: posts.primaryCategoryId })
      .from(posts)
      .where(and(eq(posts.status, 'published'), isNull(posts.deletedAt))),
    db.select({ id: categories.id, slug: categories.slug }).from(categories),
  ]);
  const links = await db.select().from(postCategories);
  const slugOf = new Map(categoryRows.map((row) => [row.id, row.slug]));

  const moves: { from: string; to: string }[] = [];
  for (const post of postRows) {
    const categorySlug =
      (post.primary && slugOf.get(post.primary)) ||
      links.filter((link) => link.postId === post.id).map((link) => slugOf.get(link.categoryId)).find(Boolean) ||
      null;
    moves.push({ from: postPath(from, { slug: post.slug, categorySlug }), to: postPath(to, { slug: post.slug, categorySlug }) });
  }
  for (const category of categoryRows) {
    moves.push({ from: categoryPath(from, category.slug), to: categoryPath(to, category.slug) });
  }

  // 2.14 — projects and their archives move with their bases.
  const [projectRows, termRows] = await Promise.all([
    db
      .select({ slug: projects.slug })
      .from(projects)
      .where(and(eq(projects.status, 'published'), isNull(projects.deletedAt))),
    db.select({ taxonomy: projectTerms.taxonomy, slug: projectTerms.slug }).from(projectTerms),
  ]);
  for (const project of projectRows) {
    moves.push({ from: projectPath(from, project.slug), to: projectPath(to, project.slug) });
  }
  for (const term of termRows) {
    const taxonomy = term.taxonomy === 'tag' ? 'tag' : 'category';
    moves.push({ from: projectTermPath(from, taxonomy, term.slug), to: projectTermPath(to, taxonomy, term.slug) });
  }
  return moves.filter((move) => move.from !== move.to);
}

export async function GET(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'settings:write');
    if (!guard.ok) return guard.response;
    return ok({ permalinks: await getPermalinks() });
  });
}

const bodySchema = z.object({
  permalinks: permalinksSchema,
  /** Write a 301 from every post's and category's current address to its new one. */
  createRedirects: z.boolean().default(false),
});

export async function PUT(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'settings:write');
    if (!guard.ok) return guard.response;

    const parsed = await readJson(request, bodySchema);
    if (!parsed.ok) return parsed.response;
    const { permalinks, createRedirects } = parsed.data;

    const problems = permalinkCollisions(permalinks, await siteShape());
    if (problems.length > 0) return badRequest(problems[0]!, { problems });

    const before = await getPermalinks();
    let written = 0;

    await db.transaction(async (tx) => {
      await tx
        .insert(settings)
        .values({ key: PERMALINKS_SETTING_KEY, value: permalinks, updatedById: guard.user.id })
        .onConflictDoUpdate({
          target: settings.key,
          set: { value: permalinks, updatedById: guard.user.id, updatedAt: new Date() },
        });

      if (createRedirects) {
        const moves = await movedAddresses(before, permalinks);
        if (moves.length > 0) {
          /* The new rules join the existing ones before anything is written,
             so a chain through an older redirect collapses into one hop and a
             loop is caught rather than stored. */
          /* A redirect *from* an address that is about to be live again —
             moving the blog back where it was — would only ever loop, so it
             goes first. */
          const live = moves.map((move) => move.to);
          for (let i = 0; i < live.length; i += 500) {
            await tx
              .delete(redirects)
              .where(and(eq(redirects.matchType, 'exact'), eq(redirects.matchQuery, ''), inArray(redirects.fromPath, live.slice(i, i + 500))));
          }
          const existing = await tx.select().from(redirects);
          const incoming: RedirectRule[] = moves.map((move) => ({
            fromPath: move.from,
            toPath: move.to,
            matchType: 'exact',
            matchQuery: '',
            keepRest: false,
            status: 301,
            isActive: true,
          }));
          const taken = new Set(existing.filter((row) => row.matchType === 'exact' && !row.matchQuery).map((row) => row.fromPath));
          const fresh = incoming.filter((rule) => !taken.has(rule.fromPath));
          const { rules } = collapseChains([
            ...existing.map((row) => ({
              ...row,
              matchType: row.matchType as MatchType,
              status: (row.status === 302 ? 302 : 301) as 301 | 302,
            })),
            ...fresh,
          ]);
          // An older redirect that pointed at a post's old address now points straight at its new one.
          for (const [index, row] of existing.entries()) {
            const settledRule = rules[index]!;
            if (settledRule.toPath !== row.toPath) {
              await tx.update(redirects).set({ toPath: settledRule.toPath, updatedAt: new Date() }).where(eq(redirects.id, row.id));
            }
          }
          const settled = rules.slice(existing.length);
          if (settled.length > 0) {
            await tx.insert(redirects).values(
              settled.map((rule) => ({
                fromPath: rule.fromPath,
                toPath: rule.toPath,
                status: 301,
                note: 'Permalinks changed',
                createdById: guard.user.id,
              })),
            );
            written = settled.length;
          }
        }
      }
    });

    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: 'permalinks.update',
      targetType: 'settings',
      targetId: PERMALINKS_SETTING_KEY,
      summary: createRedirects
        ? `Changed the permalinks and wrote ${written} redirect${written === 1 ? '' : 's'} from the old addresses`
        : 'Changed the permalinks',
      metadata: { before, after: permalinks, redirects: written },
      ip: clientIp(request.headers),
    });

    // Every link the engine writes to a post or a category just changed.
    invalidateRouting();
    revalidateEverything();
    return ok({ permalinks, redirectsCreated: written });
  });
}

/** Dry run: how many addresses would move, and what collides — for the screen, before anyone saves. */
export async function POST(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'settings:write');
    if (!guard.ok) return guard.response;

    const parsed = await readJson(request, z.object({ permalinks: permalinksSchema }));
    if (!parsed.ok) return parsed.response;
    const moves = await movedAddresses(await getPermalinks(), parsed.data.permalinks);
    return ok({
      problems: permalinkCollisions(parsed.data.permalinks, await siteShape()),
      moved: moves.length,
      sample: moves.slice(0, 5),
    });
  });
}
