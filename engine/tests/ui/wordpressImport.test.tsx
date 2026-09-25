// @vitest-environment jsdom
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/* 2.20 (T37) — Import from WordPress: read, map, check, import. Nothing is
   written until the last step, and the last step cannot run past refused
   items without being told to. */

const store = vi.hoisted(() => ({ api: vi.fn() }));

vi.mock('@/lib/admin/client', () => ({
  api: store.api,
  fetcher: vi.fn(),
  ApiError: class ApiError extends Error {
    constructor(
      message: string,
      readonly status: number,
      readonly details?: unknown,
    ) {
      super(message);
    }
  },
}));

const { WordPressImportScreen } = await import('../../src/app/(system)/admin/(panel)/import/wordpress/WordPressImportScreen');

afterEach(() => {
  cleanup();
  store.api.mockReset();
});

const button = (root: HTMLElement, text: string) => [...root.querySelectorAll('button')].find((b) => b.textContent?.trim() === text);
const table = (total: number, extra: Record<string, number> = {}) => ({ total, create: total, update: 0, skip: 0, failed: 0, ignoredColumns: [], ...extra });

const read = {
  token: 'a'.repeat(24),
  analysis: {
    title: 'Old Studio',
    url: 'https://old.example',
    types: [
      { type: 'post', count: 110, sample: ['Hello'] },
      { type: 'ohio_portfolio', count: 17, sample: ['Rebrand'] },
    ],
    taxonomies: [{ taxonomy: 'category', count: 8, sample: ['News'] }],
    attachments: 400,
  },
  mapping: {
    types: { post: 'posts', ohio_portfolio: 'projects' },
    taxonomies: { category: 'categories' },
    drafts: false,
    media: 'used',
    faq: true,
    seo: true,
    redirects: true,
    existing: 'skip',
  },
};

describe('import from WordPress', () => {
  it('reads a file, sends the mapping as changed, and imports only once the refusals are dealt with', async () => {
    store.api
      .mockResolvedValueOnce(read)
      .mockResolvedValueOnce({
        report: { strategy: 'merge', tables: { posts: table(110, { create: 109, failed: 1 }) }, rejected: [{ table: 'posts', row: 4, key: 'broken', reason: 'title is required.' }], notes: [] },
        media: { files: 120, strays: 2 },
        redirects: 135,
      })
      .mockResolvedValueOnce({ report: { strategy: 'merge', tables: { posts: table(110, { create: 109, failed: 1 }) }, rejected: [], notes: [] }, backupTaken: 'b.tar.gz', media: { stored: 120, reused: 2, failures: [] }, search: null });

    const { container } = render(<WordPressImportScreen />);
    fireEvent.change(container.querySelector<HTMLInputElement>('input[type="file"]')!, { target: { files: [new File(['<rss/>'], 'export.xml')] } });
    await waitFor(() => expect(container.textContent).toContain('Old Studio'));
    expect(container.textContent).toContain('ohio_portfolio (17)');

    // Leave the portfolio out, then check.
    const portfolio = [...container.querySelectorAll('select')].find((s) => s.value === 'projects')!;
    fireEvent.change(portfolio, { target: { value: 'skip' } });
    fireEvent.click(button(container, 'Check what this would do')!);
    await waitFor(() => expect(container.textContent).toContain('title is required.'));
    const sent = store.api.mock.calls[1]![1].json as { action: string; mapping: { types: Record<string, string> } };
    expect(sent.action).toBe('preview');
    expect(sent.mapping.types.ohio_portfolio).toBe('skip');
    expect(container.textContent).toContain('122 file(s) to fetch, 135 redirect(s)');

    expect(button(container, 'Import into this site')?.disabled).toBe(true);
    fireEvent.click(container.querySelector<HTMLInputElement>('input[name="onInvalid"]:not(:checked)')!);
    fireEvent.click(button(container, 'Import into this site')!);
    await waitFor(() => expect(container.textContent).toContain('120 file(s) stored'));
    expect((store.api.mock.calls[2]![1].json as { onInvalid: string }).onInvalid).toBe('skip');
  });
});
