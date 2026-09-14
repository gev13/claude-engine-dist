'use client';

import { useEffect, useRef, useState } from 'react';
import type { z } from 'zod';
import { Eyebrow } from '@/components/ui/Eyebrow';
import type { blockSchemas } from '@/lib/blocks';
import { MOTION_EVENT, motionReduced } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { BlockTitle } from '../parts';
import { MediaFill } from './media';

type P = z.output<(typeof blockSchemas)['pinnedMedia']>;

const TONES = { base: '', raised: 'is-raised', flare: 'is-flare' } as const;

/**
 * SC2 — the section holds still for a screen or two while its video advances
 * with the scroll (or, without a video, its picture slowly zooms).
 *
 * Progress is written to one custom property on the frame rather than into
 * React state, so scrolling never re-renders the component. With reduced
 * motion the section does not pin at all and shows a still frame.
 */
export function PinnedMedia(p: P) {
  const sectionRef = useRef<HTMLElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [still, setStill] = useState(false);

  useEffect(() => {
    const section = sectionRef.current;
    const frame = frameRef.current;
    if (!section || !frame) return;
    let raf = 0;

    const update = () => {
      raf = 0;
      const reduced = motionReduced();
      setStill(reduced);
      if (reduced) {
        frame.style.setProperty('--p', '0');
        return;
      }
      const rect = section.getBoundingClientRect();
      const travel = rect.height - window.innerHeight;
      const progress = travel > 0 ? Math.min(1, Math.max(0, -rect.top / travel)) : 0;
      frame.style.setProperty('--p', progress.toFixed(4));
      const video = videoRef.current;
      if (video && Number.isFinite(video.duration) && video.duration > 0) {
        video.currentTime = progress * video.duration;
      }
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    update();
    const video = videoRef.current;
    video?.addEventListener('loadedmetadata', schedule);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    window.addEventListener(MOTION_EVENT, schedule);
    return () => {
      cancelAnimationFrame(raf);
      video?.removeEventListener('loadedmetadata', schedule);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      window.removeEventListener(MOTION_EVENT, schedule);
    };
  }, []);

  return (
    <section ref={sectionRef} className={cn('he-pin', TONES[p.tone ?? 'base'], `is-${p.length}`, still && 'is-still')}>
      <div className="he-pin__sticky">
        {(p.title || p.eyebrow || p.body) && (
          <div className="shell he-pin__head">
            {p.eyebrow && <Eyebrow className="justify-center">{p.eyebrow}</Eyebrow>}
            {p.title && <BlockTitle as={p.titleAs}>{p.title}</BlockTitle>}
            {p.body && <p className="he-lbody">{p.body}</p>}
          </div>
        )}
        <div ref={frameRef} className="he-pin__frame">
          {p.videoUrl ? (
            <video
              ref={videoRef}
              src={p.videoUrl}
              poster={p.imageUrl}
              muted
              playsInline
              preload="auto"
              className="he-fill"
              aria-label={p.alt}
            />
          ) : (
            <MediaFill imageUrl={p.imageUrl} alt={p.alt} className="he-fill he-pin__img" showControl={false} />
          )}
          <span className="he-pin__bar" aria-hidden="true" />
        </div>
      </div>
    </section>
  );
}
