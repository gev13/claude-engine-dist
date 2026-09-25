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
