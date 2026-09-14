'use client';

import { useEffect, useRef } from 'react';
import { MOTION_EVENT, motionReduced } from '@/lib/motion';

/**
 * EL15 — makes a media band's picture drift with the scroll. Progress goes
 * into one custom property rather than React state, so scrolling never
 * re-renders anything; with reduced motion the picture stays still.
 */
export function ParallaxLayer({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const layer = ref.current;
    const band = layer?.parentElement;
    if (!layer || !band) return;
    let raf = 0;

    const update = () => {
      raf = 0;
      if (motionReduced()) {
        layer.style.setProperty('--shift', '0');
        return;
      }
      const rect = band.getBoundingClientRect();
      const vh = window.innerHeight;
      if (rect.bottom < 0 || rect.top > vh) return;
      // −1 as the band enters at the bottom of the screen, 1 as it leaves at the top.
      layer.style.setProperty('--shift', (((vh - rect.top) / (vh + rect.height)) * 2 - 1).toFixed(4));
    };
    const schedule = () => {
      /* A hidden page gets no animation frames, so a frame queued now would
         wait until the page is shown — and block every update until then.
         Work it out directly instead; it is rare and cheap. */
      if (document.hidden) {
        update();
        return;
      }
      if (!raf) raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    window.addEventListener(MOTION_EVENT, schedule);
    document.addEventListener('visibilitychange', schedule);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      window.removeEventListener(MOTION_EVENT, schedule);
      document.removeEventListener('visibilitychange', schedule);
    };
  }, []);

  return (
    <div ref={ref} className="he-band__layer">
      {children}
    </div>
  );
}
