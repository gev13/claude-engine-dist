'use client';

import { useEffect, useRef } from 'react';

/**
 * 3.22 — a `<details>` menu that closes like a menu: on a click outside it
 * and on Escape (focus back on its summary). Rendered inside the details;
 * it draws nothing, so the menu still opens and closes without script.
 */
export function DetailsDismiss() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const details = ref.current?.closest('details');
    if (!details) return;
    const close = () => details.removeAttribute('open');
    const onPointer = (event: PointerEvent) => {
      if (details.open && !details.contains(event.target as Node)) close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !details.open) return;
      close();
      details.querySelector('summary')?.focus();
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, []);
  return <span ref={ref} hidden />;
}
