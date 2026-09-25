import 'server-only';
import { cache } from 'react';
import { eq, inArray } from 'drizzle-orm';
import { CAPTCHA_SETTING_KEY, captchaSettingsSchema, publicCaptcha, type CaptchaSettings, type PublicCaptcha } from '@/lib/captcha';
import { ANALYTICS_PATTERN, CODE_SETTING_KEY } from '@/lib/customCode';
import { INTEGRATIONS_SETTING_KEY, resolveIntegrations, type Integrations } from '@/lib/integrations';
import { db } from '@/server/db';
import { settings } from '@/server/db/schema';
import { decryptSecret, isEncrypted } from '@/server/security/secrets';

/* Readers for 2.16's settings rows. None throws: a broken row is the shipped
   default — nothing loaded, no challenge — never a broken page. */

/**
 * The integrations, with a GA4 id from before 2.16 (Custom code's single
 * field) folded in, so a site that set one keeps its analytics when it
 * updates and the new screen shows it where it now lives.
 */
export const getIntegrations = cache(async (): Promise<Integrations> => {
  try {
    const rows = await db
      .select({ key: settings.key, value: settings.value })
      .from(settings)
      .where(inArray(settings.key, [INTEGRATIONS_SETTING_KEY, CODE_SETTING_KEY]));
    const byKey = new Map(rows.map((row) => [row.key, row.value]));
    const integrations = resolveIntegrations(byKey.get(INTEGRATIONS_SETTING_KEY));
    const legacy = String((byKey.get(CODE_SETTING_KEY) as { analyticsId?: unknown } | undefined)?.analyticsId ?? '').trim().toUpperCase();
    if (!byKey.has(INTEGRATIONS_SETTING_KEY) && ANALYTICS_PATTERN.test(legacy)) {
      integrations.ga4 = { ...integrations.ga4, enabled: true, id: legacy };
    }
    return integrations;
  } catch {
    return resolveIntegrations(undefined);
  }
});

type StoredCaptcha = CaptchaSettings & { secret?: unknown };

async function captchaRow(): Promise<StoredCaptcha | null> {
  const [row] = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, CAPTCHA_SETTING_KEY)).limit(1);
  return (row?.value as StoredCaptcha | undefined) ?? null;
}

/** The CAPTCHA settings, the stored (encrypted) secret, and whether one is set. */
export async function getCaptchaSettings(): Promise<{ settings: CaptchaSettings; storedSecret: unknown; hasSecret: boolean }> {
  try {
    const row = await captchaRow();
    const parsed = captchaSettingsSchema.safeParse(row ?? {});
    const settings = parsed.success ? parsed.data : captchaSettingsSchema.parse({});
    return { settings, storedSecret: row?.secret, hasSecret: isEncrypted(row?.secret) };
  } catch {
    return { settings: captchaSettingsSchema.parse({}), storedSecret: undefined, hasSecret: false };
  }
}

/** What a public page is told: the provider and the site key, never the secret. */
export const getPublicCaptcha = cache(async (): Promise<PublicCaptcha> => {
  const { settings, hasSecret } = await getCaptchaSettings();
  return publicCaptcha(settings, hasSecret);
});

/** The secret, decrypted — only ever in the verifying request. */
export async function captchaSecret(): Promise<string | null> {
  const { storedSecret } = await getCaptchaSettings();
  return decryptSecret(storedSecret);
}
