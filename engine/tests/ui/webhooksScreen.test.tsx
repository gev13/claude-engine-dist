// @vitest-environment jsdom
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { captchaSettingsSchema } from '@/lib/captcha';

/* ═══════════════════════════════════════════════════════════════════════════
   Webhooks and Bot protection (2.16)
   ───────────────────────────────────────────────────────────────────────────
   Two screens that hold a secret: neither ever puts the stored one in the
   page, and neither sends one back unless somebody typed a new one.
   ═══════════════════════════════════════════════════════════════════════════ */

const store = vi.hoisted(() => ({ loaded: null as unknown, api: vi.fn() }));
vi.mock('swr', () => ({ default: () => ({ data: store.loaded, isLoading: false, mutate: vi.fn() }) }));
vi.mock('@/lib/admin/client', () => ({ api: store.api, fetcher: vi.fn(), ApiError: class ApiError extends Error {} }));
vi.mock('@/components/admin/useToast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('next/link', () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));

const { WebhooksScreen } = await import('../../src/app/(system)/admin/(panel)/webhooks/WebhooksScreen');
const { BotProtectionPanel } = await import('../../src/app/(system)/admin/(panel)/security/BotProtectionPanel');

const MASK = '••••••••';
const hook = {
  id: '8f3c1a52-6b7d-4e8f-9a0b-1c2d3e4f5a6b',
  name: 'CRM',
  enabled: true,
  url: 'https://hooks.example.com/in',
  events: ['form.submitted'],
  forms: [],
  secret: MASK,
};

beforeEach(() => store.api.mockReset());
afterEach(cleanup);

const button = (root: HTMLElement, label: string) => [...root.querySelectorAll('button')].find((b) => b.textContent?.trim() === label)!;

describe('the webhooks screen', () => {
  beforeEach(() => {
    store.loaded = {
      hooks: [hook],
      forms: ['Contact'],
      deliveries: [
        { id: 'd1', webhookName: 'CRM', event: 'form.submitted', targetId: 't1', status: 'failed', attempts: 3, responseCode: 500, error: 'The receiver answered 500.', createdAt: new Date().toISOString() },
      ],
    };
    store.api.mockImplementation(async (_url: string, init?: { json: { hooks: unknown } }) => ({ hooks: init?.json.hooks }));
  });

  it('shows a mask where a secret is stored, and the delivery log with a Resend', () => {
    const { container } = render(<WebhooksScreen />);
    const secret = container.querySelector<HTMLInputElement>(`#wh-secret-${hook.id}`)!;
    expect(secret.type).toBe('password');
    expect(secret.value).toBe(MASK);
    expect(container.textContent).toContain('The receiver answered 500.');
    expect(button(container, 'Resend')).toBeTruthy();
  });

  it('refuses an address that is not https', async () => {
    const { container } = render(<WebhooksScreen />);
    fireEvent.change(container.querySelector(`#wh-url-${hook.id}`)!, { target: { value: 'http://hooks.example.com' } });
    await waitFor(() => expect(container.textContent).toContain('An https:// address'));
    expect(button(container, 'Save').disabled).toBe(true);
  });

  it('sends the mask back untouched, so the stored secret is kept', async () => {
    const { container } = render(<WebhooksScreen />);
    fireEvent.change(container.querySelector(`#wh-name-${hook.id}`)!, { target: { value: 'CRM (sales)' } });
    await waitFor(() => expect(button(container, 'Save').disabled).toBe(false));
    fireEvent.click(button(container, 'Save'));
    await waitFor(() => expect(store.api).toHaveBeenCalled());
    expect(store.api.mock.calls[0][1].json.hooks[0]).toMatchObject({ name: 'CRM (sales)', secret: MASK });
  });
});

describe('a webhook’s headers and body (3.31)', () => {
  const hid = '1f3c1a52-6b7d-4e8f-9a0b-1c2d3e4f5a6b';
  const withParts = (patch: Record<string, unknown>) => {
    store.loaded = {
      hooks: [{ ...hook, events: ['enquiry.received'], headers: [{ id: hid, name: 'X-API-Key', value: MASK }], body: { mode: 'envelope', fields: [] }, ...patch }],
      forms: [],
      deliveries: [
        {
          id: 'd2',
          webhookName: 'CRM',
          event: 'enquiry.received',
          targetId: 't2',
          status: 'failed',
          attempts: 3,
          responseCode: 422,
          error: 'The receiver answered 422.',
          responseBody: '{"error":"message must be at least 50 characters"}',
          createdAt: new Date().toISOString(),
        },
      ],
    };
    store.api.mockImplementation(async (_url: string, init?: { json: { hooks: unknown } }) => ({ hooks: init?.json.hooks }));
  };

  it('shows a stored header value as empty with a note, never the mask in the box', () => {
    withParts({});
    const { container } = render(<WebhooksScreen />);
    const value = container.querySelector<HTMLInputElement>(`#wh-hvalue-${hid}`)!;
    expect(value.type).toBe('password');
    expect(value.value).toBe('');
    expect(value.placeholder).toBe(MASK);
    expect(container.textContent).toContain('a value is stored — type a new one to replace it');
    expect(container.querySelector<HTMLInputElement>(`#wh-hname-${hid}`)!.value).toBe('X-API-Key');
  });

  it('sends the mask back when the value was left alone, or emptied again', async () => {
    withParts({});
    const { container } = render(<WebhooksScreen />);
    const value = container.querySelector(`#wh-hvalue-${hid}`)!;
    fireEvent.change(value, { target: { value: 'typed' } });
    fireEvent.change(value, { target: { value: '' } });
    fireEvent.change(container.querySelector(`#wh-name-${hook.id}`)!, { target: { value: 'CRM 2' } });
    await waitFor(() => expect(button(container, 'Save').disabled).toBe(false));
    fireEvent.click(button(container, 'Save'));
    await waitFor(() => expect(store.api).toHaveBeenCalled());
    expect(store.api.mock.calls[0][1].json.hooks[0].headers).toEqual([{ id: hid, name: 'X-API-Key', value: MASK }]);
  });

  it('will not save a header the engine sets itself', async () => {
    withParts({});
    const { container } = render(<WebhooksScreen />);
    fireEvent.change(container.querySelector(`#wh-hname-${hid}`)!, { target: { value: 'X-Engine-Signature' } });
    await waitFor(() => expect(container.textContent).toContain('The engine sets that header itself'));
    expect(button(container, 'Save').disabled).toBe(true);
  });

  it('lists the event’s fields, previews a custom body and refuses an unknown field', async () => {
    withParts({ body: { mode: 'custom', fields: [{ name: 'message', template: '{{message}} — {{company}}' }] } });
    const { container } = render(<WebhooksScreen />);
    for (const key of ['{{name}}', '{{email}}', '{{company}}', '{{services}}', '{{timing}}']) expect(container.textContent).toContain(key);
    expect(container.querySelector('pre')!.textContent).toContain('"message": "A test from the Webhooks screen — not a real enquiry. — Example Ltd"');
    fireEvent.change(container.querySelector(`#wh-ftpl-${hook.id}-0`)!, { target: { value: '{{mesage}}' } });
    await waitFor(() => expect(container.textContent).toContain('{{mesage}} is not a field of the chosen event'));
    expect(button(container, 'Save').disabled).toBe(true);
  });

  it('adds a replacement and shows it in the preview (3.31.1)', async () => {
    withParts({ events: ['form.submitted'], body: { mode: 'custom', fields: [{ name: 'message', template: 'Q & A: {{answers.message}}' }], replace: [] } });
    const { container } = render(<WebhooksScreen />);
    fireEvent.click(button(container, 'Add a replacement'));
    await waitFor(() => expect(container.querySelector<HTMLInputElement>(`#wh-rfind-${hook.id}-0`)!.value).toBe(' & '));
    fireEvent.change(container.querySelector(`#wh-rfind-${hook.id}-0`)!, { target: { value: 'Webhooks' } });
    fireEvent.change(container.querySelector(`#wh-rto-${hook.id}-0`)!, { target: { value: 'W' } });
    await waitFor(() => expect(container.querySelector('pre')!.textContent).toContain('"message": "Q & A: A test from the W screen'));
    fireEvent.click(button(container, 'Save'));
    await waitFor(() => expect(store.api).toHaveBeenCalled());
    expect(store.api.mock.calls[0][1].json.hooks[0].body.replace).toEqual([{ find: 'Webhooks', to: 'W' }]);
  });

  it('shows what a refusing receiver said in the log', () => {
    withParts({});
    const { container } = render(<WebhooksScreen />);
    expect(container.textContent).toContain('It said: {"error":"message must be at least 50 characters"}');
  });
});

describe('bot protection', () => {
  it('never shows the stored secret, and says so', () => {
    store.loaded = {
      captcha: captchaSettingsSchema.parse({ provider: 'turnstile', siteKey: '1x00000000000000000000AA' }),
      secretSet: true,
      thirdParties: [{ name: 'Cloudflare Turnstile', hosts: ['https://challenges.cloudflare.com'] }],
    };
    const { container } = render(<BotProtectionPanel />);
    const secret = container.querySelector<HTMLInputElement>('#captcha-secret')!;
    expect(secret.type).toBe('password');
    expect(secret.value).toBe(MASK);
    expect(container.textContent).toContain('one is saved');
    expect(container.textContent).toContain('https://challenges.cloudflare.com');
  });

  it('sends no secret when none was typed', async () => {
    store.loaded = { captcha: captchaSettingsSchema.parse({ provider: 'turnstile', siteKey: '1x00000000000000000000AA' }), secretSet: true, thirdParties: [] };
    store.api.mockResolvedValue(store.loaded);
    const { container } = render(<BotProtectionPanel />);
    fireEvent.click(button(container, 'Save'));
    await waitFor(() => expect(store.api).toHaveBeenCalled());
    expect(store.api.mock.calls[0][1].json).not.toHaveProperty('secret');
  });

  it('says there are no third parties when there are none', () => {
    store.loaded = { captcha: captchaSettingsSchema.parse({}), secretSet: false, thirdParties: [] };
    const { container } = render(<BotProtectionPanel />);
    expect(container.textContent).toContain('Pages load nothing from another company’s servers');
    expect(container.querySelector('#captcha-secret')).toBeNull();
  });
});
