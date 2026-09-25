import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { handle, ok, readJson } from '@/server/api/respond';
import { requireUser } from '@/server/api/guard';
import { audit } from '@/server/auth/audit';
import { clientIp } from '@/server/auth/rateLimit';
import { revalidateEverything } from '@/server/content/revalidate';
import { COOKIE_SETTING_KEY, cookieNoticeSchema } from '@/lib/cookies';
import { getCookieNotice } from '@/server/content/cookies';
import { db } from '@/server/db';
import { consentStats, settings } from '@/server/db/schema';
import { gte } from 'drizzle-orm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The cookie notice.
 *
 * One row, replaced whole — there is only ever one notice, so there is
 * nothing to merge. It sits with the popups under `popups:*`: both are site
 * chrome that appears over every page, and the manager who owns the site's
 * look owns them both.
 */
export async function GET(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'popups:read');
    if (!guard.ok) return guard.response;
    // The anonymous consent log's last thirty days, when it is on (2.16).
    const since = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
    const rows = await db.select().from(consentStats).where(gte(consentStats.day, since));
    const stats = { accepted: 0, rejected: 0, custom: 0 } as Record<string, number>;
    for (const row of rows) stats[row.choice] = (stats[row.choice] ?? 0) + row.count;
    return ok({ notice: await getCookieNotice(), stats });
  });
}

export async function PUT(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'popups:write');
    if (!guard.ok) return guard.response;

    const parsed = await readJson(request, z.object({ notice: cookieNoticeSchema }));
    if (!parsed.ok) return parsed.response;
    const { notice } = parsed.data;

    await db
      .insert(settings)
      .values({ key: COOKIE_SETTING_KEY, value: notice, updatedById: guard.user.id })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: notice, updatedById: guard.user.id, updatedAt: new Date() },
      });

    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: 'cookies.update',
      targetType: 'settings',
      targetId: COOKIE_SETTING_KEY,
      summary: notice.enabled ? 'Switched the cookie notice on' : 'Switched the cookie notice off',
      metadata: { position: notice.position, showReject: notice.showReject },
      ip: clientIp(request.headers),
    });

    // It renders in the shared layout, so every page is now stale — and the tag loader reads its consent rules.
    try {
      revalidatePath('/integrations.js');
    } catch {
      /* A cache hint, never a failed save. */
    }
    revalidateEverything();
    return ok({ notice });
  });
}
