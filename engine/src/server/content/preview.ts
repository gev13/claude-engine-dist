import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '@/lib/env';

/* ═══════════════════════════════════════════════════════════════════════════
   Draft previews
   ───────────────────────────────────────────────────────────────────────────
   A signed, expiring token that renders one unpublished page or post. It lives
   on its own route rather than as a `?preview=` parameter on the public one:
   reading a search parameter in the catch-all would opt every request into
   dynamic rendering and take ISR down with it.

   The token proves only "somebody with admin access minted this, for this one
   item, before this time". It is not a session, it grants nothing else, and it
   is signed with the access secret so revoking that revokes every outstanding
   preview link.
   ═══════════════════════════════════════════════════════════════════════════ */

export type PreviewTarget = { entityType: 'page' | 'post' | 'project'; entityId: string };

/** Long enough to send to a client and hear back; short enough to expire. */
export const PREVIEW_TTL_SECONDS = 7 * 24 * 3600;

function sign(payload: string): string {
  return createHmac('sha256', env.AUTH_ACCESS_SECRET).update(payload).digest('base64url');
}

export function createPreviewToken(target: PreviewTarget, ttlSeconds = PREVIEW_TTL_SECONDS): string {
  const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `${target.entityType}.${target.entityId}.${expires}`;
  return `${Buffer.from(payload).toString('base64url')}.${sign(payload)}`;
}

export type PreviewResult =
  | { ok: true; target: PreviewTarget; expiresAt: Date }
  | { ok: false; reason: 'malformed' | 'bad_signature' | 'expired' };

export function verifyPreviewToken(token: string): PreviewResult {
  const parts = token.split('.');
  if (parts.length !== 2) return { ok: false, reason: 'malformed' };

  let payload: string;
  try {
    payload = Buffer.from(parts[0]!, 'base64url').toString('utf8');
  } catch {
    return { ok: false, reason: 'malformed' };
  }

  const fields = payload.split('.');
  if (fields.length !== 3) return { ok: false, reason: 'malformed' };

  const [entityType, entityId, expiresRaw] = fields as [string, string, string];
  if (entityType !== 'page' && entityType !== 'post' && entityType !== 'project') return { ok: false, reason: 'malformed' };

  // Constant-time, and length-checked first because timingSafeEqual throws on
  // a length mismatch rather than returning false.
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(parts[1]!);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    return { ok: false, reason: 'bad_signature' };
  }

  const expires = Number(expiresRaw);
  if (!Number.isFinite(expires)) return { ok: false, reason: 'malformed' };
  if (expires * 1000 <= Date.now()) return { ok: false, reason: 'expired' };

  return { ok: true, target: { entityType, entityId }, expiresAt: new Date(expires * 1000) };
}

export function previewPath(token: string): string {
  return `/preview/${token}`;
}
