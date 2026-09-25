// @vitest-environment jsdom
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/* ═══════════════════════════════════════════════════════════════════════════
   The Custom code screen
   ───────────────────────────────────────────────────────────────────────────
   This screen's job is half CSS box and half explanation. Somebody arrives
   here holding a `<script>` tag their analytics provider gave them, and if the
   screen simply lacks a box for it they will conclude the engine forgot — so
   the refusal has to be visible, and the thing they actually need (an id) has
   to be in front of them.

   The rest is the ordinary contract of an admin screen: a bad value never
   reaches the server, and the save button does not offer to send one.
   ═══════════════════════════════════════════════════════════════════════════ */

const store = vi.hoisted(() => ({
  loaded: null as unknown,
  api: vi.fn(),
}));

vi.mock('next/link', () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));
vi.mock('swr', () => ({ default: () => ({ data: store.loaded, isLoading: false, mutate: vi.fn() }) }));
vi.mock('@/lib/admin/client', () => ({
  api: store.api,
  fetcher: vi.fn(),
  ApiError: class ApiError extends Error {},
}));

const { CodeScreen } = await import('../../src/app/(system)/admin/(panel)/code/CodeScreen');

beforeEach(() => {
  store.loaded = { code: { css: '', analyticsId: '' } };
  store.api.mockReset();
  store.api.mockImplementation(async (_url: string, init: { json: { code: unknown } }) => ({ code: init.json.code }));
});

afterEach(cleanup);

const button = (root: HTMLElement, text: string) =>
  [...root.querySelectorAll('button')].find((b) => b.textContent?.trim() === text);

const cssBox = (root: HTMLElement) =>
  root.querySelector<HTMLTextAreaElement>('textarea[aria-label="Site-wide custom CSS"]')!;

describe('what the screen offers', () => {
  /* 2.16 — tags moved to Integrations, where each is an id and a switch and
     waits for consent. This screen is CSS, and says where the tags went. */
  it('points at Integrations for tags, rather than offering a script box', () => {
    const { container } = render(<CodeScreen canWrite />);
    expect(container.querySelector('a[href="/admin/integrations"]')).toBeTruthy();
    expect(container.textContent).toMatch(/cannot execute anything/i);
  });

  it('offers a CSS box and nothing else', () => {
    const { container } = render(<CodeScreen canWrite />);
    expect(cssBox(container)).toBeTruthy();
    expect(container.querySelectorAll('textarea')).toHaveLength(1);
    expect(container.querySelector('#analytics-id')).toBeNull();
  });

  it('gives a reader no editable fields', () => {
    const { container } = render(<CodeScreen canWrite={false} />);
    expect(cssBox(container).disabled).toBe(true);
    expect(button(container, 'Save')).toBeUndefined();
  });
});

describe('the CSS box', () => {
  it('warns when something would be stripped, without blocking the save', async () => {
    const { container } = render(<CodeScreen canWrite />);
    fireEvent.change(cssBox(container), { target: { value: "@import url('//x.example/a.css'); .a{}" } });

    await waitFor(() => expect(container.textContent).toContain('@import'));
    expect(button(container, 'Save')!.disabled).toBe(false);
  });

  it('leaves ordinary CSS unremarked', async () => {
    const { container } = render(<CodeScreen canWrite />);
    fireEvent.change(cssBox(container), { target: { value: '.promo { background: #101014 }' } });

    await waitFor(() => expect(button(container, 'Save')!.disabled).toBe(false));
    expect(container.textContent).not.toMatch(/are\s+removed when this is saved/);
  });
});
