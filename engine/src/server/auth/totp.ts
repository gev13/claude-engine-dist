import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { generateSecret, generateURI, verify } from 'otplib';
import { env } from '@/lib/env';

/**
 * TOTP, RFC 6238, 6 digits on a 30-second step — what Google Authenticator,
 * 1Password, Authy and friends all expect. A ±30s tolerance absorbs clock
 * skew without meaningfully widening the window for an attacker.
 */
const EPOCH_TOLERANCE_SECONDS = 30;

export function generateTotpSecret(): string {
  return generateSecret({ length: 20 });
}

export function totpUri(secret: string, accountEmail: string): string {
  return generateURI({
    strategy: 'totp',
    issuer: env.AUTH_TOTP_ISSUER,
    label: accountEmail,
    secret,
  });
}

export async function verifyTotp(secret: string, token: string): Promise<boolean> {
  const cleaned = token.replace(/\s+/g, '');
  if (!/^\d{6}$/.test(cleaned)) return false;
  try {
    const result = await verify({
      strategy: 'totp',
      secret,
      token: cleaned,
      epochTolerance: EPOCH_TOLERANCE_SECONDS,
    });
    return result.valid;
  } catch {
    return false;
  }
}

/* ── Recovery codes ───────────────────────────────────────────────────────── */

function hashCode(code: string) {
  return createHash('sha256').update(code.toUpperCase().replace(/[^A-Z0-9]/g, '')).digest('hex');
}

/** Ten single-use codes. The plaintext is shown once and never stored. */
export function generateRecoveryCodes(count = 10): { plain: string[]; hashed: string[] } {
  const plain: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const raw = randomBytes(5).toString('hex').toUpperCase(); // 10 chars
    plain.push(`${raw.slice(0, 5)}-${raw.slice(5)}`);
  }
  return { plain, hashed: plain.map(hashCode) };
}

/** Returns the remaining hashes with the matched one removed, or null. */
export function consumeRecoveryCode(stored: string[], candidate: string): string[] | null {
  const target = hashCode(candidate);
  const index = stored.indexOf(target);
  if (index === -1) return null;
  return stored.filter((_, i) => i !== index);
}
