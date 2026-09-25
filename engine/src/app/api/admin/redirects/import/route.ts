import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { badRequest, handle, ok, readJson } from '@/server/api/respond';
import { requireUser } from '@/server/api/guard';
import { audit } from '@/server/auth/audit';
import { clientIp } from '@/server/auth/rateLimit';
import { can } from '@/server/auth/rbac';
import { readRedirectCsv } from '@/lib/redirectRules';
import { planWrites } from '@/server/content/redirectPlan';
import { revalidateEverything } from '@/server/content/revalidate';
import { invalidateRouting } from '@/server/routing/config';
import { db } from '@/server/db';
import { redirects } from '@/server/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* ═══════════════════════════════════════════════════════════════════════════
   Import redirects from a CSV
   ───────────────────────────────────────────────────────────────────────────
   `from,to,status,note` — or Yoast's own export, recognised by its header.
   Always two calls: a dry run that returns the plan row by row (what will be
   created, updated, skipped, and why anything was refused), then the same
   file with `dryRun: false`, which writes that plan in one transaction. So
   nothing is half-imported, and nobody writes 150 rules they have not seen.
   ═══════════════════════════════════════════════════════════════════════════ */

const MAX_ROWS = 5000;

const schema = z.object({
  csv: z.string().min(1).max(2_000_000),
  dryRun: z.boolean().default(true),
  onDuplicate: z.enum(['update', 'skip']).default('update'),
});

export async function POST(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'redirects:write');
    if (!guard.ok) return guard.response;

    const parsed = await readJson(request, schema);
    if (!parsed.ok) return parsed.response;
    const { csv, dryRun, onDuplicate } = parsed.data;

    const { rows, problems } = readRedirectCsv(csv);
    if (rows.length > MAX_ROWS) return badRequest(`That file has ${rows.length} rows; the limit is ${MAX_ROWS} per import.`);

    const existing = await db.select().from(redirects);
    const plan = planWrites(rows, existing, { allowRegex: can(guard.user, 'redirects:regex'), onDuplicate });
    // Rows the reader could not even parse are errors too, in line order with the rest.
    const errors = problems.map((problem) => ({
      line: problem.line,
      from: '',
      to: '',
      action: 'error' as const,
      reason: problem.message,
    }));
    const report = {
      rows: [...plan.rows, ...errors].sort((a, b) => a.line - b.line),
      counts: { ...plan.counts, error: plan.counts.error + errors.length },
      retargeted: plan.retargeted.length,
    };

    if (dryRun) return ok({ dryRun: true, ...report });

    await db.transaction(async (tx) => {
      for (const verdict of plan.rows) {
        if (!('rule' in verdict)) continue;
        const values = {
          fromPath: verdict.rule.fromPath,
          matchType: verdict.rule.matchType,
          matchQuery: verdict.rule.matchQuery,
          keepRest: verdict.rule.keepRest,
          toPath: verdict.rule.toPath,
          status: verdict.rule.status,
          note: verdict.rule.note,
        };
        if (verdict.action === 'update' && verdict.existingId) {
          await tx.update(redirects).set({ ...values, updatedAt: new Date() }).where(eq(redirects.id, verdict.existingId));
        } else {
          await tx.insert(redirects).values({ ...values, createdById: guard.user.id });
        }
      }
      for (const moved of plan.retargeted) {
        await tx.update(redirects).set({ toPath: moved.toPath, updatedAt: new Date() }).where(eq(redirects.id, moved.id));
      }
    });

    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: 'redirect.import',
      targetType: 'redirect',
      summary: `Imported redirects: ${report.counts.create} created, ${report.counts.update} updated, ${report.counts.skip} skipped, ${report.counts.error} refused`,
      metadata: report.counts,
      ip: clientIp(request.headers),
    });

    // Any of these may answer a path whose 404 is cached.
    invalidateRouting();
    revalidateEverything();
    return ok({ dryRun: false, ...report });
  });
}
