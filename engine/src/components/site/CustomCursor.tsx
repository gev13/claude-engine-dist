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
export function CustomCursor({
  style,
  mediaLabel,
  linkedMedia = 'off',
  discSize,
  discColor,
}: {
  style: Style;
  mediaLabel?: string;
  /** 3.24 — over a linked picture: nothing more (as before), the word, or a disc with an arrow. */
  linkedMedia?: 'off' | 'word' | 'arrow';
  discSize?: number;
  discColor?: string;
}) {
  const dot = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const [label, setLabel] = useState<string | null>(null);
  const [disc, setDisc] = useState(false);

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
    let last = performance.now();

    const loop = (now: number = performance.now()) => {
      /* The ring closes 18% of the gap each 60th of a second — a soft lag
         behind the dot. (3.22) Measured in time, not frames: per frame, it ran
         twice as fast on a 120 Hz screen. */
      const dt = Math.min(100, Math.max(0, now - last));
      last = now;
      const k = 1 - Math.pow(1 - 0.18, dt / (1000 / 60));
      rx += (x - rx) * k;
      ry += (y - ry) * k;
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
      const media = mediaLabel || linkedMedia !== 'off' ? target?.closest('img, video, picture, .he-fill') : null;
      // 3.24 — a picture inside a link: the word, or the disc with an arrow, when the site asks for one.
      const linkedPicture = Boolean(media && link && link.tagName === 'A' && linkedMedia !== 'off');
      root.classList.toggle('he-cursor-text', Boolean(field));
      root.classList.toggle('he-cursor-link', Boolean(link) && !field && !(linkedPicture && linkedMedia === 'arrow'));
      root.classList.toggle('he-cursor-media', linkedPicture && linkedMedia === 'arrow');
      setDisc(linkedPicture && linkedMedia === 'arrow');
      setLabel(mediaLabel && media && (!link || (linkedPicture && linkedMedia === 'word')) ? mediaLabel : null);
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
      root.classList.remove('he-has-cursor', 'he-cursor-in', 'he-cursor-text', 'he-cursor-link', 'he-cursor-down', 'he-cursor-media');
    };
  }, [active, mediaLabel, linkedMedia]);

  if (!active) return null;
  const showDot = style === 'dotRing' || style === 'dot' || style === 'blend';
  const showRing = style === 'dotRing' || style === 'ring';
  // 3.24 — the disc rides on the dot; a ring-only pointer gets a dot of its own to carry it.
  const discVars =
    discSize || discColor
      ? ({ ...(discSize ? { '--he-cursor-disc': `${discSize}px` } : {}), ...(discColor ? { '--he-cursor-disc-bg': discColor } : {}) } as React.CSSProperties)
      : undefined;
  return (
    <div className={`he-cursor is-${style}`} aria-hidden="true" style={discVars}>
      {showRing && <div ref={ring} className="he-cursor__ring" />}
      {(showDot || linkedMedia === 'arrow') && (
        <div ref={dot} className={showDot ? 'he-cursor__dot' : 'he-cursor__dot is-carrier'}>
          {label && <span className="he-cursor__label">{label}</span>}
          {disc && (
            <span className="he-cursor__disc">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 17 17 7M8 7h9v9" />
              </svg>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
