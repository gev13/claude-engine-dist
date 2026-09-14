'use client';

import { useEffect, useRef } from 'react';
import { MOTION_EVENT, motionReduced } from '@/lib/motion';
import { cn } from '@/lib/utils';

/* ═══════════════════════════════════════════════════════════════════════════
   P4-A5 — the layered hero's depth
   ───────────────────────────────────────────────────────────────────────────
   Each picture sits at its own depth and moves at its own speed: the page's
   scroll separates them, and on a machine with a pointer they lean towards it
   as well. Both are written to CSS variables — the stylesheet decides how far
   each depth travels — and both stop for anyone who asks for less motion, so
   the hero is then simply three pictures, still.
   ═══════════════════════════════════════════════════════════════════════════ */

export type HeroLayer = { imageUrl: string; alt?: string; depth: 'back' | 'middle' | 'front' };

export function HeroLayers({ layers, pointer, children }: { layers: HeroLayer[]; pointer: boolean; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let frame = 0;
    const set = (name: string, value: string) => el.style.setProperty(name, value);

    const reset = () => {
      set('--sy', '0');
      set('--px', '0');
      set('--py', '0');
    };

    const onScroll = () => {
      if (motionReduced()) return;
      const rect = el.getBoundingClientRect();
      // 0 while the hero fills the view, 1 once it has scrolled away.
      const progress = Math.min(1, Math.max(0, -rect.top / Math.max(1, rect.height)));
      set('--sy', progress.toFixed(4));
    };

    const onPointer = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || motionReduced()) return;
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const rect = el.getBoundingClientRect();
        set('--px', (((event.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1).toFixed(4));
        set('--py', (((event.clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1).toFixed(4));
      });
    };

    const onMotionChange = () => {
      if (motionReduced()) reset();
      else onScroll();
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    window.addEventListener(MOTION_EVENT, onMotionChange);
    if (pointer) el.addEventListener('pointermove', onPointer);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      window.removeEventListener(MOTION_EVENT, onMotionChange);
      el.removeEventListener('pointermove', onPointer);
    };
  }, [pointer]);

  return (
    <div ref={ref} className={cn('he-hero__layers', pointer && 'is-pointer')}>
      {children}
      {layers.map((layer, i) => (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img key={`${layer.imageUrl}-${i}`} src={layer.imageUrl} alt={layer.alt || ''} className={cn('he-hero__layer', `is-${layer.depth}`)} loading="lazy" />
      ))}
    </div>
  );
}
