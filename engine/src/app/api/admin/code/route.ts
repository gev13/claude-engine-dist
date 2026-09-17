import { z } from 'zod';
import { handle, ok, readJson } from '@/server/api/respond';
import { requireUser } from '@/server/api/guard';
import { audit } from '@/server/auth/audit';
import { clientIp } from '@/server/auth/rateLimit';
import { revalidateEverything } from '@/server/content/revalidate';
import { CODE_SETTING_KEY, codeSchema, hasAnalytics } from '@/lib/customCode';
import { getSiteCode } from '@/server/content/code';
import { db } from '@/server/db';
import { settings } from '@/server/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The site's own CSS, and its analytics id.
 *
 * `settings:write` on the read as well, because there is no `settings:read`
 * and this is administrators only either way. Not because CSS is
 * dangerous — it cannot execute anything, and the schema strips the two
 * constructs that could leave the style element — but because this row loads
 * on every page of the site, including the ones somebody else is editing.
 * That is the same reach Appearance has, and it is held to the same bar.
 */
export async function GET(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'settings:write');
    if (!guard.ok) return guard.response;
    return ok({ code: await getSiteCode() });
  });
}

export async function PUT(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'settings:write');
    if (!guard.ok) return guard.response;

    const parsed = await readJson(request, z.object({ code: codeSchema }));
    if (!parsed.ok) return parsed.response;
    const { code } = parsed.data;

    await db
      .insert(settings)
      .values({ key: CODE_SETTING_KEY, value: code, updatedById: guard.user.id })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: code, updatedById: guard.user.id, updatedAt: new Date() },
      });

    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: 'code.update',
      targetType: 'settings',
      targetId: CODE_SETTING_KEY,
      summary: 'Updated the site-wide custom code',
      /* The lengths and the switch, never the CSS itself: the audit log is
         not a second copy of every edit. */
      metadata: { cssLength: code.css.length, analytics: hasAnalytics(code) },
      ip: clientIp(request.headers),
    });

    // It is written into the shared layout, so every page is now stale.
    revalidateEverything();
    return ok({ code });
  });
}
