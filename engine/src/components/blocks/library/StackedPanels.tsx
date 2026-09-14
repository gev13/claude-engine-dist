'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { z } from 'zod';
import type { blockSchemas } from '@/lib/blocks';
import { cn } from '@/lib/utils';
import { BlockTitle } from '../parts';
import { MediaFill } from './media';

type P = z.output<(typeof blockSchemas)['stackedPanels']>;

/* HR7 — full-screen panels, each `position: sticky`, so the next one slides up
   over the one before as the page scrolls. The sliding is the browser's own
   scrolling, not an animation, so it needs no reduced-motion exception. The
   dots down the right edge follow whichever panel fills the screen. */

export function StackedPanels(p: P) {
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setCurrent(Number((entry.target as HTMLElement).dataset.index));
        }
      },
      { threshold: 0.6 },
    );
    refs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [p.panels.length]);

  return (
    <section className="he-stack he-bleed-top">
      {p.panels.map((panel, i) => (
        <div
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          data-index={i}
          className="he-stack__panel"
        >
          <MediaFill imageUrl={panel.imageUrl} videoUrl={panel.videoUrl} alt={panel.alt} className="he-stack__media" eager={i === 0} />
          <div className="shell he-stack__inner">
            <div className="he-stack__text">
              {panel.eyebrow && <div className="he-stack__eyebrow">{panel.eyebrow}</div>}
              <BlockTitle as={i === 0 ? (p.titleAs ?? 'h2') : 'h2'} className="he-stack__title">
                {panel.title}
              </BlockTitle>
              {panel.body && <p className="he-stack__body">{panel.body}</p>}
              {panel.href && (
                <Link href={panel.href} className="he-btn he-btn-primary he-stack__cta">
                  {panel.buttonLabel || 'Discover more'}
                </Link>
              )}
            </div>
          </div>
        </div>
      ))}

      {p.panels.length > 1 && (
        <div className="he-stack__rail" aria-hidden="true">
          <div className="he-stack__dots">
            {p.panels.map((_, i) => (
              <span key={i} className={cn('he-stack__dot', i === current && 'is-active')} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
