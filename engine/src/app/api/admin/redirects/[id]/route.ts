import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { badRequest, handle, noContent, notFound, ok, readJson } from '@/server/api/respond';
import { requireUser } from '@/server/api/guard';
import { audit } from '@/server/auth/audit';
import { clientIp } from '@/server/auth/rateLimit';
import { isSafeTarget, normalisePath } from '@/server/content/redirects';
import { collapseChains, describeFrom, type MatchType } from '@/lib/redirectRules';
import { revalidateContent, revalidateEverything } from '@/server/content/revalidate';
import { invalidateRouting } from '@/server/routing/config';
import { db } from '@/server/db';
import { redirects } from '@/server/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

const schema = z.object({
  toPath: z.string().min(1).max(500).refine(isSafeTarget, 'Use a site path or a full http(s) URL.').optional(),
  status: z.union([z.literal(301), z.literal(302)]).optional(),
  isActive: z.boolean().optional(),
  note: z.string().max(300).optional(),
  keepRest: z.boolean().optional(),
});

/** What a rule's path change needs revalidated: its own 404, or — for a prefix or pattern — everything. */
function revalidateRule(row: { fromPath: string; matchType: string; matchQuery: string }) {
  if (row.matchQuery) return;
  if (row.matchType === 'exact') revalidateContent([row.fromPath]);
  else revalidateEverything();
}

export async function PATCH(request: Request, context: Context) {
  return handle(async () => {
    const guard = await requireUser(request, 'redirects:write');
    if (!guard.ok) return guard.response;

    const { id } = await context.params;
    const [row] = await db.select().from(redirects).where(eq(redirects.id, id)).limit(1);
    if (!row) return notFound('That redirect does not exist.');

    const parsed = await readJson(request, schema);
    if (!parsed.ok) return parsed.response;

    if (
      parsed.data.toPath &&
      row.matchType === 'exact' &&
      !row.matchQuery &&
      normalisePath(parsed.data.toPath) === row.fromPath
    ) {
      return badRequest('A redirect cannot point at the path it comes from.');
    }

    /* A new target can close a loop through other rules; a chain it starts is
       settled into one hop, the same as on create. */
    const next = { ...row, ...parsed.data, keepRest: row.matchType === 'prefix' ? (parsed.data.keepRest ?? row.keepRest) : false };
    const others = (await db.select().from(redirects)).filter((other) => other.id !== id);
    const shaped = (r: typeof row) => ({ ...r, matchType: r.matchType as MatchType, status: (r.status === 302 ? 302 : 301) as 301 | 302 });
    const { rules, loops } = collapseChains([...others.map(shaped), shaped(next)]);
    const mine = loops.find((line) => line.split(' → ').includes(row.fromPath));
    if (mine) return badRequest(`That makes a loop: ${mine}`);
    const settledTo = rules[rules.length - 1]!.toPath;

    const [updated] = await db
      .update(redirects)
      .set({ ...parsed.data, keepRest: next.keepRest, toPath: settledTo, updatedAt: new Date() })
      .where(eq(redirects.id, id))
      .returning();

    // Enabling, disabling or repointing changes what that path does.
    invalidateRouting();
    revalidateRule(row);

    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: 'redirect.update',
      targetType: 'redirect',
      targetId: id,
      summary: `Updated the redirect from ${describeFrom({ ...row, matchType: row.matchType as MatchType })}`,
      ip: clientIp(request.headers),
    });

    return ok(updated);
  });
}

export async function DELETE(request: Request, context: Context) {
  return handle(async () => {
    const guard = await requireUser(request, 'redirects:write');
    if (!guard.ok) return guard.response;

    const { id } = await context.params;
    const [row] = await db.select().from(redirects).where(eq(redirects.id, id)).limit(1);
    if (!row) return notFound('That redirect does not exist.');

    await db.delete(redirects).where(eq(redirects.id, id));
    invalidateRouting();
    revalidateRule(row);

    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: 'redirect.delete',
      targetType: 'redirect',
      targetId: id,
      summary: `Deleted the redirect from ${describeFrom({ ...row, matchType: row.matchType as MatchType })} to ${row.toPath}`,
      ip: clientIp(request.headers),
    });

    return noContent();
  });
}
