'use client';

import { useEffect, useRef } from 'react';

/* ═══════════════════════════════════════════════════════════════════════════
   A held column that rises to the middle (3.36)
   ───────────────────────────────────────────────────────────────────────────
   Row → column → *Held in view* → centred, *rising from its place*. The CSS
   holds the column at the offset plus half of what the visible part has over
   the column's own height; CSS can't know that height, so this measures each
   such column of its row and writes it as `--he-hold-h`. Before this runs, or
   without it, the column holds at the offset: nothing goes out of reach.
   ═══════════════════════════════════════════════════════════════════════════ */

export function HeldRise() {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const row = ref.current?.closest<HTMLElement>('.he-row');
    if (!row || typeof ResizeObserver === 'undefined') return;
    const columns = [...row.querySelectorAll<HTMLElement>(':scope > .shell > [class^="he-r-"] > [data-he-hold="rise"]')];
    if (!columns.length) return;
    const write = (el: HTMLElement) => el.style.setProperty('--he-hold-h', `${Math.ceil(el.getBoundingClientRect().height)}px`);
    const observer = new ResizeObserver((entries) => entries.forEach((entry) => write(entry.target as HTMLElement)));
    columns.forEach((el) => {
      write(el);
      observer.observe(el);
    });
    return () => {
      observer.disconnect();
      columns.forEach((el) => el.style.removeProperty('--he-hold-h'));
    };
  }, []);

  return <span ref={ref} hidden />;
}
