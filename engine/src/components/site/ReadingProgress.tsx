'use client';

import { useEffect, useRef } from 'react';

/**
 * P3-C6 — a thin bar across the top of the screen that fills as the post is
 * read. Progress goes into one custom property, so scrolling never
 * re-renders anything. It is feedback rather than decoration, but it has no
 * transition, so it never animates on its own.
 */
export function ReadingProgress({ targetId }: { targetId: string }) {
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const target = document.getElementById(targetId);
    const fill = bar.current;
    if (!target || !fill) return;
    let raf = 0;

    const update = () => {
      raf = 0;
      const r = target.getBoundingClientRect();
      const distance = r.height - window.innerHeight;
      const done = distance > 0 ? Math.min(1, Math.max(0, -r.top / distance)) : r.top <= 0 ? 1 : 0;
      fill.style.setProperty('--he-read', done.toFixed(4));
    };
    // A hidden page gets no animation frames; work it out directly then.
    const schedule = () => {
      if (document.hidden) update();
      else if (!raf) raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [targetId]);

  return (
    <div className="he-readbar" aria-hidden="true">
      <div ref={bar} className="he-readbar__fill" />
    </div>
  );
}
