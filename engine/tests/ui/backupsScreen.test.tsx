// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/* ═══════════════════════════════════════════════════════════════════════════
   The Backups screen, without a browser or a login (package 6)
   ───────────────────────────────────────────────────────────────────────────
   Restoring replaces every page, account and enquiry on a site. These tests
   are mostly about the gate in front of that: a reader cannot reach it, and
   an administrator has to type the words.
   ═══════════════════════════════════════════════════════════════════════════ */

const loaded = {
  engineVersion: '0.1.0',
  orphans: ['engine-0.1.0-2026-01-01T00-00-00-000Z.tar.gz'],
  items: [
    {
      id: 'b1',
      filename: 'engine-0.1.0-2026-09-14T10-00-00-000Z.tar.gz',
      reason: 'manual',
      engineVersion: '0.1.0',
      byteSize: 411181,
      contents: { users: 2, pages: 34, media: 50 },
      includesMedia: true,
      status: 'ready' as const,
      error: null,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'b2',
      filename: 'engine-0.1.0-2026-09-13T10-00-00-000Z.tar.gz',
      reason: 'before updating to 0.2.0',
      engineVersion: '0.1.0',
      byteSize: 0,
      contents: {},
      includesMedia: false,
      status: 'failed' as const,
      error: 'tar exited with code 1',
      createdAt: new Date().toISOString(),
    },
  ],
};

vi.mock('swr', () => ({ default: () => ({ data: loaded, isLoading: false, mutate: vi.fn() }) }));
vi.mock('@/lib/admin/client', () => ({ api: vi.fn(), fetcher: vi.fn() }));

const { BackupsScreen } = await import('../../src/app/(system)/admin/(panel)/backups/BackupsScreen');

afterEach(cleanup);

const buttonNamed = (root: HTMLElement, text: string) =>
  [...root.querySelectorAll('button')].find((b) => b.textContent?.trim() === text);

describe('the backups screen', () => {
  it('says what a backup deliberately leaves out', () => {
    const { container } = render(<BackupsScreen canWrite />);
    const text = container.textContent ?? '';
    expect(text).toContain('Sign-in sessions');
    expect(text).toContain('audit log');
  });

  it('describes each archive in terms somebody can act on', () => {
    const { container } = render(<BackupsScreen canWrite />);
    const text = container.textContent ?? '';
    expect(text).toContain('engine-0.1.0-2026-09-14T10-00-00-000Z.tar.gz');
    expect(text).toContain('402 KB');
    expect(text).toContain('86 rows');
    expect(text).toContain('with files');
    // A failed one says why, and offers nothing to restore.
    expect(text).toContain('tar exited with code 1');
  });

  it('offers download and restore only for an archive that is ready', () => {
    const { container } = render(<BackupsScreen canWrite />);
    const links = [...container.querySelectorAll('a')].filter((a) => a.textContent?.trim() === 'Download');
    expect(links).toHaveLength(1);
    expect(links[0]?.getAttribute('href')).toContain('download=engine-0.1.0-2026-09-14T10-00-00-000Z.tar.gz');
    expect([...container.querySelectorAll('button')].filter((b) => b.textContent?.trim() === 'Restore')).toHaveLength(1);
  });

  it('will not restore until the words are typed', () => {
    const { container } = render(<BackupsScreen canWrite />);

    fireEvent.click(buttonNamed(container, 'Restore')!);
    expect(container.textContent).toContain('Restoring replaces every page, post, account, setting and uploaded file');
    expect(container.textContent).toContain('everybody is signed out');

    const confirm = buttonNamed(container, 'Restore this backup');
    expect(confirm?.disabled).toBe(true);

    const field = container.querySelector<HTMLInputElement>('input[aria-label="Confirmation"]')!;
    fireEvent.change(field, { target: { value: 'not the words' } });
    expect(buttonNamed(container, 'Restore this backup')?.disabled).toBe(true);

    fireEvent.change(field, { target: { value: 'replace everything' } });
    expect(buttonNamed(container, 'Restore this backup')?.disabled).toBe(false);
  });

  it('gives a reader nothing that changes anything', () => {
    const { container } = render(<BackupsScreen canWrite={false} />);
    const labels = [...container.querySelectorAll('button')].map((b) => b.textContent?.trim());
    expect(labels).not.toContain('Take a backup');
    expect(labels).not.toContain('Restore');
    expect(labels).not.toContain('Delete');
    // Downloading is still reading, and stays available.
    expect([...container.querySelectorAll('a')].some((a) => a.textContent?.trim() === 'Download')).toBe(true);
  });

  it('lists archives it has no record of, rather than hiding them', () => {
    const { container } = render(<BackupsScreen canWrite />);
    expect(container.textContent).toContain('Archives with no record');
    expect(container.textContent).toContain('engine-0.1.0-2026-01-01T00-00-00-000Z.tar.gz');
  });
});
