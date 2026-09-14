import { z } from 'zod';
import { badRequest, handle, ok, readJson } from '@/server/api/respond';
import { requireUser } from '@/server/api/guard';
import { audit } from '@/server/auth/audit';
import { clientIp } from '@/server/auth/rateLimit';
import { revalidateEverything } from '@/server/content/revalidate';
import { POPUPS_SETTING_KEY, getPopups } from '@/server/content/popups';
import { type AnyBlock, collectInvalidBlocks } from '@/lib/blocks';
import { popupsSchema } from '@/lib/popups';
import { db } from '@/server/db';
import { settings } from '@/server/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The site's popups (P3-D).
 *
 * A PUT replaces the whole list, as the menus do: the editor holds every
 * popup, and a partial merge could not express "delete this one". Every
 * popup's blocks are checked the way a page's are, so a popup never saves
 * with a block that would vanish from the site.
 */
export async function GET(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'popups:read');
    if (!guard.ok) return guard.response;
    return ok({ popups: await getPopups() });
  });
}

export async function PUT(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'popups:write');
    if (!guard.ok) return guard.response;

    const parsed = await readJson(request, z.object({ popups: popupsSchema }));
    if (!parsed.ok) return parsed.response;
    const { popups } = parsed.data;

    const problems = popups.flatMap((popup) =>
      collectInvalidBlocks(popup.blocks as unknown as AnyBlock[]).map((problem) => `${popup.name}: ${problem}`),
    );
    if (problems.length > 0) return badRequest('A popup has a block that is not complete yet.', problems);

    await db
      .insert(settings)
      .values({ key: POPUPS_SETTING_KEY, value: popups, updatedById: guard.user.id })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: popups, updatedById: guard.user.id, updatedAt: new Date() },
      });

    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: 'popups.update',
      targetType: 'settings',
      targetId: POPUPS_SETTING_KEY,
      summary: `Updated the popups (${popups.length}, ${popups.filter((p) => p.enabled).length} switched on)`,
      ip: clientIp(request.headers),
    });

    // Popups render in the shared layout, so every page is now stale.
    revalidateEverything();
    return ok({ popups });
  });
}
