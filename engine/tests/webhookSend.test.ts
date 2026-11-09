import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/* 3.31 — what actually goes on the wire, and what comes back into the log.
   `node:https` is replaced, so nothing here leaves the machine: each request
   records its headers and body and is answered with whatever the test set. */

const wire = vi.hoisted(() => ({
  sent: [] as { headers: Record<string, string>; body: string }[],
  answer: { status: 200, type: 'application/json', chunks: ['{}'] as string[] },
}));

vi.mock('node:https', () => ({
  request: (_url: unknown, options: { headers: Record<string, string> }, onResponse: (res: unknown) => void) => {
    const req = new EventEmitter() as EventEmitter & { end: (body: string) => void; destroy: (e?: Error) => void };
    req.destroy = (error) => error && req.emit('error', error);
    req.end = (body) => {
      wire.sent.push({ headers: options.headers, body });
      const res = Object.assign(Readable.from(wire.answer.chunks.map((c) => Buffer.from(c))), {
        statusCode: wire.answer.status,
        headers: { 'content-type': wire.answer.type },
      });
      onResponse(res);
    };
    return req;
  },
}));
vi.mock('@/server/db', () => ({ db: {} }));

const { postPublic, answerSnippet } = await import('@/server/security/outbound');
const { buildBody, buildHeaders } = await import('@/server/webhooks/deliver');
const { encryptSecret } = await import('@/server/security/secrets');
const { webhookSchema } = await import('@/lib/webhooks');

beforeEach(() => {
  wire.sent = [];
  wire.answer = { status: 200, type: 'application/json', chunks: ['{}'] };
});

// A public literal address, so the vetted lookup is never asked.
const URL_ = 'https://8.8.8.8/in';

describe('the request', () => {
  it('keeps the framing headers its own whatever the caller passes', async () => {
    await postPublic(URL_, '{"a":1}', { 'X-API-Key': 'k', 'Content-Type': 'text/plain', 'content-length': '1', Host: 'evil' });
    const { headers } = wire.sent[0]!;
    expect(headers['X-API-Key']).toBe('k');
    expect(headers['content-type']).toBe('application/json');
    expect(headers['content-length']).toBe('7');
    expect(Object.keys(headers).map((k) => k.toLowerCase()).filter((k) => k === 'content-type' || k === 'content-length' || k === 'host')).toEqual([
      'content-type',
      'content-length',
    ]);
  });

  it('keeps nothing from a success, and the reason from a refusal', async () => {
    expect(await postPublic(URL_, '{}', {})).toEqual({ ok: true, status: 200 });
    wire.answer = { status: 422, type: 'application/json', chunks: ['{"error":"message must be at least 50 characters",', '\n  "field":"message"}'] };
    expect(await postPublic(URL_, '{}', {})).toEqual({
      ok: false,
      status: 422,
      error: 'The receiver answered 422.',
      body: '{"error":"message must be at least 50 characters", "field":"message"}',
    });
  });

  it('cuts a long answer short and reads an HTML error page as text', async () => {
    wire.answer = { status: 500, type: 'text/html', chunks: ['<html><style>p{}</style><h1>Oops</h1><p>Spam filter said no</p>', 'x'.repeat(10_000)] };
    const result = await postPublic(URL_, '{}', {}, 10_000, 40);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.body!.startsWith('Oops Spam filter said no')).toBe(true);
      expect(result.body!.length).toBe(40);
    }
    expect(answerSnippet(Buffer.from('a\r\nb\u0000c'), 'text/plain', 100)).toBe('a b c');
  });
});

describe('a hook’s delivery', () => {
  const hook = webhookSchema.parse({
    id: '8f3c1a52-6b7d-4e8f-9a0b-1c2d3e4f5a6b',
    name: 'CRM',
    url: URL_,
    events: ['enquiry.received'],
    headers: [{ id: '1f3c1a52-6b7d-4e8f-9a0b-1c2d3e4f5a6b', name: 'X-API-Key', value: encryptSecret('live-key-123') }],
    body: { mode: 'custom', fields: [{ name: 'name', template: '{{name}}' }, { name: 'message', template: '{{message}} ({{company}})' }] },
  });
  const payload = { event: 'enquiry.received' as const, data: { name: 'Ana', message: 'Hello', company: 'Acme' } };

  it('sends the decrypted header and no signature when there is no secret', () => {
    const body = buildBody(hook, 'd1', payload);
    expect(JSON.parse(body)).toEqual({ name: 'Ana', message: 'Hello (Acme)' });
    const headers = buildHeaders(hook, 'enquiry.received', 'd1', '1700000000', body);
    expect(headers['X-API-Key']).toBe('live-key-123');
    expect(headers).not.toHaveProperty('x-engine-signature');
    expect(headers['x-engine-event']).toBe('enquiry.received');
  });

  it('signs the custom body when a secret is set, and an envelope hook is unchanged', () => {
    const signed = { ...hook, secret: encryptSecret('s') };
    const body = buildBody(signed, 'd1', payload);
    expect(buildHeaders(signed, 'enquiry.received', 'd1', '1', body)['x-engine-signature']).toMatch(/^sha256=[0-9a-f]{64}$/);
    const envelope = JSON.parse(buildBody({ body: { mode: 'envelope', fields: [], replace: [] } }, 'd1', payload));
    expect(envelope).toMatchObject({ id: 'd1', event: 'enquiry.received', data: payload.data });
  });

  it('swaps text inside the values it sends, not in the template (3.31.1)', () => {
    const swapped = { ...hook, body: { ...hook.body, replace: [{ find: ' & ', to: ' and ' }] } };
    const body = buildBody(swapped, 'd1', { event: 'enquiry.received', data: { name: 'A & B', message: 'R&D & more', company: 'X & Y' } });
    expect(JSON.parse(body)).toEqual({ name: 'A and B', message: 'R&D and more (X and Y)' });
  });

  it('leaves out a header whose value no longer decrypts rather than sending ciphertext', () => {
    const broken = { ...hook, headers: [{ ...hook.headers[0]!, value: 'enc.v1:AAAA:BBBB:CCCC' }] };
    expect(buildHeaders(broken, 'enquiry.received', 'd1', '1', '{}')).not.toHaveProperty('X-API-Key');
  });
});
