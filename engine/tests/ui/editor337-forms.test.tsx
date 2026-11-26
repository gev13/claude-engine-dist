// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/* 3.37 — the editor's side of the info panel's rows, the form block's
   spacing and the theme's placeholder and text box: what each field writes,
   and that emptying it leaves nothing behind. */

vi.mock('next/navigation', () => ({ usePathname: () => '/admin', useRouter: () => ({ push() {} }) }));
vi.mock('@/components/admin/useBandStyle', () => ({ useBandStyle: () => ({ spacing: {}, box: {}, type: {} }) }));

const { BlockFields } = await import('@/components/admin/blockFields');
const { FieldsExtraFields } = await import('@/app/(system)/admin/(panel)/appearance/FieldsExtraFields');

afterEach(cleanup);

/** The text box or drop-down under the label that starts with `label`. */
const control = (el: HTMLElement, label: string) => {
  const found = [...el.querySelectorAll('label')].find((l) => l.textContent?.startsWith(label));
  return (found?.parentElement?.querySelector('input:not([type=color]), select') as HTMLInputElement | HTMLSelectElement | null) ?? null;
};
const typeInto = (el: HTMLElement, label: string, value: string) => fireEvent.change(control(el, label)!, { target: { value } });

const items = [{ label: 'Phone', value: '1', icon: 'phone' }];

describe('the info panel’s rows in the editor', () => {
  it('are offered with the list layout only', () => {
    const grid = render(<BlockFields type="infoPanel" props={{ items }} set={() => {}} />);
    expect(grid.container.textContent).not.toContain('The rows’ icons, words and spacing');
    cleanup();
    const list = render(<BlockFields type="infoPanel" props={{ layout: 'list', items }} set={() => {}} />);
    expect(list.container.textContent).toContain('The rows’ icons, words and spacing');
  });
  it('write each key, and remove it once emptied', () => {
    let last: Record<string, unknown> = {};
    const { container } = render(<BlockFields type="infoPanel" props={{ layout: 'list', items }} set={(next) => (last = next)} />);
    typeInto(container, 'Space between rows on phones', '32px');
    expect(last.rowGapMobile).toBe('32px');
    typeInto(container, 'Label to value', '12px');
    expect(last.labelGap).toBe('12px');
    typeInto(container, 'Icon colour', '#123456');
    expect(last.iconColor).toBe('#123456');
    fireEvent.change(control(container, 'Icon beside the two lines')!, { target: { value: 'center' } });
    expect(last.rowAlign).toBe('center');
    fireEvent.change(control(container, 'Tile corners')!, { target: { value: 'leaf' } });
    expect(last.iconCorners).toEqual({ style: 'leaf' });
    cleanup();
    const filled = render(<BlockFields type="infoPanel" props={{ layout: 'list', items, rowGap: '48px', rowAlign: 'center', labelType: { size: '16px' } }} set={(next) => (last = next)} />);
    typeInto(filled.container, 'Space between rows', '');
    expect('rowGap' in last).toBe(false);
    fireEvent.change(control(filled.container, 'Icon beside the two lines')!, { target: { value: 'start' } });
    expect('rowAlign' in last).toBe(false);
    const size = [...filled.container.querySelectorAll('label')].find((l) => l.textContent === 'Size')!.parentElement!.querySelector('input')!;
    fireEvent.change(size, { target: { value: '' } });
    expect('labelType' in last).toBe(false);
  });
});

describe('the form block’s spacing in the editor', () => {
  const base = { formName: 'Contact', fields: [{ id: 'a', type: 'text', label: 'A', width: 'full' }] };
  it('writes the space under the heading and above the send button, and removes it once emptied', () => {
    let last: Record<string, unknown> = {};
    const { container } = render(<BlockFields type="form" props={{ ...base, submitGap: '40px' }} set={(next) => (last = next)} />);
    typeInto(container, 'Space under the heading', '40px');
    expect(last.titleGap).toBe('40px');
    typeInto(container, 'Space above the send button', '');
    expect('submitGap' in last).toBe(false);
  });
});

describe('the theme’s placeholder and text box in Appearance', () => {
  it('writes each path, and nothing once emptied', () => {
    const set = vi.fn(() => vi.fn());
    const { container } = render(<FieldsExtraFields get={() => undefined} set={set} />);
    const labels = [...container.querySelectorAll('label')].map((l) => l.textContent ?? '');
    for (const name of ['Placeholder colour', 'Placeholder letter spacing', 'Text box corners', 'Text box space at the top', 'Text box resize grip']) expect(labels.some((t) => t.startsWith(name))).toBe(true);
    for (const key of ['placeholder', 'placeholderTracking', 'textareaRadius', 'textareaPaddingTop', 'textareaResize']) expect(set).toHaveBeenCalledWith(['fields', key]);
  });
  it('sends the chosen grip, and undefined for the default', () => {
    const write = vi.fn();
    const { container } = render(<FieldsExtraFields get={() => undefined} set={() => write} />);
    fireEvent.change(control(container, 'Text box resize grip')!, { target: { value: 'none' } });
    expect(write).toHaveBeenLastCalledWith('none');
    fireEvent.change(control(container, 'Text box resize grip')!, { target: { value: '' } });
    expect(write).toHaveBeenLastCalledWith(undefined);
    typeInto(container, 'Text box corners', '');
    expect(write).toHaveBeenLastCalledWith(undefined);
  });
});
