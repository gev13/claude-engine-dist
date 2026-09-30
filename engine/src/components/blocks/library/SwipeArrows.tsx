'use client';

import { useEffect, useRef, useState } from 'react';
import { useMessages } from '@/components/site/Messages';
import { motionReduced } from '@/lib/motion';
import { cn } from '@/lib/utils';

/* ═══════════════════════════════════════════════════════════════════════════
   ‹ › for a grid that swipes (3.22)
   ───────────────────────────────────────────────────────────────────────────
   Design → *Swipe sideways* turns a block's grid into a scroll-snap track in
   CSS alone. These buttons are the optional extra: rendered beside the
   block's content, they find the track in their own wrapper, show only while
   it can actually scroll (so a desktop that still draws the grid shows
   nothing), and move it by one card. The track stays the thing that scrolls,
   so swiping, the keyboard and a screen reader work exactly as before.
   ═══════════════════════════════════════════════════════════════════════════ */

const TRACK = '.he-swipe-track, [class*="grid-cols-"], :scope > .shell > [class^="he-r-"]';

export function SwipeArrows({ placement }: { placement: 'belowRight' | 'sides' }) {
  const ref = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLElement | null>(null);
  const t = useMessages();
  const [state, setState] = useState({ can: false, start: true, end: false, box: { top: 0, bottom: 0, left: 0, right: 0 } });

  useEffect(() => {
    const host = ref.current?.parentElement;
    if (!host) return;
    const track = host.querySelector<HTMLElement>(TRACK);
    if (!track) return;
    trackRef.current = track;

    const update = () => {
      const can = getComputedStyle(track).display === 'flex' && track.scrollWidth > track.clientWidth + 2;
      const max = track.scrollWidth - track.clientWidth;
      // Where the track sits inside the block, so the buttons can be placed against it.
      const t = track.getBoundingClientRect();
      const h = host.getBoundingClientRect();
      const box = { top: t.top - h.top, bottom: t.bottom - h.top, left: t.left - h.left, right: h.right - t.right };
      setState({ can, start: track.scrollLeft <= 2, end: track.scrollLeft >= max - 2, box });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(track);
    track.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      observer.disconnect();
      track.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  const step = (direction: 1 | -1) => {
    const track = trackRef.current;
    const first = track?.firstElementChild as HTMLElement | null;
    if (!track || !first) return;
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    track.scrollBy({ left: direction * (first.getBoundingClientRect().width + gap), behavior: motionReduced() ? 'auto' : 'smooth' });
  };

  return (
    <div
      ref={ref}
      className={cn('he-swipe-nav', `is-${placement}`)}
      hidden={!state.can}
      style={
        {
          '--he-swipe-top': `${state.box.top}px`,
          '--he-swipe-bottom': `${state.box.bottom}px`,
          '--he-swipe-left': `${state.box.left}px`,
          '--he-swipe-right': `${state.box.right}px`,
        } as React.CSSProperties
      }
    >
      <button type="button" className="he-swipe-nav__btn is-prev" aria-label={t('block.previousSlide')} disabled={state.start} onClick={() => step(-1)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 6l-6 6 6 6" />
        </svg>
      </button>
      <button type="button" className="he-swipe-nav__btn is-next" aria-label={t('block.nextSlide')} disabled={state.end} onClick={() => step(1)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 6l6 6-6 6" />
        </svg>
      </button>
    </div>
  );
}
