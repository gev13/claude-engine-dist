'use client';

import Link from '@/components/ui/SiteLink';
import { useRef, useState } from 'react';
import type { z } from 'zod';
import { Icon } from '@/components/site/icons';
import type { blockSchemas } from '@/lib/blocks';
import { cn } from '@/lib/utils';
import { BlockHead } from '../parts';
import { Stars } from './Stars';

type P = z.output<(typeof blockSchemas)['marquee']>;
type Item = P['items'][number];

/* SL3 — an endless strip. The items are drawn twice and the pair slides by
   exactly half its width, so the loop has no seam. Hover pauses it (or, with
   `hoverSlow`, slows it right down), the button pauses it for good, and under
   reduced motion it stops and becomes a list you can scroll by hand (the
   stylesheet handles that part). V11 adds big text with separators. */

const DURATION = { slow: 60, normal: 38, fast: 22 } as const;
const TONES = { base: '', raised: 'is-raised', flare: 'is-flare' } as const;
const SEPARATORS = { dot: '•', star: '✦', slash: '/', none: null } as const;

function ItemView({ item, kind, ratio }: { item: Item; kind: P['kind']; ratio: P['photoRatio'] }) {
  let inner: React.ReactNode;

  if (kind === 'photos') {
    // P3-B7 — the caption says what the picture shows, so the picture itself needs no second description.
    inner = (
      <figure className="he-mq__photo">
        <span className="he-mq__pframe" style={{ aspectRatio: ratio.replace('/', ' / ') }}>
          {item.imageUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={item.imageUrl} alt={item.label ? '' : 'Photo'} className="he-fill" loading="lazy" />
          ) : (
            <span className="he-fill he-media-empty" aria-hidden="true" />
          )}
        </span>
        {item.label && <figcaption>{item.label}</figcaption>}
      </figure>
    );
  } else if (kind === 'logos') {
    inner = item.imageUrl ? (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img src={item.imageUrl} alt={item.label ?? ''} className="he-mq__logo" loading="lazy" />
    ) : (
      <span className="he-mq__wordmark">{item.label}</span>
    );
  } else if (kind === 'quotes') {
    inner = (
      <figure className="he-mq__quote">
        {item.rating !== undefined && <Stars value={item.rating} />}
        {item.quote && <blockquote>&ldquo;{item.quote}&rdquo;</blockquote>}
        <figcaption>
          {item.imageUrl && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={item.imageUrl} alt="" className="he-mq__avatar" loading="lazy" />
          )}
          <span>
            {item.name && <strong>{item.name}</strong>}
            {item.role && <span>{item.role}</span>}
          </span>
        </figcaption>
      </figure>
    );
  } else if (kind === 'text') {
    inner = <span className="he-mq__text">{item.label}</span>;
  } else {
    inner = (
      <span className="he-mq__chip">
        {item.imageUrl && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={item.imageUrl} alt="" loading="lazy" />
        )}
        {item.label}
      </span>
    );
  }

  return item.href ? (
    <Link href={item.href} className="he-mq__item">
      {inner}
    </Link>
  ) : (
    <div className="he-mq__item">{inner}</div>
  );
}

export function Marquee(p: P) {
  const [paused, setPaused] = useState(false);
  const rowsRef = useRef<HTMLDivElement>(null);
  const rows = p.rows === 2 ? [p.items, [...p.items].reverse()] : [p.items];
  const separator = p.kind === 'text' ? SEPARATORS[p.separator] : null;

  // Slowing down, unlike pausing, has to change the running animation's rate.
  const setRate = (rate: number) => {
    if (!p.hoverSlow) return;
    rowsRef.current?.querySelectorAll('.he-mq__track').forEach((track) => {
      track.getAnimations().forEach((animation) => animation.updatePlaybackRate(rate));
    });
  };

  return (
    <section className={cn('he-mq', `he-mq--${p.kind}`, TONES[p.tone ?? 'base'], paused && 'is-paused', p.hoverSlow && 'is-hover-slow')}>
      {(p.title || p.eyebrow || p.intro) && (
        <div className="shell he-mq__head">
          <BlockHead eyebrow={p.eyebrow} title={p.title} titleAs={p.titleAs} intro={p.intro} align="center" />
        </div>
      )}
      <div
        ref={rowsRef}
        className="he-mq__rows"
        style={{ '--he-mq-dur': `${DURATION[p.speed]}s` } as React.CSSProperties}
        onPointerEnter={() => setRate(0.25)}
        onPointerLeave={() => setRate(1)}
      >
        {rows.map((items, r) => (
          <div key={r} className={cn('he-mq__row', (r === 1) !== (p.direction === 'right') && 'is-reverse')}>
            <div className="he-mq__track">
              {[...items, ...items].map((item, i) => (
                <div key={i} className="he-mq__cell" aria-hidden={i >= items.length ? 'true' : undefined}>
                  <ItemView item={item} kind={p.kind} ratio={p.photoRatio} />
                  {separator && (
                    <span className="he-mq__sep" aria-hidden="true">
                      {separator}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="shell he-mq__foot">
        <button type="button" className="he-pause" onClick={() => setPaused((v) => !v)} aria-label={paused ? 'Resume scrolling' : 'Pause scrolling'}>
          {paused ? <Icon.Play size={16} /> : <Icon.Pause size={16} />}
        </button>
      </div>
    </section>
  );
}
