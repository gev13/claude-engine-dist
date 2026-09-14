'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { MOTION_EVENT, motionReduced } from '@/lib/motion';
import { cn } from '@/lib/utils';

/**
 * SC3 — words light up one after another as the statement moves up the
 * screen. The server renders every word lit, and so does reduced motion; dim
 * words stay legible, they are never hidden. The words are ordinary text, so
 * screen readers and search engines read the sentence as written.
 */
export function KineticText({ text, className, as: Tag = 'p' }: { text: string; className?: string; as?: 'p' | 'span' }) {
  const ref = useRef<HTMLElement>(null);
  const parts = useMemo(() => text.split(/(\s+)/), [text]);
  const count = parts.filter((w) => w.trim()).length;
  const [lit, setLit] = useState(count);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;

    const update = () => {
      frame = 0;
      if (motionReduced()) {
        setLit(count);
        return;
      }
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      // 0 when the top edge enters low on the screen, 1 by the time it is
      // a little above the middle.
      const progress = (vh * 0.9 - rect.top) / (vh * 0.45 + rect.height);
      setLit(Math.round(Math.min(1, Math.max(0, progress)) * count));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    window.addEventListener(MOTION_EVENT, schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      window.removeEventListener(MOTION_EVENT, schedule);
    };
  }, [count]);

  let index = 0;
  return (
    <Tag ref={ref as React.RefObject<HTMLParagraphElement>} className={cn('he-kinetic', className)}>
      {parts.map((part, k) =>
        part.trim() ? (
          <span key={k} className={cn('he-kinetic__w', index++ < lit && 'is-lit')}>
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </Tag>
  );
}
