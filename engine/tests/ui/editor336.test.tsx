/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

/* 3.36 — the editor's side of a held column that rises into the middle, and
   a type style's line heights per tier: what each choice writes, and that
   clearing it leaves nothing behind. */

vi.mock('next/navigation', () => ({ usePathname: () => '/admin', useRouter: () => ({ push() {} }) }));
vi.mock('@/components/admin/useBandStyle', () => ({ useBandStyle: () => ({ spacing: {}, box: {}, type: {} }) }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { BlockFields } = await import('@/components/admin/blockFields');
const { TypeStyleFields } = await import('@/components/admin/TypeStyleFields');

let host: HTMLDivElement | null = null;
afterEach(() => {
  host?.remove();
  host = null;
});

async function mount(node: React.ReactNode) {
  host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(node));
  return host;
}
/** A row's first column, on its *Width & design* tab. */
async function mountRow(node: React.ReactNode) {
  const el = await mount(node);
  const tab = [...el.querySelectorAll('button')].find((b) => b.textContent === 'Width & design')!;
  await act(async () => tab.click());
  return el;
}
const fieldSelect = (el: HTMLElement, label: string) => [...el.querySelectorAll('label')].find((l) => l.textContent?.startsWith(label))?.parentElement?.querySelector('select') ?? null;
const choose = async (select: HTMLSelectElement, value: string) =>
  act(async () => {
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });

type Sticky = { at: string[]; center?: boolean; rise?: boolean };
const rowProps = (sticky: Sticky) => ({ columns: [{ id: 'a', width: { base: 6 }, sticky, blocks: [] }, { id: 'b', width: { base: 6 }, blocks: [] }] });
const stickyOf = (props: Record<string, unknown>) => (props.columns as { sticky?: Sticky }[])[0]!.sticky;

describe('a held column rising into the middle, in the column editor', () => {
  it('offers the choice only once its blocks are centred', async () => {
    const off = await mountRow(<BlockFields type="row" props={rowProps({ at: ['base'] })} set={() => {}} />);
    expect(fieldSelect(off, 'Reaching the middle')).toBeNull();
    off.remove();
    const on = await mountRow(<BlockFields type="row" props={rowProps({ at: ['base'], center: true })} set={() => {}} />);
    expect(fieldSelect(on, 'Reaching the middle')!.value).toBe('centred');
  });
  it('writes rise, and nothing once set back', async () => {
    let last: Record<string, unknown> = {};
    const el = await mountRow(<BlockFields type="row" props={rowProps({ at: ['base'], center: true })} set={(next) => (last = next)} />);
    await choose(fieldSelect(el, 'Reaching the middle')!, 'rise');
    expect(stickyOf(last)).toEqual({ at: ['base'], center: true, rise: true });
    el.remove();
    const back = await mountRow(<BlockFields type="row" props={rowProps({ at: ['base'], center: true, rise: true })} set={(next) => (last = next)} />);
    await choose(fieldSelect(back, 'Reaching the middle')!, 'centred');
    expect(stickyOf(last)).toEqual({ at: ['base'], center: true });
  });
  it('drops the rise with the centring', async () => {
    let last: Record<string, unknown> = {};
    const el = await mountRow(<BlockFields type="row" props={rowProps({ at: ['base'], center: true, rise: true })} set={(next) => (last = next)} />);
    const centre = [...el.querySelectorAll('label')].find((l) => l.textContent?.includes('Its blocks in the middle of the screen'))!.querySelector('input')!;
    await act(async () => centre.click());
    expect(stickyOf(last)).toEqual({ at: ['base'] });
  });
});

describe('a type style’s line heights per tier', () => {
  it('has a field for tablets and one for phones', async () => {
    const set = vi.fn(() => () => {});
    const el = await mount(<TypeStyleFields type={{ line: '1.2' }} set={set} />);
    const names = [...el.querySelectorAll('label')].map((l) => l.textContent ?? '');
    expect(names.some((t) => t.startsWith('Line height on tablets'))).toBe(true);
    expect(names.some((t) => t.startsWith('Line height on phones'))).toBe(true);
    expect(set).toHaveBeenCalledWith('lineTablet');
    expect(set).toHaveBeenCalledWith('lineMobile');
  });
});
