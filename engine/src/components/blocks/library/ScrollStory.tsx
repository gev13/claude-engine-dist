'use client';

import { useEffect, useRef, useState } from 'react';
import type { z } from 'zod';
import type { blockSchemas } from '@/lib/blocks';
import { cn } from '@/lib/utils';
import { BlockHead } from '../parts';
import { MediaFill } from './media';

type P = z.output<(typeof blockSchemas)['scrollStory']>;

const TONES = { base: '', raised: 'is-raised', flare: 'is-flare' } as const;

/**
 * SC1 — a list of steps beside a pinned picture. The step crossing the middle
 * of the screen becomes active and the picture follows it. Inactive steps are
 * dimmed, never hidden. On phones the pinned picture goes and each step shows
 * its own above its text.
 */
export function ScrollStory(p: P) {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(Number((entry.target as HTMLElement).dataset.index));
        }
      },
      { rootMargin: '-45% 0px -45% 0px' },
    );
    refs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [p.items.length]);

  return (
    <section className={cn('he-lsec he-story', TONES[p.tone ?? 'base'])}>
      <div className="shell">
        <BlockHead eyebrow={p.eyebrow} title={p.title} titleAs={p.titleAs} intro={p.intro} />
        <div className="he-story__grid">
          <ol className="he-story__list">
            {p.items.map((item, i) => (
              <li
                key={item.title + i}
                ref={(el) => {
                  refs.current[i] = el;
                }}
                data-index={i}
                className={cn('he-story__item', i === active && 'is-active')}
                aria-current={i === active ? 'step' : undefined}
              >
                {item.imageUrl && (
                  <div className="he-story__inline">
                    <MediaFill imageUrl={item.imageUrl} alt={item.alt} className="he-fill" />
                  </div>
                )}
                {p.numbered && <span className="he-story__num">{String(i + 1).padStart(2, '0')}</span>}
                <h3 className="he-story__title">{item.title}</h3>
                {item.body && <p className="he-story__body">{item.body}</p>}
              </li>
            ))}
          </ol>
          <div className="he-story__stage" aria-hidden="true">
            {p.items.map((item, i) => (
              <div key={item.title + i} className={cn('he-story__img', i === active && 'is-active')}>
                <MediaFill imageUrl={item.imageUrl} alt="" className="he-fill" showControl={false} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
