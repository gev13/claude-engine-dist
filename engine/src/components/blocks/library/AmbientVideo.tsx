'use client';

import { useRef, type CSSProperties } from 'react';
import type { z } from 'zod';
import { Icon } from '@/components/site/icons';
import { useMessages } from '@/components/site/Messages';
import type { blockSchemas } from '@/lib/blocks';
import { cn } from '@/lib/utils';
import { orderedSources, useAmbientPlayback } from './media';

type P = z.output<(typeof blockSchemas)['video']>;

/**
 * The video block's `ambient` display (T15, 2.17): a film as a moving
 * picture. Muted, looped, inline, no player chrome; it plays only while a
 * quarter of it is on screen and never by itself for a visitor who wants
 * less motion — they see the poster and a play button. The box is the
 * film's own shape from the start (`ratio: auto`, read at upload), so
 * nothing moves when it loads.
 */
export function AmbientVideo({ p, shape }: { p: P; shape: { width: number; height: number } | null }) {
  const t = useMessages();
  const ref = useRef<HTMLVideoElement>(null);
  const { playing, toggle } = useAmbientPlayback(ref);
  const sources = orderedSources([p.source, ...p.sources]);

  const ratio = p.ratio === 'auto' ? (shape ? `${shape.width} / ${shape.height}` : '16 / 9') : p.ratio.replace('/', ' / ');
  const style = { aspectRatio: ratio } as CSSProperties;

  return (
    <figure className={cn('he-ambient', `is-${p.maxWidth}`, p.rounded && 'is-rounded')}>
      <div className="he-ambient__frame" style={style} role="img" aria-label={p.videoTitle}>
        <video ref={ref} poster={p.posterUrl} muted loop playsInline preload="metadata" className={cn('he-ambient__video', `is-${p.fit}`)} aria-hidden="true">
          {sources.map((file) => (
            <source key={file.src} src={file.src} type={file.type} />
          ))}
        </video>
        {/* Always there while it is still — the only way to start it for somebody who asked for less motion. */}
        {(p.controls || !playing) && (
          <button type="button" className="he-media-pause" aria-label={`${playing ? t('media.pause') : t('media.playVideo')}: ${p.videoTitle}`} onClick={toggle}>
            {playing ? <Icon.Pause size={16} /> : <Icon.Play size={16} />}
          </button>
        )}
      </div>
      {p.caption && <figcaption className="he-show__caption">{p.caption}</figcaption>}
    </figure>
  );
}
