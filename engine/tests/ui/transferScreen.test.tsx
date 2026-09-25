// @vitest-environment jsdom
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/* ═══════════════════════════════════════════════════════════════════════════
   The Export & import screen, without a browser or a login
   ───────────────────────────────────────────────────────────────────────────
   This screen can replace every page on a site. Most of what follows is about
   the things standing in front of that: a reader cannot reach it, the archive
   is read and shown before anything is applied, and the words have to be
   typed.

   The rest is about the copy, which is not decoration here — somebody reaching
   for this when they wanted a backup loses their accounts, and somebody
   reaching for a backup when they wanted this carries visitors' personal data
   onto another site. The screen has to say which is which.
   ═══════════════════════════════════════════════════════════════════════════ */

const store = vi.hoisted(() => ({
  loaded: {
    items: [
      { filename: 'content-1.1.0-2026-09-15T10-00-00-000Z.tar.gz', bytes: 2_411_724, createdAt: '2026-09-15T10:00:00.000Z' },
    ],
    engineVersion: '1.1.0',
    maxImportBytes: 2 * 1024 * 1024 * 1024,
  },
  api: vi.fn(),
}));

vi.mock('swr', () => ({ default: () => ({ data: store.loaded, isLoading: false, mutate: vi.fn() }) }));
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

const table = (total: number, extra: Record<string, number> = {}) => ({ total, create: total, update: 0, skip: 0, failed: 0, ignoredColumns: [], ...extra });
const cleanReport = { strategy: 'replace', tables: { pages: table(12), posts: table(4), media: table(50) }, rejected: [], notes: [] };

const { TransferScreen } = await import('../../src/app/(system)/admin/(panel)/transfer/TransferScreen');

afterEach(() => {
  cleanup();
  store.api.mockReset();
});

const buttonNamed = (root: HTMLElement, text: string) =>
  [...root.querySelectorAll('button')].find((b) => b.textContent?.trim() === text);

const labels = (root: HTMLElement) => [...root.querySelectorAll('button')].map((b) => b.textContent?.trim());

