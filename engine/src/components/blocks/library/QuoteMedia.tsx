'use client';

import { useState } from 'react';
import { Icon } from '@/components/site/icons';
import { MediaFill } from './media';

/**
 * The media card beside a quote (CT10). With a video it shows the image and a
 * play button; the video only loads, with its own controls and sound, once
 * someone asks for it — never as a background loop.
 */
export function QuoteMedia({
  imageUrl,
  videoUrl,
  alt,
  label,
}: {
  imageUrl?: string;
  videoUrl?: string;
  alt?: string;
  label?: string;
}) {
  const [playing, setPlaying] = useState(false);

  if (videoUrl && playing) {
    return (
      <div className="he-qmedia">
        <video src={videoUrl} poster={imageUrl} controls autoPlay playsInline className="he-fill" />
      </div>
    );
  }

  return (
    <div className="he-qmedia">
      <MediaFill imageUrl={imageUrl} alt={alt} className="he-fill" />
      {videoUrl && (
        <button type="button" className="he-qmedia__play" onClick={() => setPlaying(true)}>
          <span className="he-qmedia__circle" aria-hidden="true">
            <Icon.Play size={14} />
          </span>
          {label || 'Watch the video'}
        </button>
      )}
    </div>
  );
}
