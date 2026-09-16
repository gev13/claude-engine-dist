// @vitest-environment jsdom
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/* ═══════════════════════════════════════════════════════════════════════════
   The Languages screen
   ───────────────────────────────────────────────────────────────────────────
   Two things surprise people here, so the screen has to say both out loud:

     • the first language is the main one and is served without a prefix, so
       reordering rewrites every URL on the site;
     • the list is read when the site starts, so saving is not enough.

   And one thing it must refuse to do quietly: dropping a language does not
   delete its pages, it strands them.
   ═══════════════════════════════════════════════════════════════════════════ */

const store = vi.hoisted(() => ({
  loaded: {
    locales: ['en', 'hy', 'ru'],
    defaultLocale: 'en',
    multilingual: true,
    content: { en: { pages: 12, posts: 4 }, hy: { pages: 1, posts: 0 } },
    available: [
      { code: 'en', name: 'English', english: 'English', rtl: false },
      { code: 'hy', name: 'Հայերեն', english: 'Armenian', rtl: false },
      { code: 'ru', name: 'Русский', english: 'Russian', rtl: false },
      { code: 'ar', name: 'العربية', english: 'Arabic', rtl: true },
    ],
  } as Record<string, unknown>,
  api: vi.fn(),
}));

vi.mock('swr', () => ({ default: () => ({ data: store.loaded, isLoading: false, mutate: vi.fn() }) }));
/* `ApiError` has to be in the mock: errorMessage() does `instanceof ApiError`,
   so a mock without it throws the moment an error path is exercised — which is
   exactly what the refusal test below does. */
vi.mock('@/lib/admin/client', () => ({
  api: store.api,
  fetcher: vi.fn(),
  ApiError: class ApiError extends Error {},
}));

const { LanguagesScreen } = await import('../../src/app/(system)/admin/(panel)/languages/LanguagesScreen');

afterEach(() => {
  cleanup();
  store.api.mockReset();
  store.loaded = {
    locales: ['en', 'hy', 'ru'],
    defaultLocale: 'en',
    multilingual: true,
    content: { en: { pages: 12, posts: 4 }, hy: { pages: 1, posts: 0 } },
    available: [
      { code: 'en', name: 'English', english: 'English', rtl: false },
      { code: 'hy', name: 'Հայերեն', english: 'Armenian', rtl: false },
      { code: 'ru', name: 'Русский', english: 'Russian', rtl: false },
      { code: 'ar', name: 'العربية', english: 'Arabic', rtl: true },
    ],
  };
});

const buttonNamed = (root: HTMLElement, text: string) =>
  [...root.querySelectorAll('button')].find((b) => b.textContent?.trim() === text);

describe('the languages screen', () => {
  it('names each language in its own language, and marks the main one', () => {
    const { container } = render(<LanguagesScreen />);
    const text = container.textContent ?? '';
    expect(text).toContain('Հայերեն');
    expect(text).toContain('Русский');
    expect(text).toContain('main');
  });

  it('shows what each language does to the address, which is the part people miss', () => {
    const { container } = render(<LanguagesScreen />);
    const text = container.textContent ?? '';
    expect(text).toContain('/about');
    expect(text).toContain('/hy/about');
    expect(text).toContain('/ru/about');
  });

  it('says how much content each language holds, before anybody removes one', () => {
    const { container } = render(<LanguagesScreen />);
    const text = container.textContent ?? '';
    expect(text).toContain('12 pages · 4 posts');
    expect(text).toContain('no content yet');
  });

  it('will not let the last language be removed', () => {
    store.loaded = { ...store.loaded, locales: ['en'], multilingual: false };
    const { container } = render(<LanguagesScreen />);
    const remove = [...container.querySelectorAll('button')].filter((b) => b.textContent?.trim() === 'Remove');
    expect(remove).toHaveLength(1);
    expect(remove[0]?.disabled).toBe(true);
  });

  it('explains what a single language means, rather than showing an empty screen', () => {
    store.loaded = { ...store.loaded, locales: ['en'], multilingual: false };
    const { container } = render(<LanguagesScreen />);
    expect(container.textContent).toMatch(/no prefixes anywhere, no switcher/i);
  });

  it('moving a language to the top makes it the main one', () => {
    const { container } = render(<LanguagesScreen />);
    // Armenian is second; its Up button is the second one on the screen.
    const ups = [...container.querySelectorAll('button')].filter((b) => b.textContent?.trim() === 'Up');
    fireEvent.click(ups[1]!);

    const text = container.textContent ?? '';
    // Armenian now sits at the root and English is prefixed.
    expect(text).toContain('/en/about');
    expect(buttonNamed(container, 'Save languages')?.disabled).toBe(false);
  });

  it('offers nothing to save until something actually changed', () => {
    const { container } = render(<LanguagesScreen />);
    expect(buttonNamed(container, 'Save languages')?.disabled).toBe(true);
  });

  it('asks again before stranding content, and says what would be stranded', async () => {
    store.api.mockRejectedValueOnce(
      new Error('Removing hy (1 pages, 0 posts) would leave that content unreachable. It is not deleted — confirm to continue.'),
    );

    const { container } = render(<LanguagesScreen />);
    const removes = [...container.querySelectorAll('button')].filter((b) => b.textContent?.trim() === 'Remove');
    fireEvent.click(removes[1]!); // Armenian
    fireEvent.click(buttonNamed(container, 'Save languages')!);

    await waitFor(() => expect(container.textContent).toMatch(/would leave that content unreachable/i));
    expect(buttonNamed(container, 'Remove it anyway')).toBeDefined();
    expect(buttonNamed(container, 'Keep it')).toBeDefined();
  });

  it('says a restart is needed, and that published pages rebuild themselves', async () => {
    store.api.mockResolvedValueOnce({ restartRequired: true });

    const { container } = render(<LanguagesScreen />);
    const ups = [...container.querySelectorAll('button')].filter((b) => b.textContent?.trim() === 'Up');
    fireEvent.click(ups[1]!);
    fireEvent.click(buttonNamed(container, 'Save languages')!);

    await waitFor(() => expect(container.textContent).toMatch(/Restart the site to apply it/i));
    expect(container.textContent).toMatch(/rebuild themselves after the restart/i);
  });

  it('explains that removing a language does not delete anything', () => {
    const { container } = render(<LanguagesScreen />);
    expect(container.textContent).toMatch(/Nothing is deleted/i);
  });
});
