import 'server-only';
import argon2 from 'argon2';

/**
 * argon2id with OWASP's recommended second-choice parameters
 * (19 MiB memory, t=2, p=1). Tuned so a login stays under ~100ms on a
 * modest server while remaining expensive to attack offline.
 */
const OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, { ...OPTIONS, raw: false });
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}

/** True when the stored hash was made with weaker parameters than current. */
export function needsRehash(hash: string): boolean {
  try {
    return argon2.needsRehash(hash, OPTIONS);
  } catch {
    return true;
  }
}

/* ── Password policy ──────────────────────────────────────────────────────── */

const COMMON = new Set([
  'password', 'password1', 'password123', '12345678', '123456789', 'qwerty123',
  'letmein', 'welcome1', 'admin123', 'iloveyou', 'changeme', 'passw0rd',
]);

export type PolicyResult = { ok: true } | { ok: false; reason: string };

/**
 * Length-first policy: 12 characters minimum, three of four character
 * classes, no obvious common password, nothing containing the user's own
 * identifiers. Deliberately not a "must contain a symbol" rule.
 */
export function checkPasswordPolicy(
  password: string,
  context: { email?: string; username?: string } = {},
): PolicyResult {
  if (password.length < 12) return { ok: false, reason: 'Password must be at least 12 characters.' };
  if (password.length > 200) return { ok: false, reason: 'Password must be 200 characters or fewer.' };

  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter((r) => r.test(password)).length;
  if (classes < 3) {
    return {
      ok: false,
      reason: 'Use at least three of: lowercase, uppercase, numbers, symbols.',
    };
  }

  const lower = password.toLowerCase();
  if (COMMON.has(lower)) return { ok: false, reason: 'That password is too common.' };

  for (const value of [context.email?.split('@')[0], context.username]) {
    if (value && value.length >= 3 && lower.includes(value.toLowerCase())) {
      return { ok: false, reason: 'Password must not contain your email or username.' };
    }
  }

  if (/^(.)\1+$/.test(password)) return { ok: false, reason: 'Password must not be a single repeated character.' };

  return { ok: true };
}
