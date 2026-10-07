'use client';

import { useEffect } from 'react';

/**
 * 3.28 — the contents column shown only once it sticks: marks it `is-stuck`
 * when its top reaches the place it sticks at. The CSS that hides it until
 * then is Appearance → Blog → Details' (lib/blogCss), and keeps it shown on
 * tablets and phones, where it does not stick.
 */
export function TocReveal() {
  useEffect(() => {
    const toc = document.querySelector<HTMLElement>('.he-post .he-post__toc');
    if (!toc) return;
    let frame = 0;
    const check = () => {
      frame = 0;
      const top = parseFloat(getComputedStyle(toc).top) || 0;
      toc.classList.toggle('is-stuck', toc.getBoundingClientRect().top <= top + 1);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(check);
    };
    check();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, []);
  return null;
}
