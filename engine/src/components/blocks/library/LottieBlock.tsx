'use client';

import type { AnimationItem } from 'lottie-web';
import { useEffect, useRef, useState } from 'react';
import type { z } from 'zod';
import type { blockSchemas } from '@/lib/blocks';
import { scrollProgress } from '@/lib/lottie';
import { MOTION_EVENT, motionReduced } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { BlockHead } from '../parts';

/* ═══════════════════════════════════════════════════════════════════════════
   P3-F — the Lottie block
   ───────────────────────────────────────────────────────────────────────────
   The light SVG player and the file are both fetched only once the block is
   on a page, so pages without one carry none of it. Before it plays, and for
   anyone who asks for less motion, the block holds its still frame.
   ═══════════════════════════════════════════════════════════════════════════ */

type P = z.output<(typeof blockSchemas)['lottie']>;

const TONES = { base: '', raised: 'is-raised', flare: 'is-flare' } as const;

/** Wires one play mode to an animation that is loaded and resting; returns its teardown. */
function startMode(anim: AnimationItem, play: P['play'], host: HTMLElement, stage: HTMLElement): () => void {
  const last = Math.max(0, anim.totalFrames - 1);

  if (play === 'scroll') {
    const follow = () => {
      const rect = stage.getBoundingClientRect();
      anim.goToAndStop(scrollProgress(rect.top, rect.height, window.innerHeight) * last, true);
    };
    follow();
    window.addEventListener('scroll', follow, { passive: true });
    window.addEventListener('resize', follow);
    return () => {
      window.removeEventListener('scroll', follow);
      window.removeEventListener('resize', follow);
    };
  }

  // Hover needs a mouse; on touch screens it plays once, like `once`.
  if (play === 'hover' && window.matchMedia('(hover: hover)').matches) {
    const forward = () => {
      anim.setDirection(1);
      anim.play();
    };
    const back = () => {
      anim.setDirection(-1);
      anim.play();
    };
    host.addEventListener('pointerenter', forward);
    host.addEventListener('pointerleave', back);
    return () => {
      host.removeEventListener('pointerenter', forward);
      host.removeEventListener('pointerleave', back);
    };
  }

  // A loop runs only while it can be seen; `once` starts the first time it is.
  const observer = new IntersectionObserver(
    ([entry]) => {
      if (!entry) return;
      if (play === 'loop') {
        if (entry.isIntersecting) anim.play();
        else anim.pause();
      } else if (entry.isIntersecting) {
        anim.goToAndPlay(0, true);
        observer.disconnect();
      }
    },
    { threshold: play === 'loop' ? 0 : 0.4 },
  );
  observer.observe(stage);
  return () => observer.disconnect();
}

export function LottieBlock(p: P) {
  const host = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const [ratio, setRatio] = useState(p.width && p.height ? `${p.width} / ${p.height}` : undefined);

  useEffect(() => {
    const el = stage.current;
    const section = host.current;
    if (!el || !section || !p.url) return;

    const controller = new AbortController();
    let anim: AnimationItem | null = null;
    let stop = () => {};
    let cancelled = false;

    const rest = (item: AnimationItem) => item.goToAndStop(p.still === 'last' ? Math.max(0, item.totalFrames - 1) : 0, true);
    const apply = () => {
      if (!anim) return;
      stop();
      stop = () => {};
      anim.pause();
      anim.setDirection(1);
      rest(anim);
      if (!motionReduced()) stop = startMode(anim, p.play, section, el);
    };

    void (async () => {
      try {
        const [{ default: lottie }, data] = await Promise.all([
          import('lottie-web/build/player/lottie_light'),
          fetch(p.url, { signal: controller.signal }).then((res) => {
            if (!res.ok) throw new Error(`Lottie file answered ${res.status}`);
            return res.json() as Promise<{ w?: unknown; h?: unknown }>;
          }),
        ]);
        if (cancelled) return;
        if (typeof data.w === 'number' && typeof data.h === 'number') setRatio(`${data.w} / ${data.h}`);

        anim = lottie.loadAnimation({
          container: el,
          renderer: 'svg',
          loop: p.play === 'loop',
          autoplay: false,
          animationData: data,
          rendererSettings: { preserveAspectRatio: 'xMidYMid meet' },
        });
        anim.setSpeed(p.speed);
        if (anim.isLoaded) apply();
        else anim.addEventListener('DOMLoaded', apply);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    window.addEventListener(MOTION_EVENT, apply);
    return () => {
      cancelled = true;
      controller.abort();
      window.removeEventListener(MOTION_EVENT, apply);
      stop();
      anim?.destroy();
    };
  }, [p.url, p.play, p.speed, p.still]);

  if (!p.url) return null;
  const headAlign = p.align === 'center' ? 'center' : 'left';

  return (
    <section
      ref={host}
      className={cn('he-lsec he-lot', TONES[p.tone ?? 'base'], `is-${p.size}`, `is-${p.align}`, p.color !== 'original' && `is-${p.color}`)}
      data-play={p.play}
    >
      <div className="shell">
        {(p.eyebrow || p.title || p.intro) && <BlockHead eyebrow={p.eyebrow} title={p.title} titleAs={p.titleAs} intro={p.intro} align={headAlign} className="mb-9" />}
        <figure className="he-lot__fig">
          <div
            ref={stage}
            className="he-lot__stage"
            style={ratio ? { aspectRatio: ratio } : undefined}
            role={p.label ? 'img' : undefined}
            aria-label={p.label || undefined}
            aria-hidden={p.label ? undefined : true}
            hidden={failed}
          />
          {p.caption && <figcaption className="he-lot__cap">{p.caption}</figcaption>}
        </figure>
      </div>
    </section>
  );
}
