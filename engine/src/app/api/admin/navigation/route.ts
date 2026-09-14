import { eq } from 'drizzle-orm';
import { handle, ok, readJson } from '@/server/api/respond';
import { requireUser } from '@/server/api/guard';
import { audit } from '@/server/auth/audit';
import { clientIp } from '@/server/auth/rateLimit';
import { revalidateEverything } from '@/server/content/revalidate';
import { NAVIGATION_SETTING_KEY, bundledNavigation, getNavigation } from '@/server/content/navigation';
import { navigationSchema } from '@/lib/navigation';
import { db } from '@/server/db';
import { settings } from '@/server/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The header and footer menus.
 *
 * A PUT replaces the whole navigation: the editor always holds the complete
 * object, and a partial merge would make "remove this item" impossible to
 * express. DELETE drops the row so the bundled menus take over again.
 */
export async function GET(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'navigation:read');
    if (!guard.ok) return guard.response;

    const navigation = await getNavigation();
    // The bundled menus are what "reset" restores, so the editor can show it.
    return ok({ navigation, bundled: await bundledNavigation() });
  });
}

export async function PUT(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'navigation:write');
    if (!guard.ok) return guard.response;

    const parsed = await readJson(request, navigationSchema);
    if (!parsed.ok) return parsed.response;

    await db
      .insert(settings)
      .values({ key: NAVIGATION_SETTING_KEY, value: parsed.data, updatedById: guard.user.id })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: parsed.data, updatedById: guard.user.id, updatedAt: new Date() },
      });

    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: 'navigation.update',
      targetType: 'settings',
      targetId: NAVIGATION_SETTING_KEY,
      summary: `Updated the menus (${parsed.data.header?.length ?? 0} header, ${parsed.data.footer?.length ?? 0} footer columns)`,
      ip: clientIp(request.headers),
    });

    // Menus are part of the shared layout: every rendered page is now stale.
    revalidateEverything();

    return ok({ navigation: await getNavigation(), bundled: await bundledNavigation() });
  });
}

export async function DELETE(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'navigation:write');
    if (!guard.ok) return guard.response;

    await db.delete(settings).where(eq(settings.key, NAVIGATION_SETTING_KEY));

    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: 'navigation.reset',
      targetType: 'settings',
      targetId: NAVIGATION_SETTING_KEY,
      summary: 'Reset the menus to the built-in navigation',
      ip: clientIp(request.headers),
    });

    revalidateEverything();

    return ok({ navigation: await getNavigation(), bundled: await bundledNavigation() });
  });
}
