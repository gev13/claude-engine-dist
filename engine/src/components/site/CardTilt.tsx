'use client';

import { useEffect } from 'react';
import { motionReduced } from '@/lib/motion';

/* One delegated listener for the whole document, however many lists ask for
   it — so cards a "Load more" adds later lean like the first ones did. */
let users = 0;
let detach: (() => void) | null = null;

function attach(): () => void {
  let current: HTMLElement | null = null;

  const reset = (el: HTMLElement) => {
    for (const name of ['--he-ch-x', '--he-ch-y', '--he-ch-gx', '--he-ch-gy']) el.style.removeProperty(name);
    el.classList.remove('is-tilting');
  };

  const move = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse') return;
    const card = (event.target as Element | null)?.closest<HTMLElement>('.he-ch--tilt') ?? null;
    if (card !== current) {
      if (current) reset(current);
      current = card;
    }
    if (!card || motionReduced()) return;
    const box = card.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return;
    const x = (event.clientX - box.left) / box.width;
    const y = (event.clientY - box.top) / box.height;
    const max = Number(getComputedStyle(card).getPropertyValue('--he-ch-max')) || 8;
    card.classList.add('is-tilting');
    card.style.setProperty('--he-ch-x', `${((0.5 - y) * 2 * max).toFixed(2)}deg`);
    card.style.setProperty('--he-ch-y', `${((x - 0.5) * 2 * max).toFixed(2)}deg`);
    card.style.setProperty('--he-ch-gx', `${(x * 100).toFixed(1)}%`);
    card.style.setProperty('--he-ch-gy', `${(y * 100).toFixed(1)}%`);
  };

  const leave = () => {
    if (current) reset(current);
    current = null;
  };

  document.addEventListener('pointermove', move, { passive: true });
  document.documentElement.addEventListener('pointerleave', leave);
  return () => {
    document.removeEventListener('pointermove', move);
    document.documentElement.removeEventListener('pointerleave', leave);
    leave();
  };
}

/**
 * Leans every `.he-ch--tilt` card towards the pointer (T33, 2.19). Rendered
 * by a list whose cards tilt; renders nothing. A fine pointer that can hover
 * only — a touch screen never gets it — and the angles are custom
 * properties, so the pointer never re-renders anything.
 */
export function CardTilt() {
  useEffect(() => {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    users += 1;
    if (users === 1) detach = attach();
    return () => {
      users -= 1;
      if (users === 0 && detach) {
        detach();
        detach = null;
      }
    };
  }, []);
  return null;
}
