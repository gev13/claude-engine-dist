import { z } from 'zod';
import { CAPTCHA_CSP, CAPTCHA_LABELS, CAPTCHA_SETTING_KEY, captchaSettingsSchema, type CaptchaSettings } from '@/lib/captcha';
import { sourceHosts, thirdParties } from '@/lib/integrations';
import { handle, ok, readJson } from '@/server/api/respond';
import { requireUser } from '@/server/api/guard';
import { audit } from '@/server/auth/audit';
import { clientIp } from '@/server/auth/rateLimit';
import { revalidateEverything } from '@/server/content/revalidate';
import { getCaptchaSettings, getIntegrations } from '@/server/integrations/settings';
import { invalidateRouting } from '@/server/routing/config';
import { decryptSecret, nextSecret } from '@/server/security/secrets';
import { db } from '@/server/db';
import { settings } from '@/server/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Security → Bot protection (T12, 2.16). Administrators only, like the rest
 * of the Security screen. The secret goes in and never comes back: the
 * editor is told whether one is held, and `nextSecret` decides keep, replace
 * or clear.
 */
export async function GET(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'settings:write');
    if (!guard.ok) return guard.response;
    const { settings: captcha, hasSecret, storedSecret } = await getCaptchaSettings();
    return ok({ captcha, secretSet: hasSecret, secretUnreadable: hasSecret && decryptSecret(storedSecret) === null, thirdParties: await listThirdParties(captcha) });
  });
}

/** Everything switched on that loads from another company's servers, with its hosts. */
async function listThirdParties(captcha: CaptchaSettings) {
  const list = thirdParties(await getIntegrations());
  if (captcha.provider !== 'none') list.push({ name: CAPTCHA_LABELS[captcha.provider], hosts: sourceHosts(CAPTCHA_CSP[captcha.provider]) });
  return list;
}

const saveSchema = z.object({ captcha: captchaSettingsSchema, secret: z.string().max(400).optional() });

export async function PUT(request: Request) {
  return handle(async () => {
    const guard = await requireUser(request, 'settings:write');
    if (!guard.ok) return guard.response;
    const parsed = await readJson(request, saveSchema);
    if (!parsed.ok) return parsed.response;

    const { storedSecret } = await getCaptchaSettings();
    const value = { ...parsed.data.captcha, secret: nextSecret(parsed.data.secret, storedSecret) };

    await db
      .insert(settings)
      .values({ key: CAPTCHA_SETTING_KEY, value, updatedById: guard.user.id })
      .onConflictDoUpdate({ target: settings.key, set: { value, updatedById: guard.user.id, updatedAt: new Date() } });

    await audit({
      actorId: guard.user.id,
      actorEmail: guard.user.email,
      action: 'captcha.update',
      targetType: 'settings',
      targetId: CAPTCHA_SETTING_KEY,
      summary: value.provider === 'none' ? 'Bot protection: honeypot and rate limit only' : `Bot protection: ${CAPTCHA_LABELS[value.provider]}`,
      metadata: { provider: value.provider, surfaces: value.surfaces, failClosed: value.failClosed },
      ip: clientIp(request.headers),
    });

    // The provider's origins join the policy, and every page's forms change.
    invalidateRouting();
    revalidateEverything();
    const saved = await getCaptchaSettings();
    return ok({
      captcha: saved.settings,
      secretSet: saved.hasSecret,
      secretUnreadable: saved.hasSecret && decryptSecret(saved.storedSecret) === null,
      thirdParties: await listThirdParties(saved.settings),
    });
  });
}
