// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FONT_CATALOGUE } from '@/lib/fontCatalogue';

/* 3.37 — the admin's side of the posts options: the post cards' fields
   (shared by the post list block and Appearance → Blog), the careers
   advert's and the cover card's. Each writes what it shows, and clearing one
   writes `undefined`, so the key goes. */

vi.mock('next/navigation', () => ({ usePathname: () => '/admin', useRouter: () => ({ push() {} }) }));
vi.mock('@/components/admin/SavedBlocksTools', () => ({ useSavedBlocks: () => ({ items: [] }) }));

const { PostCardExtraFields } = await import('@/components/admin/PostCardExtraFields');
const { TypeStyleFields } = await import('@/components/admin/TypeStyleFields');
const { CareersPanel } = await import('../../src/app/(system)/admin/(panel)/appearance/CareersPanel');
const { BlogDetailsPanel } = await import('../../src/app/(system)/admin/(panel)/appearance/BlogDetailsPanel');

afterEach(cleanup);

/** The control in the field whose label starts with these words. */
function control(label: string): HTMLInputElement | HTMLSelectElement {
  const found = [...document.querySelectorAll('label')].find((l) => l.textContent?.startsWith(label));
  const input = found?.parentElement?.querySelector('input,select');
  if (!input) throw new Error(`No field “${label}”`);
  return input as HTMLInputElement;
}
const cardRecorder = () => {
  const calls: [string, unknown][] = [];
  return { calls, setCard: (key: string, value: unknown) => calls.push([key, value]) };
};
const pathRecorder = () => {
  const calls: [string, unknown][] = [];
  return { calls, set: (path: readonly (string | number)[]) => (value: unknown) => calls.push([path.join('.'), value]) };
};

describe('the post cards’ fields', () => {
  it('write the words’ gap, the excerpt’s lines and width, and the stops; clearing removes each', () => {
    const { calls, setCard } = cardRecorder();
    render(<PostCardExtraFields card={{ excerptWidth: '200px', excerptLines: 3 }} setCard={setCard} />);
    fireEvent.change(control('Space between the words’ parts'), { target: { value: ' 12px ' } });
    fireEvent.change(control('The excerpt’s width at most'), { target: { value: '' } });
    fireEvent.change(control('The excerpt’s lines'), { target: { value: '2' } });
    fireEvent.change(control('The excerpt’s lines'), { target: { value: '' } });
    fireEvent.change(control('The excerpt’s width at most'), { target: { value: '280px' } });
    fireEvent.change(control('Overlay as stops from the top'), { target: { value: '#000 10%, #fff 90%' } });
    expect(calls).toEqual([
      ['textGap', '12px'],
      ['excerptWidth', undefined],
      ['excerptLines', 2],
      ['excerptLines', undefined],
      ['excerptWidth', '280px'],
      ['tintStops', '#000 10%, #fff 90%'],
    ]);
  });
  it('write the picture’s box side by side, and drop it with its last side', () => {
    const { calls, setCard } = cardRecorder();
    render(<PostCardExtraFields card={{ imageBox: { width: '400px' } }} setCard={setCard} />);
    fireEvent.change(screen.getByLabelText('The picture’s own box: height'), { target: { value: '500px' } });
    fireEvent.change(screen.getByLabelText('The picture’s own box: width'), { target: { value: '' } });
    expect(calls).toEqual([
      ['imageBox', { width: '400px', height: '500px' }],
      ['imageBox', undefined],
    ]);
  });
  it('write the phones’ heights in turn as a list, and nothing for none', () => {
    const { calls, setCard } = cardRecorder();
    render(<PostCardExtraFields card={{}} setCard={setCard} />);
    const field = control('Card heights on phones, in turn');
    fireEvent.blur(field, { target: { value: '400px, 500px ,' } });
    fireEvent.blur(field, { target: { value: ' ' } });
    expect(calls).toEqual([
      ['heightsMobile', ['400px', '500px']],
      ['heightsMobile', undefined],
    ]);
  });
  it('offer the tiers that wait for the pointer only with the reveal, every tier ticked while unset', () => {
    const { calls, setCard } = cardRecorder();
    render(<PostCardExtraFields card={{}} setCard={setCard} />);
    expect(screen.queryByLabelText('Phone')).toBeNull();
    cleanup();
    render(<PostCardExtraFields card={{ reveal: true }} setCard={setCard} />);
    const phone = screen.getByLabelText('Phone') as HTMLInputElement;
    expect(phone.checked).toBe(true);
    fireEvent.click(phone);
    expect(calls).toEqual([['revealAt', ['base', 'laptop', 'tablet']]]);
    cleanup();
    render(<PostCardExtraFields card={{ reveal: true, revealAt: ['base', 'laptop', 'tablet'] }} setCard={setCard} />);
    fireEvent.click(screen.getByLabelText('Phone'));
    expect(calls.at(-1)).toEqual(['revealAt', undefined]);
  });
});

