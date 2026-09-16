// @vitest-environment jsdom
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/* ═══════════════════════════════════════════════════════════════════════════
   The careers screens
   ───────────────────────────────────────────────────────────────────────────
   Two things these have to get right, and both are easy to get wrong.

   **Open is not published.** A filled role stays published so its page keeps
   answering anybody holding the link; it simply stops taking applications.
   Every screen that shows one has to show the other.

   **A CV is not media.** It is reached through an admin route that checks the
   permission and logs the download — never a media-library URL — and erasing
   an application erases the file with it, which the confirmation has to say.
   ═══════════════════════════════════════════════════════════════════════════ */

const store = vi.hoisted(() => ({
  list: {} as Record<string, unknown>,
  detail: null as Record<string, unknown> | null,
  api: vi.fn(),
  keys: [] as (string | null)[],
}));

/* One mock for both screens: the applications screen calls useSWR twice (the
   list, then the open application), so the key decides which payload it gets —
   and recording the keys is how the "not fetched until opened" test works. */
vi.mock('swr', () => ({
  default: (key: string | null) => {
    store.keys.push(key);
    if (key === null) return { data: undefined, isLoading: false, mutate: vi.fn() };
    const isDetail = /\/applications\/[^?]+$/.test(key);
    return {
      data: isDetail ? store.detail : store.list,
      isLoading: false,
      mutate: vi.fn(),
    };
  },
}));

vi.mock('@/lib/admin/client', () => ({
  api: store.api,
  fetcher: vi.fn(),
  ApiError: class ApiError extends Error {},
}));

const { JobsList } = await import('../../src/app/(system)/admin/(panel)/jobs/JobsList');
const { ApplicationsScreen } = await import(
  '../../src/app/(system)/admin/(panel)/applications/ApplicationsScreen'
);
const { ToastProvider } = await import('../../src/components/admin/useToast');

const job = (over: Record<string, unknown> = {}) => ({
  id: '11111111-1111-4111-8111-111111111111',
  slug: 'frontend-engineer',
  locale: 'en',
  title: 'Frontend Engineer',
  department: 'Engineering',
  location: 'Yerevan',
  contractType: 'Full time',
  status: 'published',
  isOpen: true,
  deletedAt: null,
  postedAt: '2026-08-01T09:00:00.000Z',
  deadline: null,
  publishedAt: '2026-08-01T09:00:00.000Z',
  updatedAt: '2026-08-01T09:00:00.000Z',
  applicationCount: 0,
  ...over,
});

const application = (over: Record<string, unknown> = {}) => ({
  id: '22222222-2222-4222-8222-222222222222',
  jobId: '11111111-1111-4111-8111-111111111111',
  jobTitle: 'Frontend Engineer',
  jobSlug: 'frontend-engineer',
  name: 'Anna Petrosyan',
  email: 'anna@example.com',
  phone: '+374 10 000000',
  cvFilename: '33333333-3333-4333-8333-333333333333.pdf',
  cvOriginalName: 'anna-cv.pdf',
  cvBytes: 204800,
  status: 'new',
  createdAt: '2026-09-01T09:00:00.000Z',
  ...over,
});

const one = (row: Record<string, unknown>) => ({ items: [row], total: 1, page: 1, perPage: 20 });

afterEach(() => {
  cleanup();
  store.api.mockReset();
  store.detail = null;
  store.keys = [];
});

const withToast = (node: React.ReactElement) => render(<ToastProvider>{node}</ToastProvider>);
const buttonNamed = (root: HTMLElement, text: string) =>
  [...root.querySelectorAll('button')].find((b) => b.textContent?.trim() === text);

