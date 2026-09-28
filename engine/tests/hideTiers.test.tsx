/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BlockStyle } from '@/lib/blockStyle';

/* 3.13.2 — a block saved with the old "hide on this width and below"
   (`hideOn`) could not be shown again: the checkbox wrote `hideOn: undefined`
   and `hideAt` as two changes from the same starting style, so the second put
   the old value back, and unticking the last tier left the block hidden. */

vi.mock('next/navigation', () => ({ usePathname: () => '/admin', useRouter: () => ({ push() {} }) }));
vi.mock('@/components/admin/useBandStyle', () => ({ useBandStyle: () => ({ spacing: {}, box: {}, type: {} }) }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { BlockDesignPanel } = await import('@/components/admin/BlockDesignPanel');

let host: HTMLDivElement | null = null;
afterEach(() => {
  host?.remove();
  host = null;
});

async function open(style: BlockStyle) {
  const changes: (BlockStyle | undefined)[] = [];
  host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(<BlockDesignPanel style={style} onChange={(next) => changes.push(next)} />));
  const box = (label: string) =>
    [...host!.querySelectorAll('label')].find((l) => l.textContent?.startsWith(label))!.querySelector('input') as HTMLInputElement;
  return { changes, box };
}

describe('hiding a block per screen', () => {
  it('shows an old phone-only hide as ticked, and unticking it shows the block again', async () => {
    const { changes, box } = await open({ hideOn: ['mobile'] } as BlockStyle);
    expect(box('Hide on mobile').checked).toBe(true);
    await act(async () => box('Hide on mobile').click());
    expect(changes.at(-1)).toBeUndefined();
  });

  it('keeps the rest of the style and drops the old field when a tier is added', async () => {
    const { changes, box } = await open({ hideOn: ['mobile'], maxWidth: '900px' } as BlockStyle);
    await act(async () => box('Hide on tablet').click());
    expect(changes.at(-1)).toEqual({ maxWidth: '900px', hideAt: ['tablet', 'mobile'] });
  });
});
