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
vi.mock('@/lib/admin/client', () => ({ api: store.api, fetcher: vi.fn() }));

const { TransferScreen } = await import('../../src/app/admin/(panel)/transfer/TransferScreen');

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
    expect(text).toMatch(/replaces every page, post, category, redirect and media record/i);
    expect(text).toMatch(/accounts, enquiries, sign-ups and form answers are left alone/i);

    // And now the gate.
    const confirm = container.querySelector<HTMLInputElement>('input[aria-label="Confirmation"]')!;
    expect(buttonNamed(container, 'Replace this site’s content')?.disabled).toBe(true);

    fireEvent.change(confirm, { target: { value: 'replace' } });
    expect(buttonNamed(container, 'Replace this site’s content')?.disabled).toBe(true);

    fireEvent.change(confirm, { target: { value: 'replace all content' } });
    expect(buttonNamed(container, 'Replace this site’s content')?.disabled).toBe(false);
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
    });

    const { container } = render(<TransferScreen canWrite />);
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    fireEvent.change(input, { target: { files: [new File(['x'], 'c.tar.gz')] } });

    await waitFor(() => expect(container.textContent).toContain('No media files'));
    expect(container.textContent).toContain('images may be missing');
    expect(container.textContent).toContain('No design or menus.');
  });
});
