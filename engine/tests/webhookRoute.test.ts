import { beforeEach, describe, expect, it, vi } from 'vitest';

/* 3.31 — the Webhooks API never hands a header value back, and the mask the
   screen returns keeps what is stored. The guard, the database and the audit
   log are stand-ins; the secrets code is the real one. */

const state = vi.hoisted(() => ({ stored: { hooks: [] as unknown[] }, written: null as null | { hooks: Record<string, unknown>[] } }));

vi.mock('@/server/api/guard', () => ({ requireUser: async () => ({ ok: true, user: { id: 'u1', email: 'a@example.com' } }) }));
vi.mock('@/server/auth/audit', () => ({ audit: async () => undefined }));
vi.mock('@/server/webhooks/deliver', () => ({ getWebhooks: async () => state.stored, recentDeliveries: async () => [] }));
vi.mock('@/server/db', () => ({
  db: {
    selectDistinct: () => ({ from: () => ({ orderBy: async () => [] }) }),
    insert: () => ({
      values: (row: { value: { hooks: Record<string, unknown>[] } }) => {
        state.written = row.value;
        return { onConflictDoUpdate: async () => undefined };
      },
    }),
  },
}));

const { GET, PUT } = await import('../src/app/api/admin/webhooks/route');
const { encryptSecret, decryptSecret, SECRET_MASK } = await import('@/server/security/secrets');

const id = '8f3c1a52-6b7d-4e8f-9a0b-1c2d3e4f5a6b';
const hid = '1f3c1a52-6b7d-4e8f-9a0b-1c2d3e4f5a6b';
const hook = (headers: unknown[], body: unknown = { mode: 'envelope', fields: [] }) => ({
  id,
  name: 'CRM',
  enabled: true,
  url: 'https://hooks.example.com/in',
  events: ['enquiry.received'],
  forms: [],
  secret: '',
  headers,
  body,
});
const put = (hooks: unknown[]) =>
  PUT(new Request('http://x/api/admin/webhooks', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ hooks }) }));
const storedValue = () => (state.written!.hooks[0]!.headers as { name: string; value: string }[])[0]!;

beforeEach(() => {
  state.stored = { hooks: [hook([{ id: hid, name: 'X-API-Key', value: encryptSecret('the-real-key') }])] };
  state.written = null;
});

describe('the webhooks API', () => {
  it('shows a mask for a stored header value, never the value or its ciphertext', async () => {
    const text = await (await GET(new Request('http://x/api/admin/webhooks'))).text();
    expect(text).not.toContain('the-real-key');
    expect(text).not.toContain('enc.v1');
    expect(JSON.parse(text).hooks[0].headers).toEqual([{ id: hid, name: 'X-API-Key', value: SECRET_MASK }]);
  });

  it('keeps the stored value when the mask comes back, even under a new name', async () => {
    const res = await put([hook([{ id: hid, name: 'X-Api-Token', value: SECRET_MASK }])]);
    expect(res.status).toBe(200);
    expect(storedValue().name).toBe('X-Api-Token');
    expect(decryptSecret(storedValue().value)).toBe('the-real-key');
    expect(await res.text()).not.toContain('the-real-key');
  });

  it('encrypts a new value before storing it', async () => {
    await put([hook([{ id: hid, name: 'X-API-Key', value: 'replaced' }])]);
    expect(storedValue().value.startsWith('enc.v1:')).toBe(true);
    expect(decryptSecret(storedValue().value)).toBe('replaced');
  });

  it('refuses a header with no value, an injected one, and a reserved name', async () => {
    expect((await put([hook([{ id: '2f3c1a52-6b7d-4e8f-9a0b-1c2d3e4f5a6b', name: 'X-New', value: SECRET_MASK }])])).status).toBe(400);
    expect((await put([hook([{ id: hid, name: 'X-API-Key', value: 'a\r\nX-Evil: 1' }])])).status).toBe(400);
    expect((await put([hook([{ id: hid, name: 'X-Engine-Signature', value: 'x' }])])).status).toBe(400);
    expect(state.written).toBeNull();
  });

  it('refuses a template that names a field the event does not have', async () => {
    const res = await put([hook([], { mode: 'custom', fields: [{ name: 'message', template: '{{mesage}}' }] })]);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('{{mesage}}');
  });
});
