import { z } from 'zod';
import { WEBHOOKS_SETTING_KEY, templateProblems, webhookSchema, type Webhook } from '@/lib/webhooks';
import { badRequest, handle, ok, readJson } from '@/server/api/respond';
import { requireUser } from '@/server/api/guard';
import { audit } from '@/server/auth/audit';
import { clientIp } from '@/server/auth/rateLimit';
import { db } from '@/server/db';
import { formSubmissions, settings } from '@/server/db/schema';
import { SECRET_MASK, isEncrypted, nextSecret } from '@/server/security/secrets';
import { getWebhooks, recentDeliveries } from '@/server/webhooks/deliver';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** What the browser sees: a mask where a secret or a header value is stored, never the value. */
const masked = (hook: Webhook) => ({
  ...hook,
  secret: isEncrypted(hook.secret) ? SECRET_MASK : '',
  headers: hook.headers.map((header) => ({ ...header, value: isEncrypted(header.value) ? SECRET_MASK : '' })),
});

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

    // A placeholder the hook's events do not carry would send empty text for ever; say so now.
    const problems = parsed.data.hooks.flatMap((hook) => templateProblems(hook).map((problem) => `${hook.name}: ${problem}`));
    if (problems.length) return badRequest(problems.join(' · '));

    const before = await getWebhooks();
    const hooks = parsed.data.hooks.map((hook) => {
      const old = before.hooks.find((candidate) => candidate.id === hook.id);
      return {
        ...hook,
        // Keep, replace or clear — decided per hook against what it stored.
        secret: nextSecret(hook.secret, old?.secret),
        // The same per header, matched by its id, so renaming a header keeps its value.
        headers: hook.headers.map((header) => ({ ...header, value: nextSecret(header.value, old?.headers.find((h) => h.id === header.id)?.value) })),
      };
    });
    const empty = hooks.flatMap((hook) => hook.headers.filter((header) => header.value === '').map((header) => `${hook.name}: give ${header.name} a value`));
    if (empty.length) return badRequest(empty.join(' · '));
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
      // Where submissions go is worth recording, and which headers are set; the values are not.
      metadata: {
        hooks: hooks.map((h) => ({ name: h.name, host: new URL(h.url).host, enabled: h.enabled, events: h.events, headers: h.headers.map((x) => x.name), body: h.body.mode })),
      },
      ip: clientIp(request.headers),
    });

    return ok({ hooks: hooks.map(masked) });
  });
}
