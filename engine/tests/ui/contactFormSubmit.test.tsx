// @vitest-environment jsdom
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { blockSchemas } from '@/lib/blocks';

/* 3.31 — the contact form read its fields from `e.currentTarget` after
   awaiting the CAPTCHA token, by which time React has cleared it: every
   press of Send threw in the browser and nothing reached /api/enquiries.
   The token is async even with no CAPTCHA, so this is the ordinary case. */

vi.mock('next/navigation', () => ({ usePathname: () => '/contact' }));
vi.mock('@/components/site/Messages', () => ({ useMessages: () => (key: string) => key }));
vi.mock('@/components/site/Captcha', () => ({ useChallenge: () => ({ field: null, token: async () => '', reset: () => {} }) }));
vi.mock('@/components/site/formActions', () => ({ afterSubmit: () => {} }));

const { ContactFormClient } = await import('@/components/blocks/ContactFormBlock');

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('the contact form', () => {
  it('sends what was typed after the CAPTCHA step', async () => {
    const fetch = vi.fn(async () => new Response('{}', { status: 201 }));
    vi.stubGlobal('fetch', fetch);
    const { container } = render(<ContactFormClient {...blockSchemas.contactForm.parse({})} serviceOptions={['Design', 'Engineering']} />);
    const set = (name: string, value: string) => fireEvent.change(container.querySelector(`[name="${name}"]`)!, { target: { value } });
    set('name', 'Ana');
    set('email', 'ana@example.com');
    set('company', 'Acme');
    set('message', 'Hello');
    fireEvent.click(container.querySelector('input[name="services"][value="Design"]')!);
    fireEvent.submit(container.querySelector('form')!);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/enquiries');
    expect(JSON.parse(String(init.body))).toMatchObject({ name: 'Ana', email: 'ana@example.com', company: 'Acme', message: 'Hello', services: ['Design'] });
  });
});
