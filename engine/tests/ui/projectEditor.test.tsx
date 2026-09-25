// @vitest-environment jsdom
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/* ═══════════════════════════════════════════════════════════════════════════
   The project editor (2.14)
   ───────────────────────────────────────────────────────────────────────────
   What matters is what reaches the server: the primary category first among
   the categories, the options only when set, and no publish button for
   somebody whose role cannot publish.
   ═══════════════════════════════════════════════════════════════════════════ */

const store = vi.hoisted(() => ({ api: vi.fn(), replace: vi.fn() }));

vi.mock('@/lib/admin/client', () => ({ api: store.api, fetcher: vi.fn(), ApiError: class ApiError extends Error {} }));
vi.mock('@/components/admin/useToast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: store.replace, push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/admin/projects/new',
}));
vi.mock('next/dynamic', () => ({ default: () => () => null }));
vi.mock('@/components/admin/BlockBuilder', () => ({ BlockBuilder: () => null }));
vi.mock('@/components/admin/MediaPicker', () => ({ MediaPicker: () => null }));
vi.mock('@/components/admin/RevisionPanel', () => ({ RevisionPanel: () => null }));
vi.mock('@/components/admin/SeoPanel', () => ({ SeoPanel: () => null }));

const { ProjectEditor } = await import('../../src/app/(system)/admin/(panel)/projects/ProjectEditor');

const terms = [
  { id: '00000000-0000-4000-8000-000000000001', name: 'Branding', taxonomy: 'category' as const },
  { id: '00000000-0000-4000-8000-000000000002', name: 'Game Design', taxonomy: 'category' as const },
  { id: '00000000-0000-4000-8000-000000000003', name: 'Logo design', taxonomy: 'tag' as const },
];

beforeEach(() => {
  store.api.mockReset();
  store.api.mockImplementation(async (_url: string, init: { json: Record<string, unknown> }) => ({
    id: '00000000-0000-4000-8000-00000000000a',
    publicPath: '/projects/x',
    ...init.json,
    publishedAt: null,
  }));
});

afterEach(cleanup);

const button = (root: HTMLElement, text: string) => [...root.querySelectorAll('button')].find((b) => b.textContent?.trim() === text);

describe('the project editor', () => {
  it('offers publishing only to a role that may publish', () => {
    const author = render(<ProjectEditor terms={terms} media={{}} canPublish={false} />);
    expect(button(author.container, 'Save & publish')).toBeUndefined();
    cleanup();
    const editor = render(<ProjectEditor terms={terms} media={{}} canPublish />);
    expect(button(editor.container, 'Save & publish')).toBeTruthy();
  });

  it('sends the primary category first, the tags, and only the options that are set', async () => {
    const { container } = render(<ProjectEditor terms={terms} media={{}} canPublish />);
    fireEvent.change(container.querySelector('#project-title')!, { target: { value: 'Fortune To Win' } });
    fireEvent.change(container.querySelector('#project-primary')!, { target: { value: terms[1]!.id } });
    const box = (label: string) =>
      [...container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].find((input) => input.parentElement?.textContent?.includes(label))!;
    fireEvent.click(box('Branding'));
    fireEvent.click(box('Logo design'));
    fireEvent.click(button(container, 'Save')!);

    await waitFor(() => expect(store.api).toHaveBeenCalled());
    const [url, init] = store.api.mock.calls[0]!;
    expect(url).toBe('/api/admin/projects');
    expect(init.method).toBe('POST');
    expect(init.json).toMatchObject({
      title: 'Fortune To Win',
      categoryIds: [terms[1]!.id, terms[0]!.id],
      primaryCategoryId: terms[1]!.id,
      tagIds: [terms[2]!.id],
      options: {},
      status: 'draft',
    });
  });

  it('will not save a project without a title', () => {
    const { container } = render(<ProjectEditor terms={terms} media={{}} canPublish />);
    fireEvent.click(button(container, 'Save')!);
    expect(store.api).not.toHaveBeenCalled();
    expect(container.textContent).toContain('needs a title');
  });
});