describe('the roles list', () => {
  it('shows whether a role is taking applications separately from its status', () => {
    store.list = one(job({ status: 'published', isOpen: false }));
    const { container } = withToast(<JobsList />);
    const text = container.textContent ?? '';
    // Both, and not one standing in for the other.
    expect(text).toContain('Published');
    expect(text).toContain('Closed');
  });

  it('closes a role without touching its status', async () => {
    store.list = one(job({ isOpen: true }));
    const { container } = withToast(<JobsList />);

    fireEvent.click(buttonNamed(container, 'Close')!);

    await waitFor(() => expect(store.api).toHaveBeenCalled());
    const [url, options] = store.api.mock.calls[0]!;
    expect(url).toContain('/api/admin/jobs/11111111-1111-4111-8111-111111111111');
    expect(options.method).toBe('PUT');
    expect(options.json).toEqual({ isOpen: false });
    // Emphatically not a status change.
    expect(Object.keys(options.json)).not.toContain('status');
  });

  it('links a role with applications through to them, and leaves a bare zero alone', () => {
    store.list = one(job({ applicationCount: 4 }));
    const { container, rerender } = withToast(<JobsList />);
    const link = [...container.querySelectorAll('a')].find((a) =>
      a.getAttribute('href')?.startsWith('/admin/applications?job='),
    );
    expect(link?.textContent).toBe('4');

    store.list = one(job({ applicationCount: 0 }));
    rerender(
      <ToastProvider>
        <JobsList />
      </ToastProvider>,
    );
    expect(
      [...container.querySelectorAll('a')].some((a) =>
        a.getAttribute('href')?.startsWith('/admin/applications?job='),
      ),
    ).toBe(false);
  });

  it('offers restore in the trash and close outside it', () => {
    store.list = one(job());
    const { container } = withToast(<JobsList />);
    expect(buttonNamed(container, 'Close')).toBeTruthy();
    expect(buttonNamed(container, 'Restore')).toBeUndefined();

    fireEvent.click(buttonNamed(container, 'Trash')!);
    expect(buttonNamed(container, 'Restore')).toBeTruthy();
    expect(buttonNamed(container, 'Close')).toBeUndefined();
  });
});

describe('the applications inbox', () => {
  it('reaches a CV through the admin route, never a media URL', () => {
    store.list = one(application());
    const { container } = withToast(<ApplicationsScreen />);
    const link = [...container.querySelectorAll('a')].find((a) => a.textContent?.startsWith('Download'));
    expect(link?.getAttribute('href')).toBe(
      '/api/admin/applications/22222222-2222-4222-8222-222222222222/cv',
    );
    // The generated filename is not a URL anybody can reach.
    expect(container.innerHTML).not.toContain('/media/');
    expect(container.innerHTML).not.toContain('33333333-3333-4333-8333-333333333333');
  });

  it('says a CV goes with the application before erasing one', () => {
    store.list = one(application());
    const { container } = withToast(<ApplicationsScreen />);
    fireEvent.click(buttonNamed(container, 'Erase')!);
    expect(container.textContent).toContain('The CV is deleted too.');
  });

  it('does not fetch a covering letter until somebody opens one', () => {
    store.list = one(application());
    store.detail = { ...application(), coverLetter: 'I have wanted to work here for years.' };
    const { container } = withToast(<ApplicationsScreen />);

    // The second SWR key is null while nothing is open.
    expect(store.keys).toContain(null);
    expect(container.textContent).not.toContain('I have wanted to work here');

    fireEvent.click(buttonNamed(container, 'Read')!);
    expect(container.textContent).toContain('I have wanted to work here for years.');
    expect(store.keys.some((key) => key?.endsWith('/applications/22222222-2222-4222-8222-222222222222'))).toBe(
      true,
    );
  });

  it('still names the role after the advert has been deleted', () => {
    store.list = one(application({ jobSlug: null }));
    const { container } = withToast(<ApplicationsScreen />);
    expect(container.textContent).toContain('Frontend Engineer');
    // Named, but not linked — there is nothing left to link to.
    expect(
      [...container.querySelectorAll('a')].some((a) => a.getAttribute('href')?.startsWith('/admin/jobs')),
    ).toBe(false);
  });
});
