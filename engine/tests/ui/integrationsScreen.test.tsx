// @vitest-environment jsdom
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultIntegrations } from '@/lib/integrations';

/* ═══════════════════════════════════════════════════════════════════════════
   Settings → Integrations (2.16)
   ───────────────────────────────────────────────────────────────────────────
   An id that is not the vendor's shape never reaches the server; custom
   scripts stay out of sight until an administrator allows them; and the
   screen says whether tags will wait for consent.
   ═══════════════════════════════════════════════════════════════════════════ */

const store = vi.hoisted(() => ({ loaded: null as unknown, api: vi.fn() }));
vi.mock('swr', () => ({ default: () => ({ data: store.loaded, isLoading: false, mutate: vi.fn() }) }));
vi.mock('@/lib/admin/client', () => ({ api: store.api, fetcher: vi.fn(), ApiError: class ApiError extends Error {} }));
vi.mock('@/components/admin/useToast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('next/link', () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));

const { IntegrationsScreen } = await import('../../src/app/(system)/admin/(panel)/integrations/IntegrationsScreen');

beforeEach(() => {
  store.loaded = { integrations: defaultIntegrations() };
  store.api.mockReset();
  store.api.mockImplementation(async (_url: string, init: { json: { integrations: unknown } }) => ({ integrations: init.json.integrations }));
});
afterEach(cleanup);

const save = (root: HTMLElement) => [...root.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Save')!;
const switchOn = (root: HTMLElement, panel: string) => {
  const section = [...root.querySelectorAll('section, div')].find((el) => el.querySelector('h2, h3')?.textContent === panel)!;
  fireEvent.click(section.querySelector<HTMLInputElement>('input[type="checkbox"]')!);
};

describe('the integrations screen', () => {
  it('says tags load on every visit when the notice is not asking for consent', () => {
    const { container } = render(<IntegrationsScreen consentMode={false} />);
    expect(container.textContent).toMatch(/every tag switched on here loads on every visit/);
  });

  it('refuses an id that is not the vendor’s shape', async () => {
    const { container } = render(<IntegrationsScreen consentMode />);
    fireEvent.change(container.querySelector('#int-meta')!, { target: { value: 'not-a-pixel' } });
    switchOn(container, 'Meta Pixel');
    await waitFor(() => expect(container.textContent).toContain('does not look like a Meta Pixel id'));
    expect(save(container).disabled).toBe(true);
  });

  it('sends a valid id with its switch and category', async () => {
    const { container } = render(<IntegrationsScreen consentMode />);
    fireEvent.change(container.querySelector('#int-gtm')!, { target: { value: 'gtm-abc1234' } });
    switchOn(container, 'Google Tag Manager');
    await waitFor(() => expect(save(container).disabled).toBe(false));
    fireEvent.click(save(container));
    await waitFor(() => expect(store.api).toHaveBeenCalled());
    expect(store.api.mock.calls[0][1].json.integrations.gtm).toMatchObject({ enabled: true, id: 'GTM-ABC1234', category: 'analytics' });
  });

  it('keeps custom scripts out of sight until they are allowed', () => {
    const { container } = render(<IntegrationsScreen consentMode />);
    expect(container.textContent).not.toContain('+ Add a script');
    const allow = [...container.querySelectorAll('label')].find((l) => l.textContent?.includes('Allow custom scripts'))!;
    fireEvent.click(allow.querySelector('input')!);
    expect(container.textContent).toContain('+ Add a script');
  });
});
