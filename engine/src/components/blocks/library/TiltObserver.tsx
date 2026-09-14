'use client';

import { useEffect } from 'react';
import { motionReduced } from '@/lib/motion';

/**
 * P3-C2 — leans blocks with the `tilt` hover effect towards the pointer.
 * Rendered once per page, only when a block uses it. Only a fine pointer
 * that can hover gets it, never for reduced motion, and the angle goes into
 * two custom properties, so moving the mouse never re-renders anything.
 */
export function TiltObserver() {
  useEffect(() => {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const cleanups = [...document.querySelectorAll<HTMLElement>('.he-hover--tilt')].map((el) => {
      const move = (e: PointerEvent) => {
        if (motionReduced()) return;
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        el.style.setProperty('--he-tilt-x', `${(-y * 6).toFixed(2)}deg`);
        el.style.setProperty('--he-tilt-y', `${(x * 8).toFixed(2)}deg`);
      };
      const leave = () => {
        el.style.removeProperty('--he-tilt-x');
        el.style.removeProperty('--he-tilt-y');
      };
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerleave', leave);
      return () => {
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerleave', leave);
      };
    });
    return () => cleanups.forEach((cleanup) => cleanup());
  }, []);

  return null;
}