describe('a type style’s face', () => {
  it('offers the text’s and the headings’ faces, then the site’s others, writing the key', () => {
    const set = vi.fn<(key: string) => (value: unknown) => void>();
    const write = vi.fn();
    set.mockReturnValue(write);
    render(<TypeStyleFields type={undefined} set={set as never} />);
    const face = control('Face') as HTMLSelectElement;
    const values = [...face.querySelectorAll('option')].map((o) => o.value);
    expect(values.slice(0, 3)).toEqual(['', 'body', 'display']);
    expect(values).toContain('system');
    expect(values).toContain(FONT_CATALOGUE[0]!.key);
    // `display` once: the headings' face, not the brand stack of that name.
    expect(values.filter((v) => v === 'display')).toHaveLength(1);
    fireEvent.change(face, { target: { value: 'system' } });
    expect(write).toHaveBeenCalledWith('system');
  });
});

describe('the careers advert’s fields', () => {
  it('write the new lengths, and clear them', () => {
    const { calls, set } = pathRecorder();
    render(<CareersPanel careers={{ dropPadding: '20px' }} set={set} />);
    fireEvent.change(control('Space under the line above the title'), { target: { value: '6px' } });
    fireEvent.change(control('Icon size'), { target: { value: '22px' } });
    fireEvent.change(control('Between columns on phones'), { target: { value: '36px' } });
    fireEvent.change(control('How far it reaches past the panel’s padding on phones'), { target: { value: '12px' } });
    fireEvent.change(control('Drop zone’s padding'), { target: { value: '' } });
    expect(calls).toEqual([
      ['careers.eyebrowGap', '6px'],
      ['careers.iconSize', '22px'],
      ['careers.detailsColumnGapMobile', '36px'],
      ['careers.applyBleedMobile', '12px'],
      ['careers.dropPadding', undefined],
    ]);
  });
  it('place the cover’s picture side by side, dropping the object with its last side', () => {
    const { calls, set } = pathRecorder();
    render(<CareersPanel careers={{ coverPlace: { width: '150%' } }} set={set} />);
    fireEvent.change(screen.getByLabelText('The cover’s picture placed: left'), { target: { value: '-10%' } });
    fireEvent.change(screen.getByLabelText('The cover’s picture placed: width'), { target: { value: '' } });
    expect(calls).toEqual([
      ['careers.coverPlace', { width: '150%', left: '-10%' }],
      ['careers.coverPlace', undefined],
    ]);
  });
  it('write the switches and choices, and the fields’ order', () => {
    const { calls, set } = pathRecorder();
    render(<CareersPanel careers={{}} set={set} />);
    fireEvent.click(screen.getByLabelText('The site’s arrow on the send button'));
    fireEvent.click(screen.getByLabelText('No shadow under the form’s fields (whatever Appearance → Fields sets)'));
    fireEvent.click(screen.getByLabelText('The drop zone’s button at the site’s own button size, not the small one'));
    fireEvent.change(control('Posted and deadline on phones'), { target: { value: '2' } });
    fireEvent.change(control('How long ago, how long left'), { target: { value: 'spaced' } });
    fireEvent.blur(control('The short fields’ order'), { target: { value: 'email, cv, name, email' } });
    expect(calls).toEqual([
      ['careers.applyArrow', true],
      ['careers.applyFieldShadow', 'none'],
      ['careers.dropButton', 'standard'],
      ['careers.datesColumnsMobile', 2],
      ['careers.dateSuffix', 'spaced'],
      ['careers.applyFieldOrder', ['email', 'name']],
    ]);
  });
});

describe('the cover card’s fields', () => {
  it('write the new details of a post, and clear them', () => {
    const { calls, set } = pathRecorder();
    render(<BlogDetailsPanel blog={{ look: { post: { asideBodyPaddingMobile: '0 12px' } } }} set={set} />);
    fireEvent.change(control('Panel margins where the columns stack'), { target: { value: '0' } });
    fireEvent.change(control('Cover card: space between its words'), { target: { value: '12px' } });
    fireEvent.change(control('Cover card: between the date and the reading time'), { target: { value: 'dot' } });
    fireEvent.change(control('The article’s padding where they stack'), { target: { value: '' } });
    expect(calls).toEqual([
      ['blog.look.post.asidePanelMarginMobile', '0'],
      ['blog.look.post.asideTextGap', '12px'],
      ['blog.look.post.asideMetaDot', 'dot'],
      ['blog.look.post.asideBodyPaddingMobile', undefined],
    ]);
    expect(screen.getByText('Cover card beside the article: the excerpt')).toBeTruthy();
    expect(screen.getByText('Cover card beside the article: the date and reading time')).toBeTruthy();
  });
});
