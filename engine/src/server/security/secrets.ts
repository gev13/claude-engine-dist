import 'server-only';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { env } from '@/lib/env';

/* ═══════════════════════════════════════════════════════════════════════════
   Secrets kept in settings rows
   ───────────────────────────────────────────────────────────────────────────
   Settings are jsonb, and the settings API hands whole rows to the admin
   browser. A few values — the SMTP password today — must never make that
   trip, so they are encrypted here before they are stored and decrypted only
   on the server at the moment they are used.

   AES-256-GCM: the tag makes tampering detectable, so a value that has been
   altered in the database fails to decrypt rather than being trusted.
   ═══════════════════════════════════════════════════════════════════════════ */

/** What the editor sees in place of a stored secret. Never a real value. */
export const SECRET_MASK = '••••••••';

const PREFIX = 'enc.v1';

/**
 * The key is derived, not used raw: `SETTINGS_SECRET` when it is set, else the
 * access secret, so an existing installation needs no new environment value.
 * Changing either makes stored secrets undecryptable — they are re-entered,
 * which is the honest failure for a credential.
 */
function key(): Buffer {
  const material = env.SETTINGS_SECRET || env.AUTH_ACCESS_SECRET;
  return scryptSync(material, 'engine.settings.secret.v1', 32);
}

/** `enc.v1:<iv>:<tag>:<ciphertext>`, all base64url. */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [PREFIX, iv.toString('base64url'), tag.toString('base64url'), body.toString('base64url')].join(':');
}

export function isEncrypted(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(`${PREFIX}:`);
}

/** The plain value, or null when it is missing, not ours, or has been tampered with. */
export function decryptSecret(stored: unknown): string | null {
  if (!isEncrypted(stored)) return null;
  const [, ivPart, tagPart, bodyPart] = stored.split(':');
  if (!ivPart || !tagPart || !bodyPart) return null;
  try {
    const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(ivPart, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(bodyPart, 'base64url')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

/**
 * What to store when an editor saves a form that shows a mask: the incoming
 * value when they typed a new one, the existing ciphertext when they left the
 * mask alone, and nothing when they cleared the field.
 */
export function nextSecret(incoming: string | undefined, existing: unknown): string {
  if (incoming === undefined || incoming === SECRET_MASK) return isEncrypted(existing) ? existing : '';
  if (incoming === '') return '';
  return encryptSecret(incoming);
}

/** Constant-time compare for short tokens that are not password hashes. */
export function sameToken(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
