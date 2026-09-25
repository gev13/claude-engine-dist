import { z } from 'zod';
import { WEBHOOKS_SETTING_KEY, webhookSchema, type Webhook } from '@/lib/webhooks';
import { handle, ok, readJson } from '@/server/api/respond';
import { requireUser } from '@/server/api/guard';
import { audit } from '@/server/auth/audit';
import { clientIp } from '@/server/auth/rateLimit';
import { db } from '@/server/db';
import { formSubmissions, settings } from '@/server/db/schema';
import { SECRET_MASK, isEncrypted, nextSecret } from '@/server/security/secrets';
import { getWebhooks, recentDeliveries } from '@/server/webhooks/deliver';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** What the browser sees: a mask where a secret is stored, never the secret. */
const masked = (hook: Webhook) => ({ ...hook, secret: isEncrypted(hook.secret) ? SECRET_MASK : '' });

/**
 * Webhooks (T13, 2.16). Administrators only (`settings:*`): the server
 * fetches whatever address is saved here, and a submission's answers leave
 * the site through it.
 */
export async function GET(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'settings:write');
    if (!guard.ok) return guard.response;
    const [current, deliveries, forms] = await Promise.all([
      getWebhooks(),
      recentDeliveries(),
      db.selectDistinct({ name: formSubmissions.formName }).from(formSubmissions).orderBy(formSubmissions.formName),
    ]);
    return ok({ hooks: current.hooks.map(masked), deliveries, forms: forms.map((f) => f.name) });
  });
}

export async function PUT(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'settings:write');
    if (!guard.ok) return guard.response;
    const parsed = await readJson(request, z.object({ hooks: z.array(webhookSchema).max(10) }));
    if (!parsed.ok) return parsed.response;

    const before = await getWebhooks();
    const hooks = parsed.data.hooks.map((hook) => ({
      ...hook,
      // Keep, replace or clear — decided per hook against what it stored.
      secret: nextSecret(hook.secret, before.hooks.find((old) => old.id === hook.id)?.secret),
    }));
    const value = { hooks };

    await db
      .insert(settings)
      .values({ key: WEBHOOKS_SETTING_KEY, value, updatedById: guard.user.id })
      .onConflictDoUpdate({ target: settings.key, set: { value, updatedById: guard.user.id, updatedAt: new Date() } });

    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: 'webhooks.update',
      targetType: 'settings',
      targetId: WEBHOOKS_SETTING_KEY,
      summary: hooks.length ? `Webhooks: ${hooks.map((h) => `${h.name}${h.enabled ? '' : ' (off)'}`).join(', ')}` : 'Removed every webhook',
      // Where submissions go is worth recording; the secrets are not.
      metadata: { hooks: hooks.map((h) => ({ name: h.name, host: new URL(h.url).host, enabled: h.enabled, events: h.events })) },
      ip: clientIp(request.headers),
    });

    return ok({ hooks: hooks.map(masked) });
  });
}
