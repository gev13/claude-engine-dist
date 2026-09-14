import { eq } from 'drizzle-orm';
import { handle, ok, readJson } from '@/server/api/respond';
import { requireUser } from '@/server/api/guard';
import { audit } from '@/server/auth/audit';
import { clientIp } from '@/server/auth/rateLimit';
import { revalidateEverything } from '@/server/content/revalidate';
import { THEME_SETTING_KEY, getTheme } from '@/server/content/theme';
import { themeSchema } from '@/lib/theme';
import { db } from '@/server/db';
import { settings } from '@/server/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The global theme.
 *
 * A PUT replaces the whole theme rather than merging: the editor always holds
 * the complete object, and a partial merge would make "clear this field"
 * impossible to express. The body is validated by the same schema the renderer
 * trusts, so a value that would not survive `themeToCss` is rejected at the
 * boundary with a message rather than silently dropped at render.
 */
export async function GET(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'appearance:read');
    if (!guard.ok) return guard.response;

    return ok({ theme: await getTheme() });
  });
}

export async function PUT(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'appearance:write');
    if (!guard.ok) return guard.response;

    const parsed = await readJson(request, themeSchema);
    if (!parsed.ok) return parsed.response;

    await db
      .insert(settings)
      .values({ key: THEME_SETTING_KEY, value: parsed.data, updatedById: guard.user.id })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: parsed.data, updatedById: guard.user.id, updatedAt: new Date() },
      });

    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: 'appearance.update',
      targetType: 'settings',
      targetId: THEME_SETTING_KEY,
      summary: 'Updated the global theme',
      ip: clientIp(request.headers),
    });

    // A theme change is a layout change: every rendered page is now stale.
    revalidateEverything();

    return ok({ theme: parsed.data });
  });
}

/** Reset to the built-in design by deleting the row entirely. */
export async function DELETE(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'appearance:write');
    if (!guard.ok) return guard.response;

    await db.delete(settings).where(eq(settings.key, THEME_SETTING_KEY));

    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: 'appearance.reset',
      targetType: 'settings',
      targetId: THEME_SETTING_KEY,
      summary: 'Reset the global theme to the built-in design',
      ip: clientIp(request.headers),
    });

    revalidateEverything();

    return ok({ theme: await getTheme() });
  });
}
