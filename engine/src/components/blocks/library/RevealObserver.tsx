'use client';

import { useEffect } from 'react';
import { MOTION_EVENT, motionReduced } from '@/lib/motion';

/**
 * Arms the reveal-on-scroll option (SC4).
 *
 * Sections render visible. This runs only in a browser, only when motion is
 * allowed, and it marks everything already on screen as revealed before it
 * hides anything — so a thumbnail, a crawler, a print and a visitor who asked
 * for less motion all get the finished page. Rendered once per page, and only
 * when some block on it uses the option.
 */
export function RevealObserver() {
  useEffect(() => {
    const root = document.documentElement;
    let observer: IntersectionObserver | null = null;

    const arm = () => {
      observer?.disconnect();
      const sections = [...document.querySelectorAll<HTMLElement>('.he-reveal')];

      if (motionReduced() || !('IntersectionObserver' in window)) {
        root.classList.remove('he-reveal-on');
        sections.forEach((el) => el.classList.add('is-in'));
        return;
      }

      const fold = window.innerHeight * 0.95;
      sections.forEach((el) => {
        if (el.getBoundingClientRect().top < fold) el.classList.add('is-in');
      });
      root.classList.add('he-reveal-on');

      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            // P3-C1 — a delay holds the entrance back a moment; anything already on screen never waits.
            const el = entry.target as HTMLElement;
            const delay = Number(el.dataset.revealDelay) || 0;
            if (delay > 0) window.setTimeout(() => el.classList.add('is-in'), delay);
            else el.classList.add('is-in');
            observer?.unobserve(entry.target);
          }
        },
        // Threshold 0: a section taller than the screen still reveals.
        { rootMargin: '0px 0px -8% 0px', threshold: 0 },
      );
      sections.filter((el) => !el.classList.contains('is-in')).forEach((el) => observer?.observe(el));
    };

    arm();
    window.addEventListener(MOTION_EVENT, arm);
    return () => {
      observer?.disconnect();
      window.removeEventListener(MOTION_EVENT, arm);
      root.classList.remove('he-reveal-on');
    };
  }, []);

  return null;
}
