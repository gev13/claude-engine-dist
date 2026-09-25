import 'server-only';
import { captchaApplies, type CaptchaProvider, type CaptchaSurface } from '@/lib/captcha';
import { captchaSecret, getCaptchaSettings, getPublicCaptcha } from '@/server/integrations/settings';

/* ═══════════════════════════════════════════════════════════════════════════
   Checking a CAPTCHA answer on the server (T12, 2.16)
   ───────────────────────────────────────────────────────────────────────────
   The token the browser sends is worth nothing until the provider confirms
   it, so every protected endpoint asks here before it stores anything. Five
   seconds, then the site's choice: let the submission through on the
   honeypot and rate limit alone (the default — a provider outage should not
   silence every form), or refuse it.
   ═══════════════════════════════════════════════════════════════════════════ */

const VERIFY: Record<Exclude<CaptchaProvider, 'none'>, string> = {
  turnstile: 'https://challenges.cloudflare.com/turnstile/v0/siteverify',
  recaptchaV2: 'https://www.google.com/recaptcha/api/siteverify',
  recaptchaV3: 'https://www.google.com/recaptcha/api/siteverify',
  hcaptcha: 'https://api.hcaptcha.com/siteverify',
};

export type CaptchaVerdict = { ok: true } | { ok: false; reason: string; publicMessage: string };

const REFUSED = 'Please complete the check that you are not a robot, then send again.';
const UNAVAILABLE = 'The check that you are not a robot could not be completed. Try again in a minute.';

/**
 * Whether a submission from `surface` passes. `override` is a form block's
 * own setting. When nothing applies — no provider, or this surface is off —
 * it passes without a request anywhere.
 */
export async function checkCaptcha(
  surface: CaptchaSurface,
  token: unknown,
  ip: string,
  override: 'inherit' | 'on' | 'off' = 'inherit',
): Promise<CaptchaVerdict> {
  const captcha = await getPublicCaptcha();
  if (!captchaApplies(captcha, surface, override) || !captcha) return { ok: true };
  if (typeof token !== 'string' || token.length < 10 || token.length > 4096) {
    return { ok: false, reason: 'no token', publicMessage: REFUSED };
  }

  const [secret, { settings }] = await Promise.all([captchaSecret(), getCaptchaSettings()]);
  /* A secret that is stored but cannot be decrypted — the server's key
     changed — is an outage of our own, not a pass: said loudly, and treated
     like an unreachable provider. */
  if (!secret) {
    console.error('[captcha] the secret key cannot be read; enter it again under Security → Bot protection');
    return settings.failClosed ? { ok: false, reason: 'secret unreadable', publicMessage: UNAVAILABLE } : { ok: true };
  }

  const body = new URLSearchParams({ secret, response: token });
  if (ip && ip !== 'unknown') body.set('remoteip', ip);

  try {
    const response = await fetch(VERIFY[captcha.provider], {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(5000),
    });
    const result = (await response.json()) as { success?: boolean; score?: number; 'error-codes'?: string[] };
    if (!result.success) {
      return { ok: false, reason: `refused by the provider (${(result['error-codes'] ?? []).join(', ') || 'no reason given'})`, publicMessage: REFUSED };
    }
    if (captcha.provider === 'recaptchaV3' && typeof result.score === 'number' && result.score < settings.threshold) {
      return { ok: false, reason: `score ${result.score} under ${settings.threshold}`, publicMessage: REFUSED };
    }
    return { ok: true };
  } catch (error) {
    console.error('[captcha] the provider could not be reached', { provider: captcha.provider, error });
    return settings.failClosed
      ? { ok: false, reason: 'the provider could not be reached', publicMessage: UNAVAILABLE }
      : { ok: true };
  }
}
