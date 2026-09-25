import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { CODE_SETTING_KEY } from '@/lib/customCode';
import { INTEGRATIONS_SETTING_KEY, PRESETS, activePresets, activeSnippets, integrationsSchema } from '@/lib/integrations';
import { handle, ok, readJson } from '@/server/api/respond';
import { requireUser } from '@/server/api/guard';
import { audit } from '@/server/auth/audit';
import { clientIp } from '@/server/auth/rateLimit';
import { revalidateEverything } from '@/server/content/revalidate';
import { getIntegrations } from '@/server/integrations/settings';
import { invalidateRouting } from '@/server/routing/config';
import { db } from '@/server/db';
import { settings } from '@/server/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Settings → Integrations (T10, 2.16). Administrators only (`settings:*`):
 * what this switches on runs in every visitor's browser, and custom snippets
 * are arbitrary script.
 */
export async function GET(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'settings:write');
    if (!guard.ok) return guard.response;
    return ok({ integrations: await getIntegrations() });
  });
}

export async function PUT(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'settings:write');
    if (!guard.ok) return guard.response;
    const parsed = await readJson(request, z.object({ integrations: integrationsSchema }));
    if (!parsed.ok) return parsed.response;
    const value = parsed.data.integrations;

    await db.transaction(async (tx) => {
      await tx
        .insert(settings)
        .values({ key: INTEGRATIONS_SETTING_KEY, value, updatedById: guard.user.id })
        .onConflictDoUpdate({ target: settings.key, set: { value, updatedById: guard.user.id, updatedAt: new Date() } });
      /* The GA4 id Custom code used to hold now lives here, so it is taken
         out of there — one place for it, and nothing loading twice. */
      const [code] = await tx.select().from(settings).where(eq(settings.key, CODE_SETTING_KEY)).limit(1);
      const legacy = code?.value as { analyticsId?: string } | undefined;
      if (legacy?.analyticsId) {
        await tx.update(settings).set({ value: { ...legacy, analyticsId: '' }, updatedAt: new Date() }).where(eq(settings.key, CODE_SETTING_KEY));
      }
    });

    const on = activePresets(value).map((key) => PRESETS[key].label);
    const snippets = activeSnippets(value);
    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: 'integrations.update',
      targetType: 'settings',
      targetId: INTEGRATIONS_SETTING_KEY,
      summary: on.length || snippets.length
        ? `Integrations: ${[...on, ...snippets.map((s) => `snippet “${s.name}”`)].join(', ')}`
        : 'Switched every integration off',
      metadata: { presets: activePresets(value), snippets: snippets.map((s) => s.name), consentMode: value.consentMode },
      ip: clientIp(request.headers),
    });

    // The policy is rebuilt from these, and every page's head changes.
    invalidateRouting();
    try {
      revalidatePath('/integrations.js');
    } catch {
      /* A cache hint, never a failed save. */
    }
    revalidateEverything();
    return ok({ integrations: value });
  });
}
