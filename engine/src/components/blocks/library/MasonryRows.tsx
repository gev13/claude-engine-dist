'use client';

import { useEffect, useRef } from 'react';

/* ═══════════════════════════════════════════════════════════════════════════
   Masonry in reading order (3.22)
   ───────────────────────────────────────────────────────────────────────────
   CSS columns fill one column top to bottom before the next, so the first
   three items are not the first row, and appending more ("Load more") moves
   the ones already on screen into other columns. With "row by row", the list
   is a grid of 4px rows and each item spans as many as its height needs:
   the grid places them left to right in order, each in the next free spot,
   and items added later go below without moving anything. Until this runs
   the list is an ordinary grid, so nothing overlaps without script.
   ═══════════════════════════════════════════════════════════════════════════ */

const ROW = 4;

export function MasonryRows() {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const list = ref.current?.parentElement?.querySelector<HTMLElement>('[data-masonry-rows]');
    if (!list) return;

    const place = (item: HTMLElement) => {
      item.style.removeProperty('--he-span');
      const margin = parseFloat(getComputedStyle(item).marginBottom) || 0;
      const height = item.getBoundingClientRect().height;
      item.style.setProperty('--he-span', String(Math.max(1, Math.ceil((height + margin) / ROW))));
    };
    const sizes = new ResizeObserver((entries) => entries.forEach((entry) => place(entry.target as HTMLElement)));
    const watch = () => {
      for (const item of Array.from(list.children) as HTMLElement[]) sizes.observe(item);
    };
    watch();
    list.classList.add('is-packed');
    // "Load more" appends: measure the new items as they arrive.
    const added = new MutationObserver(watch);
    added.observe(list, { childList: true });
    return () => {
      sizes.disconnect();
      added.disconnect();
      list.classList.remove('is-packed');
    };
  }, []);

  return <span ref={ref} hidden />;
}
