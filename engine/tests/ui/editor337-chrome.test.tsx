// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { FooterDetailsPanel, HeaderDetailsPanel, MenuDetailsPanel } from '../../src/app/(system)/admin/(panel)/appearance/ChromeDetailsPanels';
import { FooterExtrasPanel, LanguagesPanel } from '../../src/app/(system)/admin/(panel)/appearance/ChromeExtrasPanels';

/* 3.37 — the Appearance fields for the header's space after its links, its
   top and bottom padding and exact edges, the close X, the language row's
   place, colour and faces, and the footer's thirds, wordmark and sign-up
   details: what each writes, and that clearing one leaves nothing behind. */

afterEach(cleanup);

const recorder = () => {
  const calls: [readonly (string | number)[], unknown][] = [];
  const set = (path: readonly (string | number)[]) => (value: unknown) => calls.push([path, value]);
  return { calls, set };
};
const field = (label: string) => screen.getByLabelText(label, { exact: false }) as HTMLInputElement;
const type = (input: HTMLInputElement, value: string) => fireEvent.change(input, { target: { value } });
const select = (label: string) => {
  const el = [...document.querySelectorAll('label')].find((l) => l.textContent?.startsWith(label))?.parentElement?.querySelector('select');
  if (!el) throw new Error(`no select ${label}`);
  return el;
};

describe('the header’s details', () => {
  it('writes the space after the links, and clears it', () => {
    const { calls, set } = recorder();
    render(<HeaderDetailsPanel chrome={undefined} set={set} />);
    type(field('Space after the links'), '60px');
    type(field('— on desktops up to 1440px'), '40px');
    cleanup();
    render(<HeaderDetailsPanel chrome={{ header: { actionsGap: '60px' } }} set={set} />);
    type(field('Space after the links'), '');
    expect(calls).toEqual([
      [['chrome', 'header', 'actionsGap'], '60px'],
      [['chrome', 'header', 'actionsGapLaptop'], '40px'],
      [['chrome', 'header', 'actionsGap'], undefined],
    ]);
  });
  it('has top and bottom padding for each tier', () => {
    const { calls, set } = recorder();
    render(<HeaderDetailsPanel chrome={undefined} set={set} />);
    expect(screen.getAllByText('Top')).toHaveLength(4);
    type(screen.getAllByLabelText('Top')[0] as HTMLInputElement, '12px');
    type(screen.getAllByLabelText('Bottom')[3] as HTMLInputElement, '0');
    expect(calls).toEqual([
      [['chrome', 'header', 'padding', 'base', 'top'], '12px'],
      [['chrome', 'header', 'padding', 'mobile', 'bottom'], '0'],
    ]);
  });
  it('ticks exact edges on and back to nothing', () => {
    const { calls, set } = recorder();
    render(<HeaderDetailsPanel chrome={{ header: { exactEdges: true } }} set={set} />);
    const box = screen.getByLabelText(/Exact edges/) as HTMLInputElement;
    expect(box.checked).toBe(true);
    fireEvent.click(box);
    expect(calls).toEqual([[['chrome', 'header', 'exactEdges'], undefined]]);
  });
});

describe('the menu’s close X', () => {
  it('writes its line length, thickness and colour one by one', () => {
    const { calls, set } = recorder();
    render(<MenuDetailsPanel chrome={undefined} set={set} />);
    type(field('Close X: line length'), '20px');
    type(field('Close X: thickness'), '2px');
    type(field('Close X: colour'), 'rgba(0,0,0,.5)');
    cleanup();
    render(<MenuDetailsPanel chrome={{ mobileMenu: { closeIcon: { color: 'rgba(0,0,0,.5)' } } }} set={set} />);
    type(field('Close X: colour'), '');
    expect(calls).toEqual([
      [['chrome', 'mobileMenu', 'closeIcon', 'size'], '20px'],
      [['chrome', 'mobileMenu', 'closeIcon', 'thickness'], '2px'],
      [['chrome', 'mobileMenu', 'closeIcon', 'color'], 'rgba(0,0,0,.5)'],
      [['chrome', 'mobileMenu', 'closeIcon', 'color'], undefined],
    ]);
  });
});

