import { z } from 'zod';

/* ═══════════════════════════════════════════════════════════════════════════
   Security settings (package 5)
   ───────────────────────────────────────────────────────────────────────────
   The thresholds behind the Security screen, in one settings row. They are
   deliberately few: every one of them is something an administrator might
   genuinely want to change after a real incident, and nothing here pretends
   to be protection the application can give on its own.

   What these can do: slow down and stop password guessing, turn away an
   address that keeps tripping the limiter, keep a compromised account shut.
   What they cannot do: absorb a volumetric flood. That has to be stopped in
   front of the application, by a CDN or a reverse proxy.
   ═══════════════════════════════════════════════════════════════════════════ */

export const SECURITY_SETTING_KEY = 'security';

export const securitySettingsSchema = z.object({
  /** Failed sign-ins before an account is locked. */
  maxFailures: z.coerce.number().int().min(3).max(20).default(5),
  /** How long the first lock lasts; repeats lengthen it. */
  lockMinutes: z.coerce.number().int().min(1).max(1440).default(15),
  /**
   * After this many locks within a day the account stays locked until an
   * administrator releases it. Zero means a lock always expires by itself.
   */
  manualUnlockAfter: z.coerce.number().int().min(0).max(10).default(3),
  /** Rate-limit blocks from one address within an hour before it is refused outright. Zero switches it off. */
  autoBlockAfter: z.coerce.number().int().min(0).max(50).default(5),
  /** How long an automatic block lasts. */
  autoBlockMinutes: z.coerce.number().int().min(5).max(10_080).default(60),
  /** Email an alert when an account is locked or an address is blocked. */
  alertOnLockout: z.boolean().default(true),
});

export type SecuritySettings = z.output<typeof securitySettingsSchema>;

export const SECURITY_DEFAULTS: SecuritySettings = securitySettingsSchema.parse({});

/** An address as it should be stored: trimmed, lowercased, length-capped. */
export function normaliseIp(raw: string): string {
  return raw.trim().toLowerCase().slice(0, 64);
}

/** Rough shape check — enough to reject a paste of something that is not an address. */
export function looksLikeIp(value: string): boolean {
  const ip = normaliseIp(value);
  if (!ip) return false;
  const v4 = /^(\d{1,3}\.){3}\d{1,3}$/;
  const v6 = /^[0-9a-f:]+$/;
  if (v4.test(ip)) return ip.split('.').every((part) => Number(part) <= 255);
  return v6.test(ip) && ip.includes(':');
}

/** How a block reads on the screen and in an email. */
export function describeBlock(block: { automatic: boolean; expiresAt: Date | string | null }): string {
  const who = block.automatic ? 'Added by the engine' : 'Added by an administrator';
  if (!block.expiresAt) return `${who} · until removed`;
  const until = typeof block.expiresAt === 'string' ? new Date(block.expiresAt) : block.expiresAt;
  return `${who} · until ${until.toUTCString()}`;
}
