'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/site/icons';
import { useMessages } from '@/components/site/Messages';
import { MOTION_EVENT, motionReduced } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { SiteImg } from '@/components/ui/SiteImg';
import type { SizesHint } from '@/lib/responsive';

/**
 * When an ambient video plays (2.17): only while at least a quarter of it is
 * on screen, never by itself for a visitor who wants less motion (the OS
 * setting or the site's switch), and always as the visitor last chose — a
 * press of play is consent to motion, a press of pause is final. A parent
 * that owns playback — a slider pausing its slides — passes `paused`.
 */
export function useAmbientPlayback(
  ref: React.RefObject<HTMLVideoElement | null>,
  paused?: boolean,
  /** Changes when the element is replaced — a new film — so it is watched afresh. */
  element?: unknown,
) {
  const [playing, setPlaying] = useState(false);
  const [choice, setChoice] = useState<'auto' | 'play' | 'pause'>('auto');
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver((entries) => setInView(entries.some((entry) => entry.isIntersecting)), { threshold: 0.25 });
    observer.observe(video);
    return () => observer.disconnect();
  }, [ref, element]);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const sync = () => {
      const wanted = choice === 'play' || (choice === 'auto' && !motionReduced());
      if (wanted && inView && paused !== true) void video.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
      else {
        video.pause();
        setPlaying(false);
      }
    };
    sync();
    window.addEventListener(MOTION_EVENT, sync);
    return () => window.removeEventListener(MOTION_EVENT, sync);
  }, [ref, choice, inView, paused, element]);

  return { playing, toggle: () => setChoice(playing ? 'pause' : 'play') };
}

export type VideoSourceFile = { src: string; type?: string };

/** `<source>`s in the order a browser should try them: WebM first, it is usually smaller. */
export function orderedSources(urls: (string | undefined)[]): VideoSourceFile[] {
  const files = urls.filter((url): url is string => !!url);
  const type = (url: string) => (/\.webm$/i.test(url) ? 'video/webm' : /\.mp4$/i.test(url) ? 'video/mp4' : undefined);
  return [...new Set(files)].sort((a, b) => Number(type(b) === 'video/webm') - Number(type(a) === 'video/webm')).map((src) => ({ src, type: type(src) }));
}

/**
 * A muted, looping background video with its own pause button (GL2).
 *
 * It plays only while it is on screen, never starts for a visitor who wants
 * less motion, and stops when they flip the site's reduce-motion switch —
 * though their own press of play still plays it. A parent that owns the
 * playback passes `paused` and hides the button.
 */
export function BgVideo({
  src,
  sources,
  poster,
  className,
  paused,
  showControl = true,
}: {
  src: string;
  /** More formats of the same film (2.17); `src` is used when this is empty. */
  sources?: VideoSourceFile[];
  poster?: string;
  className?: string;
  paused?: boolean;
  showControl?: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const t = useMessages();
  const { playing, toggle } = useAmbientPlayback(ref, paused);

  return (
    <>
      {sources && sources.length > 0 ? (
        <video ref={ref} poster={poster} muted loop playsInline preload="metadata" className={className} aria-hidden="true">
          {sources.map((file) => (
            <source key={file.src} src={file.src} type={file.type} />
          ))}
        </video>
      ) : (
        <video ref={ref} src={src} poster={poster} muted loop playsInline preload="metadata" className={className} aria-hidden="true" />
      )}
      {showControl && (
        <button type="button" className="he-media-pause" aria-label={playing ? t('media.pauseBackground') : t('media.playBackground')} onClick={toggle}>
          {playing ? <Icon.Pause size={16} /> : <Icon.Play size={16} />}
        </button>
      )}
    </>
  );
}

/** An image, a background video, or — when neither is set — a quiet placeholder. */
export function MediaFill({
  imageUrl,
  videoUrl,
  alt = '',
  className,
  eager = false,
  paused,
  showControl,
  sizes,
}: {
  imageUrl?: string;
  videoUrl?: string;
  alt?: string;
  className?: string;
  eager?: boolean;
  paused?: boolean;
  showControl?: boolean;
  /** Where the picture sits, for its `srcset` (2.17): a hint from lib/responsive.ts or a `sizes` value. */
  sizes?: SizesHint | string;
}) {
  if (videoUrl) {
    return <BgVideo src={videoUrl} poster={imageUrl} className={className} paused={paused} showControl={showControl} />;
  }
  if (imageUrl) {
    return <SiteImg src={imageUrl} alt={alt} className={className} loading={eager ? 'eager' : 'lazy'} decoding="async" sizes={sizes} priority={eager} />;
  }
  return <div className={cn(className, 'he-media-empty')} aria-hidden="true" />;
}
