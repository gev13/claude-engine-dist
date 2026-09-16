// @vitest-environment jsdom
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/* ═══════════════════════════════════════════════════════════════════════════
   The side-by-side translation screen
   ───────────────────────────────────────────────────────────────────────────
   A translator should be able to read down the page, seeing each piece of the
   original beside the box they type into. Three things the screen must be
   honest about:

     • how much is left, in pieces rather than a percentage;
     • that an empty box keeps the original's wording, so a half-finished
       translation still reads as a page;
     • that layout and pictures are not editable here, because they follow the
       original — otherwise somebody hunts for controls that do not exist.
   ═══════════════════════════════════════════════════════════════════════════ */

const SOURCE = {
  id: 'page-1',
  locale: 'en',
  title: 'About us',
  slug: 'about',
  path: '/about',
  excerpt: 'Who we are.',
  summary: 'A studio.',
};

const STRINGS = [
  { path: '0.props.eyebrow', key: 'eyebrow', source: 'About us', target: '' },
  { path: '0.props.title', key: 'title', source: 'A studio built around making', target: 'Ստուդիա' },
  { path: '0.props.intro', key: 'intro', source: 'Twenty-two designers and engineers who would rather show you something working.', target: '' },
];

const store = vi.hoisted(() => ({ loaded: null as unknown, api: vi.fn() }));

vi.mock('swr', () => ({ default: () => ({ data: store.loaded, isLoading: false, mutate: vi.fn() }) }));
vi.mock('@/lib/admin/client', () => ({
  api: store.api,
  fetcher: vi.fn(),
  ApiError: class ApiError extends Error {},
}));

const { TranslateScreen } = await import(
  '../../src/app/(system)/admin/(panel)/pages/[id]/translate/[locale]/TranslateScreen'
);

const started = {
  source: SOURCE,
  target: {
    id: 'page-hy',
    locale: 'hy',
    title: 'Մեր մասին',
    slug: 'mer-masin',
    path: '/mer-masin',
    excerpt: '',
    summary: '',
    status: 'draft',
  },
  strings: STRINGS,
  languages: [
    { locale: 'hy', id: 'page-hy', title: 'Մեր մասին', status: 'draft', progress: { total: 3, translated: 1, remaining: 2 } },
    { locale: 'ru', id: null, title: null, status: null, progress: { total: 3, translated: 0, remaining: 3 } },
  ],
};

afterEach(() => {
  cleanup();
  store.api.mockReset();
  store.loaded = null;
});

const buttonNamed = (root: HTMLElement, text: string) =>
  [...root.querySelectorAll('button')].find((b) => b.textContent?.trim() === text);

describe('before a translation exists', () => {
  it('explains what starting one does, rather than showing an empty form', () => {
    store.loaded = { ...started, target: null };
    const { container } = render(<TranslateScreen sourceId="page-1" locale="hy" />);
    const text = container.textContent ?? '';
    expect(text).toMatch(/No Հայերեն version yet/);
    expect(text).toMatch(/the same layout, the same pictures/i);
    expect(text).toMatch(/Nothing is published until you publish it/i);
    expect(buttonNamed(container, 'Start the Հայերեն translation')).toBeDefined();
  });

  it('starts one as a draft copy', async () => {
    store.loaded = { ...started, target: null };
    store.api.mockResolvedValueOnce({ translation: { id: 'page-hy', locale: 'hy' } });

    const { container } = render(<TranslateScreen sourceId="page-1" locale="hy" />);
    fireEvent.click(buttonNamed(container, 'Start the Հայերեն translation')!);

    await waitFor(() => expect(store.api).toHaveBeenCalledTimes(1));
    expect(store.api.mock.calls[0]![1]).toMatchObject({ method: 'POST', json: { id: 'page-1', locale: 'hy' } });
  });
});

describe('translating', () => {
  it('shows each piece of the original beside a box to type into', () => {
    store.loaded = started;
    const { container } = render(<TranslateScreen sourceId="page-1" locale="hy" />);
    const text = container.textContent ?? '';

    expect(text).toContain('A studio built around making');
    expect(text).toContain('Twenty-two designers and engineers');
    // And the page's own fields, not just the blocks.
    expect(text).toContain('About us');
    expect(text).toContain('/about');
  });

  it('counts what is left in pieces, not a percentage', () => {
    store.loaded = started;
    const { container } = render(<TranslateScreen sourceId="page-1" locale="hy" />);
    expect(container.textContent).toMatch(/2 of 3 pieces of text still to translate/);
  });

  it('says an empty box keeps the original, so a half-done page still reads', () => {
    store.loaded = started;
    const { container } = render(<TranslateScreen sourceId="page-1" locale="hy" />);
    expect(container.textContent).toMatch(/keeps the original.{0,10}s wording/i);
  });

  it('says that layout follows the original, rather than hiding the missing controls', () => {
    store.loaded = started;
    const { container } = render(<TranslateScreen sourceId="page-1" locale="hy" />);
    expect(container.textContent).toMatch(/the original is on the left/i);
  });

  it('gives long prose a textarea and a heading a single line', () => {
    store.loaded = started;
    const { container } = render(<TranslateScreen sourceId="page-1" locale="hy" />);
    // The intro is long; the eyebrow is not.
    expect(container.querySelectorAll('textarea').length).toBeGreaterThanOrEqual(2);
  });

  it('sends what was typed, keyed by where it belongs', async () => {
    store.loaded = started;
    store.api.mockResolvedValueOnce({ progress: { total: 3, translated: 3, remaining: 0 } });

    const { container } = render(<TranslateScreen sourceId="page-1" locale="hy" />);
    // Block strings are the boxes with the em-dash placeholder; the page's own
    // fields have none. Selecting by intent rather than by position.
    const blockBoxes = [...container.querySelectorAll<HTMLInputElement>('input[placeholder="—"]')];
    const eyebrow = blockBoxes[0]!;
    expect(eyebrow.value).toBe(''); // the untranslated one
    fireEvent.change(eyebrow, { target: { value: 'Մեր մասին' } });

    fireEvent.click(buttonNamed(container, 'Save translation')!);
    await waitFor(() => expect(store.api).toHaveBeenCalled());

    const sent = store.api.mock.calls[0]![1].json as { sourceId: string; id: string; strings: Record<string, string> };
    expect(sent.sourceId).toBe('page-1');
    expect(sent.id).toBe('page-hy');
    // What was typed lands at the path it belongs to...
    expect(sent.strings['0.props.eyebrow']).toBe('Մեր մասին');
    // ...and what was already translated is still sent, not dropped.
    expect(sent.strings['0.props.title']).toBe('Ստուդիա');
  });

  it('lists the other languages with how far each has got', () => {
    store.loaded = started;
    const { container } = render(<TranslateScreen sourceId="page-1" locale="hy" />);
    const text = container.textContent ?? '';
    expect(text).toContain('Русский');
    expect(text).toContain('not started');
    expect(text).toContain('1/3');
  });

  it('says when there is nothing left', () => {
    store.loaded = {
      ...started,
      strings: STRINGS.map((row) => ({ ...row, target: 'թարգմանված' })),
    };
    const { container } = render(<TranslateScreen sourceId="page-1" locale="hy" />);
    expect(container.textContent).toMatch(/Everything on this page has been translated/i);
  });
});
