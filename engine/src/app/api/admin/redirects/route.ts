import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { badRequest, created, handle, ok, readJson } from '@/server/api/respond';
import { requireUser } from '@/server/api/guard';
import { audit } from '@/server/auth/audit';
import { clientIp } from '@/server/auth/rateLimit';
import { can } from '@/server/auth/rbac';
import { MATCH_TYPES, describeFrom, parseFrom } from '@/lib/redirectRules';
import { listNotFound, listRedirects, resolveNotFound } from '@/server/content/redirects';
import { planWrites } from '@/server/content/redirectPlan';
import { revalidateContent, revalidateEverything } from '@/server/content/revalidate';
import { invalidateRouting } from '@/server/routing/config';
import { db } from '@/server/db';
import { redirects } from '@/server/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * One rule. `fromPath` takes the same notation the list shows and the CSV
 * uses — `/old`, `/old/*`, `/?s=*`, or a pattern starting with `^` — and
 * `matchType` can say so explicitly.
 */
const schema = z.object({
  fromPath: z.string().min(1).max(400),
  toPath: z.string().min(1).max(500),
  status: z.union([z.literal(301), z.literal(302)]).default(301),
  isActive: z.boolean().default(true),
  note: z.string().max(300).default(''),
  matchType: z.enum(MATCH_TYPES).optional(),
  keepRest: z.boolean().default(false),
});

export async function GET(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'redirects:read');
    if (!guard.ok) return guard.response;

    const url = new URL(request.url);
    return ok({
      items: await listRedirects(),
      notFound: await listNotFound(url.searchParams.get('includeResolved') === '1'),
      canRegex: can(guard.user, 'redirects:regex'),
    });
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'redirects:write');
    if (!guard.ok) return guard.response;

    const parsed = await readJson(request, schema);
    if (!parsed.ok) return parsed.response;
    const input = parsed.data;

    const existing = await db.select().from(redirects);
    const plan = planWrites(
      [{ line: 1, from: input.fromPath, to: input.toPath, status: input.status, note: input.note, matchType: input.matchType ?? parseFrom(input.fromPath).matchType }],
      existing,
      { allowRegex: can(guard.user, 'redirects:regex'), onDuplicate: 'skip' },
    );
    const verdict = plan.rows[0]!;
    if (verdict.action === 'error') return badRequest(verdict.reason);
    if (verdict.action === 'skip' || !('rule' in verdict)) return badRequest(`There is already a redirect from ${input.fromPath}.`);

    const rule = { ...verdict.rule, keepRest: verdict.rule.matchType === 'prefix' && (input.keepRest || verdict.rule.keepRest) };
    const [row] = await db.transaction(async (tx) => {
      for (const moved of plan.retargeted) {
        await tx.update(redirects).set({ toPath: moved.toPath, updatedAt: new Date() }).where(eq(redirects.id, moved.id));
      }
      return tx
        .insert(redirects)
        .values({
          fromPath: rule.fromPath,
          matchType: rule.matchType,
          matchQuery: rule.matchQuery,
          keepRest: rule.keepRest,
          toPath: rule.toPath,
          status: rule.status,
          isActive: input.isActive,
          note: input.note,
          createdById: guard.user.id,
        })
        .returning();
    });

    // Creating a redirect answers the 404 that prompted it.
    if (rule.matchType === 'exact') await resolveNotFound(rule.fromPath);

    /* The 404 this replaces was rendered and cached by ISR, so without this the
       redirect would not fire until that entry expired. */
    invalidateRouting();
    // A prefix or a pattern answers paths whose cached 404s nobody can list.
    if (rule.matchType === 'exact') revalidateContent([rule.fromPath]);
    else if (!rule.matchQuery) revalidateEverything();

    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: 'redirect.create',
      targetType: 'redirect',
      targetId: row?.id,
      summary: `Created a ${rule.status} redirect from ${describeFrom(rule)} to ${rule.toPath}`,
      metadata: plan.retargeted.length ? { collapsedChains: plan.retargeted.length } : undefined,
      ip: clientIp(request.headers),
    });

    return created(row);
  });
}

