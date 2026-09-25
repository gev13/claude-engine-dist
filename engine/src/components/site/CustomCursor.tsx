'use client';

import { useEffect, useRef, useState } from 'react';
import { MOTION_EVENT, motionReduced } from '@/lib/motion';

type Style = 'dotRing' | 'dot' | 'ring' | 'blend';

/**
 * A pointer of the site's own (T27, 2.19): a dot, a ring that trails it, or
 * both, or a disc that inverts what is under it.
 *
 * Only for a mouse — `(pointer: fine)` — and never for a visitor who asked
 * for less motion; either way nothing is drawn and the system pointer stays.
 * Over a text field the native caret is kept, and the pointer grows over
 * links and buttons. One `requestAnimationFrame` loop moves both parts with
 * transforms, so the page never re-renders for it. `pointer-events: none`
 * throughout, so it cannot get in the way of a click.
 */
export function CustomCursor({ style, mediaLabel }: { style: Style; mediaLabel?: string }) {
  const dot = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    const fine = window.matchMedia('(pointer: fine)');
    const decide = () => setActive(fine.matches && !motionReduced());
    decide();
    fine.addEventListener('change', decide);
    window.addEventListener(MOTION_EVENT, decide);
    return () => {
      fine.removeEventListener('change', decide);
      window.removeEventListener(MOTION_EVENT, decide);
    };
  }, []);

  useEffect(() => {
    if (!active) return;
    const root = document.documentElement;
    root.classList.add('he-has-cursor');

    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;
    let rx = x;
    let ry = y;
    let frame = 0;
    let visible = false;

    const loop = () => {
      // The ring closes 18% of the gap each frame — a soft lag behind the dot.
      rx += (x - rx) * 0.18;
      ry += (y - ry) * 0.18;
      if (dot.current) dot.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      if (ring.current) ring.current.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
      frame = requestAnimationFrame(loop);
    };

    const move = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      x = event.clientX;
      y = event.clientY;
      if (!visible) {
        visible = true;
        root.classList.add('he-cursor-in');
        rx = x;
        ry = y;
      }
      const target = event.target as Element | null;
      const field = target?.closest('input, textarea, select, [contenteditable="true"], iframe');
      const link = target?.closest('a, button, [role="button"], label, summary');
      const media = mediaLabel ? target?.closest('img, video, picture, .he-fill') : null;
      root.classList.toggle('he-cursor-text', Boolean(field));
      root.classList.toggle('he-cursor-link', Boolean(link) && !field);
      setLabel(media && !link ? mediaLabel! : null);
    };
    const leave = () => {
      visible = false;
      root.classList.remove('he-cursor-in');
    };
    const down = () => root.classList.add('he-cursor-down');
    const up = () => root.classList.remove('he-cursor-down');

    frame = requestAnimationFrame(loop);
    window.addEventListener('pointermove', move, { passive: true });
    document.addEventListener('pointerleave', leave);
    window.addEventListener('pointerdown', down);
    window.addEventListener('pointerup', up);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', move);
      document.removeEventListener('pointerleave', leave);
      window.removeEventListener('pointerdown', down);
      window.removeEventListener('pointerup', up);
      root.classList.remove('he-has-cursor', 'he-cursor-in', 'he-cursor-text', 'he-cursor-link', 'he-cursor-down');
    };
  }, [active, mediaLabel]);

  if (!active) return null;
  const showDot = style === 'dotRing' || style === 'dot' || style === 'blend';
  const showRing = style === 'dotRing' || style === 'ring';
  return (
    <div className={`he-cursor is-${style}`} aria-hidden="true">
      {showRing && <div ref={ring} className="he-cursor__ring" />}
      {showDot && (
        <div ref={dot} className="he-cursor__dot">
          {label && <span className="he-cursor__label">{label}</span>}
        </div>
      )}
    </div>
  );
}
