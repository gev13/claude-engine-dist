import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { badRequest, handle, ok, readJson } from '@/server/api/respond';
import { clientIp, rateLimit } from '@/server/auth/rateLimit';
import { getCookieNotice } from '@/server/content/cookies';
import { refuseIfBlocked } from '@/server/security/guard';
import { db } from '@/server/db';
import { consentStats } from '@/server/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Count one consent answer (T11, 2.16) — only when the cookie notice's log
 * is switched on. The body is one word; nothing about the visitor is stored,
 * and the rate limit uses the address only to be a rate limit.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const ip = clientIp(request.headers);
    const refused = await refuseIfBlocked(ip);
    if (refused) return refused;
    const notice = await getCookieNotice();
    if (!notice.enabled || notice.mode !== 'consent' || !notice.log) return ok({ ok: true });

    const limit = await rateLimit({ key: `consent:${ip}`, limit: 10, windowSec: 3600, blockSec: 3600 });
    if (!limit.allowed) return ok({ ok: true });

    const parsed = await readJson(request, z.object({ choice: z.enum(['accepted', 'rejected', 'custom']) }));
    if (!parsed.ok) return badRequest('Not an answer.');
    const day = new Date().toISOString().slice(0, 10);
    await db
      .insert(consentStats)
      .values({ day, choice: parsed.data.choice, count: 1 })
      .onConflictDoUpdate({ target: [consentStats.day, consentStats.choice], set: { count: sql`${consentStats.count} + 1` } });
    return ok({ ok: true });
  });
}