describe('the export & import screen', () => {
  it('says plainly what never leaves the site', () => {
    const { container } = render(<TransferScreen canWrite />);
    const text = container.textContent ?? '';
    expect(text).toContain('Accounts, sessions and the audit log');
    expect(text).toContain('Enquiries, newsletter sign-ups and form answers');
    expect(text).toContain('Email settings and the security policy');
    expect(text).toContain('Revision history');
  });

  it('points somebody who wanted a complete copy at Backups instead', () => {
    const { container } = render(<TransferScreen canWrite />);
    expect(container.textContent).toContain('Backups');
    expect(container.textContent).toMatch(/complete copy of this site/i);
  });

  it('warns that authorship cannot survive an export', () => {
    const { container } = render(<TransferScreen canWrite />);
    expect(container.textContent).toMatch(/credited to\s+whoever does the importing/i);
  });

  it('lists what is on the server, with a download link and a readable size', () => {
    const { container } = render(<TransferScreen canWrite />);
    const text = container.textContent ?? '';
    expect(text).toContain('content-1.1.0-2026-09-15T10-00-00-000Z.tar.gz');
    expect(text).toContain('2.3 MB');

    const link = [...container.querySelectorAll('a')].find((a) => a.textContent?.trim() === 'Download');
    expect(link?.getAttribute('href')).toBe(
      '/api/admin/transfer?download=content-1.1.0-2026-09-15T10-00-00-000Z.tar.gz',
    );
  });

  it('gives a reader nothing that changes anything', () => {
    const { container } = render(<TransferScreen canWrite={false} />);
    expect(labels(container)).not.toContain('Create an export');
    expect(labels(container)).not.toContain('Delete');
    // No import at all: it replaces the site.
    expect(container.textContent).not.toContain('Import from another site');
    // Downloading is still reading, and stays.
    expect([...container.querySelectorAll('a')].some((a) => a.textContent?.trim() === 'Download')).toBe(true);
  });

  it('offers no import controls until an archive has been read', () => {
    const { container } = render(<TransferScreen canWrite />);
    expect(container.textContent).toContain('Import from another site');
    // Nothing to confirm yet — the manifest has not been seen.
    expect(container.querySelector('input[aria-label="Confirmation"]')).toBeNull();
    expect(labels(container)).not.toContain('Replace this site’s content');
  });

  it('shows what is in an archive before anything is applied, then demands the words', async () => {
    store.api.mockResolvedValueOnce({
      manifest: {
        engineVersion: '1.1.0',
        takenAt: '2026-09-15T09:00:00.000Z',
        siteName: 'Staging',
        includesMedia: true,
        includesSettings: true,
        tables: { pages: 12, posts: 4, media: 50 },
      },
      report: cleanReport,
    });

    const { container } = render(<TransferScreen canWrite />);
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    const file = new File(['x'], 'content-1.1.0.tar.gz', { type: 'application/gzip' });
    fireEvent.change(input, { target: { files: [file] } });

    // Read, not applied: the call that ran was an inspection.
    await waitFor(() => expect(container.textContent).toContain('Staging'));
    expect(store.api).toHaveBeenCalledTimes(1);
    const form = store.api.mock.calls[0]![1].json as FormData;
    expect(form.get('mode')).toBe('inspect');

    const text = container.textContent ?? '';
    expect(text).toContain('pages: 12');
    expect(text).toContain('Includes the media files.');
    expect(text).toMatch(/replaces every page, post, project, category, redirect and media record the archive carries/i);
    expect(text).toContain('What this import would do');
    expect(text).toMatch(/accounts, enquiries, sign-ups and form answers are left alone/i);

    // And now the gate.
    const confirm = container.querySelector<HTMLInputElement>('input[aria-label="Confirmation"]')!;
    expect(buttonNamed(container, 'Replace this site’s content')?.disabled).toBe(true);

    fireEvent.change(confirm, { target: { value: 'replace' } });
    expect(buttonNamed(container, 'Replace this site’s content')?.disabled).toBe(true);

    fireEvent.change(confirm, { target: { value: 'replace all content' } });
    expect(buttonNamed(container, 'Replace this site’s content')?.disabled).toBe(false);
  });

  it('lists refused rows, and imports nothing past them until told to leave them out', async () => {
    store.api.mockResolvedValueOnce({
      manifest: { engineVersion: '2.20.0', takenAt: '2026-09-15T09:00:00.000Z', siteName: 'Old WP', includesMedia: true, includesSettings: false, tables: { posts: 3 } },
      report: {
        strategy: 'replace',
        tables: { posts: table(3, { create: 2, failed: 1 }) },
        rejected: [{ table: 'posts', row: 2, key: 'hello-world', reason: 'title is required.' }],
        notes: [],
      },
    });
    const { container } = render(<TransferScreen canWrite />);
    fireEvent.change(container.querySelector<HTMLInputElement>('input[type="file"]')!, { target: { files: [new File(['x'], 'c.tar.gz')] } });
    await waitFor(() => expect(container.textContent).toContain('hello-world'));
    expect(container.textContent).toContain('title is required.');
    expect(buttonNamed(container, 'Download the report (CSV)')).toBeTruthy();

    fireEvent.change(container.querySelector<HTMLInputElement>('input[aria-label="Confirmation"]')!, { target: { value: 'replace all content' } });
    expect(buttonNamed(container, 'Replace this site’s content')?.disabled).toBe(true);
    fireEvent.click(container.querySelector<HTMLInputElement>('input[name="onInvalid"]:not(:checked)')!);
    expect(buttonNamed(container, 'Replace this site’s content')?.disabled).toBe(false);
  });

  it('checks again for a merge, which needs no typed words and sends its choice', async () => {
    const manifest = { engineVersion: '2.20.0', takenAt: '2026-09-15T09:00:00.000Z', siteName: 'Batch 2', includesMedia: false, includesSettings: false, tables: { projects: 2 } };
    store.api
      .mockResolvedValueOnce({ manifest, report: cleanReport })
      .mockResolvedValueOnce({ manifest, report: { ...cleanReport, strategy: 'merge', tables: { projects: table(2, { create: 1, update: 1 }) } } })
      .mockResolvedValueOnce({ applied: { projects: 2 }, report: { ...cleanReport, strategy: 'merge', tables: { projects: table(2, { create: 1, update: 1 }) } }, backupTaken: 'b.tar.gz', search: null });
    const { container } = render(<TransferScreen canWrite />);
    fireEvent.change(container.querySelector<HTMLInputElement>('input[type="file"]')!, { target: { files: [new File(['x'], 'c.tar.gz')] } });
    await waitFor(() => expect(container.textContent).toContain('Batch 2'));

    fireEvent.click(container.querySelector<HTMLInputElement>('input[name="strategy"]:not(:checked)')!);
    await waitFor(() => expect(buttonNamed(container, 'Merge into this site')).toBeTruthy());
    expect((store.api.mock.calls[1]![1].json as FormData).get('strategy')).toBe('merge');
    expect(container.querySelector('input[aria-label="Confirmation"]')).toBeNull();

    fireEvent.click(buttonNamed(container, 'Merge into this site')!);
    await waitFor(() => expect(store.api).toHaveBeenCalledTimes(3));
    const sent = store.api.mock.calls[2]![1].json as FormData;
    expect([sent.get('mode'), sent.get('strategy'), sent.get('confirm')]).toEqual(['import', 'merge', null]);
    await waitFor(() => expect(container.textContent).toContain('Imported'));
  });

  it('says when an archive carries no media, rather than letting it surprise somebody', async () => {
    store.api.mockResolvedValueOnce({
      manifest: {
        engineVersion: '1.1.0',
        takenAt: '2026-09-15T09:00:00.000Z',
        siteName: '',
        includesMedia: false,
        includesSettings: false,
        tables: { pages: 3 },
      },
      report: cleanReport,
    });

    const { container } = render(<TransferScreen canWrite />);
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    fireEvent.change(input, { target: { files: [new File(['x'], 'c.tar.gz')] } });

    await waitFor(() => expect(container.textContent).toContain('No media files'));
    expect(container.textContent).toContain('images may be missing');
    expect(container.textContent).toContain('No design or menus.');
  });
});
