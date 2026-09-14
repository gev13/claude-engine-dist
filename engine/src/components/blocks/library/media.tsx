'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/site/icons';
import { MOTION_EVENT, motionReduced } from '@/lib/motion';
import { cn } from '@/lib/utils';

/**
 * A muted, looping background video with its own pause button (GL2).
 *
 * It never starts for a visitor who wants less motion, and it stops when they
 * flip the site's reduce-motion switch. A parent that owns the playback — a
 * slider pausing its slides — passes `paused` and hides the button.
 */
export function BgVideo({
  src,
  poster,
  className,
  paused,
  showControl = true,
}: {
  src: string;
  poster?: string;
  className?: string;
  paused?: boolean;
  showControl?: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [userPaused, setUserPaused] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const sync = () => {
      const shouldPlay = !motionReduced() && !userPaused && paused !== true;
      if (shouldPlay) void video.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
      else {
        video.pause();
        setPlaying(false);
      }
    };
    sync();
    window.addEventListener(MOTION_EVENT, sync);
    return () => window.removeEventListener(MOTION_EVENT, sync);
  }, [userPaused, paused]);

  return (
    <>
      <video ref={ref} src={src} poster={poster} muted loop playsInline preload="metadata" className={className} aria-hidden="true" />
      {showControl && (
        <button
          type="button"
          className="he-media-pause"
          aria-label={playing ? 'Pause background video' : 'Play background video'}
          onClick={() => setUserPaused(playing)}
        >
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
}: {
  imageUrl?: string;
  videoUrl?: string;
  alt?: string;
  className?: string;
  eager?: boolean;
  paused?: boolean;
  showControl?: boolean;
}) {
  if (videoUrl) {
    return <BgVideo src={videoUrl} poster={imageUrl} className={className} paused={paused} showControl={showControl} />;
  }
  if (imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={imageUrl} alt={alt} className={className} loading={eager ? 'eager' : 'lazy'} decoding="async" />;
  }
  return <div className={cn(className, 'he-media-empty')} aria-hidden="true" />;
}
