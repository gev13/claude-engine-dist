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

const idBox = (root: HTMLElement) => root.querySelector<HTMLInputElement>('#analytics-id')!;

describe('what the screen offers', () => {
  it('says why there is no box for a script tag', () => {
    const { container } = render(<CodeScreen canWrite />);
    expect(container.textContent).toContain('<script>');
    expect(container.textContent).toMatch(/run code in every visitor/i);
  });

  it('offers a CSS box and a measurement id, and nothing else', () => {
    const { container } = render(<CodeScreen canWrite />);
    expect(cssBox(container)).toBeTruthy();
    expect(idBox(container)).toBeTruthy();
    expect(container.querySelectorAll('textarea')).toHaveLength(1);
  });

  it('gives a reader no editable fields', () => {
    const { container } = render(<CodeScreen canWrite={false} />);
    expect(cssBox(container).disabled).toBe(true);
    expect(idBox(container).disabled).toBe(true);
    expect(button(container, 'Save')).toBeUndefined();
  });
});

describe('the analytics id', () => {
  it('refuses a Universal Analytics id, which is the usual paste', async () => {
    const { container } = render(<CodeScreen canWrite />);
    fireEvent.change(idBox(container), { target: { value: 'UA-12345-1' } });

    await waitFor(() => expect(container.textContent).toContain('G-XXXXXXXXXX'));
    expect(button(container, 'Save')!.disabled).toBe(true);
    expect(store.api).not.toHaveBeenCalled();
  });

  it('accepts a GA4 id and sends it', async () => {
    const { container } = render(<CodeScreen canWrite />);
    fireEvent.change(idBox(container), { target: { value: 'g-abcd1234' } });

    // Uppercased as it is typed, so what is shown is what is stored.
    await waitFor(() => expect(idBox(container).value).toBe('G-ABCD1234'));

    fireEvent.click(button(container, 'Save')!);
    await waitFor(() => expect(store.api).toHaveBeenCalledTimes(1));
    expect(store.api.mock.calls[0][1].json.code.analyticsId).toBe('G-ABCD1234');
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
