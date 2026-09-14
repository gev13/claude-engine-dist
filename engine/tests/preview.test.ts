import { describe, expect, it } from 'vitest';
import {
  PREVIEW_TTL_SECONDS,
  createPreviewToken,
  verifyPreviewToken,
} from '@/server/content/preview';

const target = { entityType: 'page', entityId: '11111111-1111-1111-1111-111111111111' } as const;

describe('preview tokens', () => {
  it('round-trips the thing it was minted for', () => {
    const result = verifyPreviewToken(createPreviewToken(target));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.target).toEqual(target);
      expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
    }
  });

  it('refuses a token whose payload has been edited', () => {
    const token = createPreviewToken(target);
    const [payload, signature] = token.split('.');
    const tampered = Buffer.from(
      Buffer.from(payload!, 'base64url').toString('utf8').replace('1111', '2222'),
    ).toString('base64url');

    const result = verifyPreviewToken(`${tampered}.${signature}`);
    expect(result).toEqual({ ok: false, reason: 'bad_signature' });
  });

  it('refuses a forged signature', () => {
    const token = createPreviewToken(target);
    const [payload] = token.split('.');
    expect(verifyPreviewToken(`${payload}.notarealsignature`)).toEqual({
      ok: false,
      reason: 'bad_signature',
    });
  });

  it('refuses an expired token', () => {
    expect(verifyPreviewToken(createPreviewToken(target, -60))).toEqual({
      ok: false,
      reason: 'expired',
    });
  });

  it('refuses junk rather than throwing', () => {
    for (const junk of ['', 'x', 'a.b.c', '....', 'not-base64!.sig']) {
      const result = verifyPreviewToken(junk);
      expect(result.ok, junk).toBe(false);
    }
  });

  it('cannot be used to name an entity type that does not exist', () => {
    const payload = Buffer.from('user.11111111-1111-1111-1111-111111111111.99999999999').toString(
      'base64url',
    );
    expect(verifyPreviewToken(`${payload}.anything`).ok).toBe(false);
  });

  it('expires within a week', () => {
    expect(PREVIEW_TTL_SECONDS).toBeLessThanOrEqual(7 * 24 * 3600);
  });
});
