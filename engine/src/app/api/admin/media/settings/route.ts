import { z } from 'zod';
import { MEDIA_SETTING_KEY, mediaSettingsSchema } from '@/lib/mediaSettings';
import { handle, ok, readJson } from '@/server/api/respond';
import { requireUser } from '@/server/api/guard';
import { audit } from '@/server/auth/audit';
import { clientIp } from '@/server/auth/rateLimit';
import { revalidateEverything } from '@/server/content/revalidate';
import { getMediaSettings, missingSizesCount, sizesJob } from '@/server/media/variants';
import { invalidateRouting } from '@/server/routing/config';
import { db } from '@/server/db';
import { settings } from '@/server/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Media settings (2.17): responsive images, AVIF, who may upload SVG.
 * Administrators only — the first changes every page's markup, the last
 * decides who may put a document on this origin.
 */
export async function GET(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'settings:write');
    if (!guard.ok) return guard.response;
    return ok({ settings: await getMediaSettings(), job: sizesJob(), missing: await missingSizesCount() });
  });
}

export async function PUT(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'settings:write');
    if (!guard.ok) return guard.response;
    const parsed = await readJson(request, z.object({ settings: mediaSettingsSchema }));
    if (!parsed.ok) return parsed.response;
    const before = await getMediaSettings();
    const value = parsed.data.settings;

    await db
      .insert(settings)
      .values({ key: MEDIA_SETTING_KEY, value, updatedById: guard.user.id })
      .onConflictDoUpdate({ target: settings.key, set: { value, updatedById: guard.user.id, updatedAt: new Date() } });

    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: 'media.settings',
      targetType: 'settings',
      targetId: MEDIA_SETTING_KEY,
      summary: `Media: responsive images ${value.responsive ? 'on' : 'off'}${value.avif ? ', AVIF' : ''}; SVG uploads for ${value.svgRoles.join(', ') || 'nobody'}`,
      metadata: { before, after: value },
      ip: clientIp(request.headers),
    });

    // The switch lives in the routing config and in every page's markup.
    if (before.responsive !== value.responsive) {
      invalidateRouting();
      revalidateEverything();
    }
    return ok({ settings: value, job: sizesJob(), missing: await missingSizesCount() });
  });
}
