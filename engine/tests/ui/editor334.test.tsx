/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BlockStyle } from '@/lib/blockStyle';

/* 3.34 — the editor's side of the pinned section and the card grid's lift
   and widening row: what a tick or a field writes, and that clearing them
   leaves nothing behind. */

vi.mock('next/navigation', () => ({ usePathname: () => '/admin', useRouter: () => ({ push() {} }) }));
vi.mock('@/components/admin/useBandStyle', () => ({ useBandStyle: () => ({ spacing: {}, box: {}, type: {} }) }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { BlockDesignPanel } = await import('@/components/admin/BlockDesignPanel');
const { BlockFields } = await import('@/components/admin/blockFields');

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
/** The pin's own row of tier boxes, widest first. */
const pinTiers = (el: HTMLElement) => {
  const section = [...el.querySelectorAll('p')].find((p) => p.textContent === 'Pin to the scroll')!.parentElement!;
  return [...section.querySelector('div.flex')!.querySelectorAll('input')] as HTMLInputElement[];
};
const labels = (el: HTMLElement) => [...el.querySelectorAll('label, span, p')].map((n) => n.textContent ?? '');

describe('pin to the scroll, in the Design tab', () => {
  it('writes the tiers ticked, and nothing once none is', async () => {
    const changes: (BlockStyle | undefined)[] = [];
    const el = await mount(<BlockDesignPanel style={{ scrollPin: { at: ['base'] } }} onChange={(next) => changes.push(next)} />);
    const tiers = pinTiers(el);
    expect(tiers.map((box) => box.checked)).toEqual([true, false, false, false]);
    await act(async () => tiers[3]!.click());
    expect(changes.at(-1)?.scrollPin?.at).toEqual(['base', 'mobile']);
    await act(async () => pinTiers(el)[0]!.click());
    expect(changes.at(-1)).toBeUndefined();
  });
  it('shows the counter’s and the line’s looks only once each is on', async () => {
    const off = await mount(<BlockDesignPanel style={{ scrollPin: { at: ['base'] } }} onChange={() => {}} />);
    expect(labels(off).some((t) => t.startsWith('Counter size'))).toBe(false);
    off.remove();
    const on = await mount(<BlockDesignPanel style={{ scrollPin: { at: ['base'], counter: true, line: true } }} onChange={() => {}} />);
    for (const name of ['Room for a sticky header', 'Counter font', 'Counter size', 'Line width', 'Line fill']) expect(labels(on).some((t) => t.startsWith(name))).toBe(true);
  });
});

describe('the card grid’s lift and widening row, in the block’s fields', () => {
  it('offers the lift’s settings with hover Lift, and the widening row for pictures with text over them', async () => {
    const el = await mount(<BlockFields type="cardGrid" props={{ variant: 'overlay', hover: 'lift', cards: [] }} set={() => {}} />);
    for (const name of ['Lift by', 'Shadow while lifted', 'Picture zoom', 'Widen the card pointed at']) expect(labels(el).some((t) => t.startsWith(name))).toBe(true);
  });
  it('hides the lift’s settings for other hovers', async () => {
    const el = await mount(<BlockFields type="cardGrid" props={{ variant: 'overlay', hover: 'zoom', cards: [] }} set={() => {}} />);
    expect(labels(el).some((t) => t.startsWith('Lift by'))).toBe(false);
  });
  it('clears an easing to nothing rather than an empty value', async () => {
    let last: Record<string, unknown> = {};
    const el = await mount(<BlockFields type="cardGrid" props={{ variant: 'overlay', expand: 1.3, expandEasing: 'soft', cards: [] }} set={(next) => (last = next)} />);
    const field = [...el.querySelectorAll('label')].find((l) => l.textContent?.startsWith('Widening length'))!;
    const select = field.parentElement!.parentElement!.querySelectorAll('select');
    const easing = [...select].find((s) => s.value === 'soft')!;
    await act(async () => {
      easing.value = '';
      easing.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect('expandEasing' in last).toBe(false);
  });
});
