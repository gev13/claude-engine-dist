// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PERMALINKS } from '@/lib/permalinks';

/* ═══════════════════════════════════════════════════════════════════════════
   Settings → Permalinks
   ───────────────────────────────────────────────────────────────────────────
   The screen's promise is that nobody moves a live blog by accident: every
   field shows the address it produces, a change is checked before it can be
   saved, and a change that moves published posts offers — ticked — to write
   a 301 from each old address.
   ═══════════════════════════════════════════════════════════════════════════ */

const store = vi.hoisted(() => ({ loaded: null as unknown, api: vi.fn() }));

vi.mock('swr', () => ({ default: () => ({ data: store.loaded, isLoading: false, mutate: vi.fn() }) }));
vi.mock('@/lib/admin/client', () => ({ api: store.api, fetcher: vi.fn(), ApiError: class ApiError extends Error {} }));
vi.mock('@/components/admin/useToast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

const { PermalinksScreen } = await import('../../src/app/(system)/admin/(panel)/permalinks/PermalinksScreen');

beforeEach(() => {
  store.loaded = { permalinks: DEFAULT_PERMALINKS };
  store.api.mockReset();
  store.api.mockImplementation(async (_url: string, init: { method: string; json: { permalinks: unknown } }) =>
    init.method === 'POST'
      ? { problems: [], moved: 2, sample: [{ from: '/blog/a', to: '/news/a' }] }
      : { permalinks: init.json.permalinks, redirectsCreated: 2 },
  );
});

afterEach(cleanup);

const saveButton = (root: HTMLElement) => [...root.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Save')!;

describe('the permalinks screen', () => {
  it('shows what each pattern makes, from today’s defaults', () => {
    const { container } = render(<PermalinksScreen />);
    expect(container.textContent).toContain('/blog/hello-world');
    expect(container.textContent).toContain('/news/hello-world');
    expect(container.textContent).toContain('/hello-world');
    expect(saveButton(container).disabled).toBe(true);
  });

  it('checks a change before saving, and offers the redirects ticked', async () => {
    vi.useFakeTimers();
    const { container } = render(<PermalinksScreen />);
    fireEvent.change(container.querySelector('#pl-index')!, { target: { value: '/news' } });
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    vi.useRealTimers();

    await waitFor(() => expect(container.textContent).toContain('2 addresses will change'));
    const box = [...container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].find((input) =>
      input.parentElement?.textContent?.includes('Create 301s'),
    )!;
    expect(box.checked).toBe(true);

    fireEvent.click(saveButton(container));
    await waitFor(() => expect(store.api).toHaveBeenCalledWith('/api/admin/permalinks', expect.objectContaining({ method: 'PUT' })));
    const put = store.api.mock.calls.find(([, init]) => init.method === 'PUT')![1];
    expect(put.json).toMatchObject({ createRedirects: true, permalinks: { blogIndex: '/news' } });
  });

  it('will not save while the change collides with something', async () => {
    store.api.mockImplementation(async () => ({ problems: ['The page /category/x has the same address'], moved: 0, sample: [] }));
    vi.useFakeTimers();
    const { container } = render(<PermalinksScreen />);
    fireEvent.change(container.querySelector('#pl-category')!, { target: { value: '/category' } });
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    vi.useRealTimers();
    await waitFor(() => expect(container.textContent).toContain('the same address'));
    expect(saveButton(container).disabled).toBe(true);
  });
});
