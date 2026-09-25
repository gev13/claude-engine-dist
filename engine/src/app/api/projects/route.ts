import { z } from 'zod';
import { localeConfig } from '@/lib/locales';
import { PROJECT_ORDERS, projectItem } from '@/lib/projects';
import { clientIp } from '@/server/auth/rateLimit';
import { listProjectCards } from '@/server/content/projects';
import { getPermalinks } from '@/server/routing/config';
import { refuseIfBlocked } from '@/server/security/guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* ═══════════════════════════════════════════════════════════════════════════
   The next lot of projects, for a projects block's "Load more" (2.14)
   ───────────────────────────────────────────────────────────────────────────
   Public and read-only: it returns published projects and nothing a project
   page does not already show. The filters are the block's own, spelled out
   in the query, and every one of them is parsed to a strict shape here — a
   slug grammar, a known order, a capped limit — so the endpoint cannot be
   used to ask the database anything the block could not.
   ═══════════════════════════════════════════════════════════════════════════ */

const slug = z.string().regex(/^[a-z0-9](?:[a-z0-9-]{0,198}[a-z0-9])?$/i);

const querySchema = z.object({
  category: z.array(slug).max(20).default([]),
  tag: z.array(slug).max(20).default([]),
  featured: z.literal('1').optional(),
  exclude: z.string().uuid().optional(),
  order: z.enum(PROJECT_ORDERS).default('manual'),
  locale: z.string().regex(/^[a-z]{2,3}(-[a-z]{2,4})?$/).optional(),
  limit: z.coerce.number().int().min(1).max(24).default(12),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export async function GET(request: Request) {
  const blocked = await refuseIfBlocked(clientIp(request.headers));
  if (blocked) return blocked;

  const params = new URL(request.url).searchParams;
  const parsed = querySchema.safeParse({
    category: params.getAll('category'),
    tag: params.getAll('tag'),
    featured: params.get('featured') ?? undefined,
    exclude: params.get('exclude') ?? undefined,
    order: params.get('order') ?? undefined,
    locale: params.get('locale') ?? undefined,
    limit: params.get('limit') ?? undefined,
    offset: params.get('offset') ?? undefined,
  });
  if (!parsed.success) return Response.json({ error: 'That is not a list this site has.' }, { status: 400 });
  const q = parsed.data;
  const locale = q.locale && localeConfig().locales.includes(q.locale) ? q.locale : undefined;

  const cards = await listProjectCards(
    {
      categories: q.category,
      tags: q.tag,
      featuredOnly: q.featured === '1',
      excludeId: q.exclude,
      order: q.order,
      limit: q.limit,
      offset: q.offset,
      locale,
    },
    await getPermalinks(),
  );

  return Response.json(
    { items: cards.map(projectItem) },
    // A CDN may keep it as long as it keeps the pages the cards came from.
    { headers: { 'cache-control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=60' } },
  );
}
