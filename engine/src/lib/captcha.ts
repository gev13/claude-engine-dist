import { z } from 'zod';
import type { CspSources } from './csp';

/* ═══════════════════════════════════════════════════════════════════════════
   Bot protection for the public forms (T12, 2.16)
   ───────────────────────────────────────────────────────────────────────────
   The honeypot and the rate limit stay; this adds a challenge in front of
   them for a site that wants one. Off by default — a challenge is a third
   party on the page, and the Security screen says so when one is on.

   The secret key is encrypted at rest like the SMTP password and never
   leaves the server (`nextSecret` decides keep, replace or clear). The site
   key is public by design: it is what the widget is loaded with.
   ═══════════════════════════════════════════════════════════════════════════ */

export const CAPTCHA_SETTING_KEY = 'captcha';

export const CAPTCHA_PROVIDERS = ['none', 'turnstile', 'recaptchaV2', 'recaptchaV3', 'hcaptcha'] as const;
export type CaptchaProvider = (typeof CAPTCHA_PROVIDERS)[number];

export const CAPTCHA_LABELS: Record<CaptchaProvider, string> = {
  none: 'None — the honeypot and the rate limit only',
  turnstile: 'Cloudflare Turnstile',
  recaptchaV2: 'Google reCAPTCHA v2 (the tick box)',
  recaptchaV3: 'Google reCAPTCHA v3 (a score, no challenge)',
  hcaptcha: 'hCaptcha',
};

/** Where each form the engine has can be protected. */
export const CAPTCHA_SURFACES = ['form', 'contactForm', 'newsletter', 'careers', 'login', 'reset'] as const;
export type CaptchaSurface = (typeof CAPTCHA_SURFACES)[number];

export const CAPTCHA_SURFACE_LABELS: Record<CaptchaSurface, string> = {
  form: 'Form blocks',
  contactForm: 'The contact form',
  newsletter: 'Newsletter sign-ups',
  careers: 'Job applications',
  login: 'Signing in to the admin',
  reset: 'Password reset requests',
};

/**
 * Keys as the providers issue them: letters, digits, `_` and `-`. The site
 * key is written into the page; nothing else is accepted there.
 */
const KEY = /^[A-Za-z0-9_-]{10,100}$/;

export const captchaSettingsSchema = z.object({
  provider: z.enum(CAPTCHA_PROVIDERS).default('none'),
  siteKey: z
    .string()
    .trim()
    .refine((value) => value === '' || KEY.test(value), 'That does not look like a site key')
    .default(''),
  /** reCAPTCHA v3 only: the score below which a submission is refused. */
  threshold: z.number().min(0.1).max(0.9).default(0.5),
  /**
   * When the provider cannot be reached: refuse the submission (closed), or
   * let it through on the honeypot and rate limit alone (open, the default —
   * an outage at the provider should not silence every form on the site).
   */
  failClosed: z.boolean().default(false),
  surfaces: z
    .object(Object.fromEntries(CAPTCHA_SURFACES.map((key) => [key, z.boolean().default(!['login', 'reset'].includes(key))])) as Record<CaptchaSurface, z.ZodDefault<z.ZodBoolean>>)
    .prefault({}),
});

export type CaptchaSettings = z.output<typeof captchaSettingsSchema>;

/** What the public page may see: never the secret. */
export type PublicCaptcha = { provider: Exclude<CaptchaProvider, 'none'>; siteKey: string; surfaces: CaptchaSurface[] } | null;

export function publicCaptcha(settings: CaptchaSettings, hasSecret: boolean): PublicCaptcha {
  if (settings.provider === 'none' || !settings.siteKey || !hasSecret) return null;
  return {
    provider: settings.provider,
    siteKey: settings.siteKey,
    surfaces: CAPTCHA_SURFACES.filter((key) => settings.surfaces[key]),
  };
}

/** Whether one form is protected: its own override, or the site's setting for its kind. */
export function captchaApplies(captcha: PublicCaptcha, surface: CaptchaSurface, override: 'inherit' | 'on' | 'off' = 'inherit'): boolean {
  if (!captcha) return false;
  if (override === 'off') return false;
  if (override === 'on') return true;
  return captcha.surfaces.includes(surface);
}

/** What each provider needs from the Content-Security-Policy. */
export const CAPTCHA_CSP: Record<Exclude<CaptchaProvider, 'none'>, CspSources> = {
  turnstile: { script: ['https://challenges.cloudflare.com'], frame: ['https://challenges.cloudflare.com'], connect: ['https://challenges.cloudflare.com'] },
  recaptchaV2: {
    script: ['https://www.google.com', 'https://www.gstatic.com', 'https://www.recaptcha.net'],
    frame: ['https://www.google.com', 'https://www.recaptcha.net'],
    connect: ['https://www.google.com', 'https://www.recaptcha.net'],
    img: ['https://www.gstatic.com'],
  },
  recaptchaV3: {
    script: ['https://www.google.com', 'https://www.gstatic.com', 'https://www.recaptcha.net'],
    frame: ['https://www.google.com', 'https://www.recaptcha.net'],
    connect: ['https://www.google.com', 'https://www.recaptcha.net'],
    img: ['https://www.gstatic.com'],
  },
  hcaptcha: {
    script: ['https://hcaptcha.com', 'https://*.hcaptcha.com'],
    frame: ['https://hcaptcha.com', 'https://*.hcaptcha.com'],
    connect: ['https://hcaptcha.com', 'https://*.hcaptcha.com'],
    style: ['https://hcaptcha.com', 'https://*.hcaptcha.com'],
  },
};

/** The script each widget loads from, with the callback that renders it explicitly. */
export const CAPTCHA_SCRIPT: Record<Exclude<CaptchaProvider, 'none'>, (siteKey: string) => string> = {
  turnstile: () => 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit',
  recaptchaV2: () => 'https://www.google.com/recaptcha/api.js?render=explicit',
  recaptchaV3: (siteKey) => `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`,
  hcaptcha: () => 'https://js.hcaptcha.com/1/api.js?render=explicit',
};

/**
 * Test keys the providers publish, which always pass — for trying a form
 * before the real keys arrive. The reCAPTCHA pair is in .gitleaksignore.
 */
export const CAPTCHA_TEST_KEYS: Partial<Record<Exclude<CaptchaProvider, 'none'>, { siteKey: string; secret: string }>> = {
  turnstile: { siteKey: '1x00000000000000000000AA', secret: '1x0000000000000000000000000000000AA' },
  recaptchaV2: { siteKey: '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI', secret: '6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe' },
  hcaptcha: { siteKey: '10000000-ffff-ffff-ffff-000000000001', secret: '0x0000000000000000000000000000000000000000' },
};
