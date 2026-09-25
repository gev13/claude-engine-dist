import { describe, expect, it } from 'vitest';
import { getPublic } from '@/server/security/outbound';

/* 2.20 — the WordPress importer reads addresses an administrator typed, so
   its GET is held to the webhook's rule: nothing on the private network. */

describe('a public GET', () => {
  it('refuses the private network however it is named', async () => {
    for (const url of ['http://127.0.0.1/', 'http://[::1]/', 'http://169.254.169.254/latest/meta-data', 'http://10.0.0.5/']) {
      const res = await getPublic(url, { timeoutMs: 2000 });
      expect(res.ok, url).toBe(false);
    }
    const byName = await getPublic('http://localhost:9/', { timeoutMs: 2000 });
    expect(byName).toMatchObject({ ok: false, error: expect.stringMatching(/not on the public internet/) });
  });

  it('reads only http and https, and no address with a password in it', async () => {
    expect(await getPublic('file:///etc/passwd')).toMatchObject({ ok: false });
    expect(await getPublic('ftp://example.com/')).toMatchObject({ ok: false });
    expect(await getPublic('https://user:pass@example.com/')).toMatchObject({ ok: false, error: expect.stringMatching(/password/) });
  });
});