describe('the language switcher', () => {
  it('places the row after the links, colours the other codes, and names faces in plain words', () => {
    const { calls, set } = recorder();
    render(<LanguagesPanel chrome={undefined} set={set} />);
    fireEvent.change(select('In the open menu'), { target: { value: 'afterLinks' } });
    type(field('The other codes’ colour'), 'rgba(0,0,0,.5)');
    const faces = field('A face for a language’s own name');
    type(faces, 'el=Noto Serif, ru=no such face, x1=Inter');
    fireEvent.blur(faces);
    expect(calls).toEqual([
      [['chrome', 'languages', 'menuPlace'], 'afterLinks'],
      [['chrome', 'languages', 'color'], 'rgba(0,0,0,.5)'],
      [['chrome', 'languages', 'faces'], { el: 'notoSerif' }],
    ]);
  });
  it('shows a stored face by its name, and clears the lot', () => {
    const { calls, set } = recorder();
    render(<LanguagesPanel chrome={{ languages: { faces: { el: 'notoSerif' } } }} set={set} />);
    const faces = field('A face for a language’s own name');
    expect(faces.value).toBe('el=Noto Serif');
    type(faces, '');
    fireEvent.blur(faces);
    expect(calls).toEqual([[['chrome', 'languages', 'faces'], undefined]]);
  });
});

describe('the footer', () => {
  it('chooses thirds and asks for the menus’ gap only then', () => {
    const { calls, set } = recorder();
    render(<FooterDetailsPanel chrome={undefined} set={set} />);
    expect(screen.queryByLabelText('Space between the menus', { exact: true })).toBeNull();
    fireEvent.change(select('Columns wider than a tablet'), { target: { value: 'thirds' } });
    type(field('Space between the columns'), '20px');
    type(field('Space between the menus on phones'), '20px');
    expect(calls).toEqual([
      [['chrome', 'footer', 'layoutDesktop'], 'thirds'],
      [['chrome', 'footer', 'columnGap'], '20px'],
      [['chrome', 'footer', 'menusGapMobile'], '20px'],
    ]);
    cleanup();
    render(<FooterDetailsPanel chrome={{ footer: { layoutDesktop: 'thirds' } }} set={set} />);
    expect(screen.getByLabelText('Space between the menus', { exact: true })).toBeTruthy();
  });
  it('has the wordmark’s phone crop and its offsets', () => {
    const { calls, set } = recorder();
    render(<FooterExtrasPanel chrome={{ footer: { wordmark: 'name' } }} set={set} />);
    type(field('— cut off on phones'), '95');
    type(field('Moved right by'), '12px');
    cleanup();
    render(<FooterExtrasPanel chrome={{ footer: { wordmark: 'name', wordmarkCropMobile: 40 } }} set={set} />);
    type(field('— cut off on phones'), '');
    expect(calls).toEqual([
      [['chrome', 'footer', 'wordmarkCropMobile'], 90],
      [['chrome', 'footer', 'wordmarkOffset'], '12px'],
      [['chrome', 'footer', 'wordmarkCropMobile'], undefined],
    ]);
  });
  it('has the sign-up’s heading gap and field shadow once there is a sign-up', () => {
    const { calls, set } = recorder();
    render(<FooterExtrasPanel chrome={undefined} set={set} />);
    expect(screen.queryByLabelText('Field shadow', { exact: false })).toBeNull();
    cleanup();
    render(<FooterExtrasPanel chrome={{ footer: { newsletter: true } }} set={set} />);
    type(field('Space under the heading'), '12px');
    type(field('Field shadow'), 'none');
    cleanup();
    render(<FooterExtrasPanel chrome={{ footer: { newsletter: true, newsletterFieldShadow: 'none' } }} set={set} />);
    type(field('Field shadow'), '');
    expect(calls).toEqual([
      [['chrome', 'footer', 'newsletterTitleGap'], '12px'],
      [['chrome', 'footer', 'newsletterFieldShadow'], 'none'],
      [['chrome', 'footer', 'newsletterFieldShadow'], undefined],
    ]);
  });
});
