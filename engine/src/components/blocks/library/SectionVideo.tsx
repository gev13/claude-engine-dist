'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/site/icons';
import { useMessages } from '@/components/site/Messages';
import type { BlockStyle } from '@/lib/blockStyle';
import { SECTION_VIDEO } from '@/lib/blockStyle';
import { useAmbientPlayback } from './media';

type Background = NonNullable<BlockStyle['background']>;

/** Phones, in the site's breakpoints: the Mobile tier. */
const PHONE = '(max-width: 768px)';

/**
 * A film behind a section or a row (T16, 2.17), laid under the overlay and
 * the content. The server writes only the poster: which film to fetch — the
 * desktop one, the phone one, or none — is decided in the browser, so a
 * phone never downloads the large file and a visitor with data saver on
 * downloads none. Playback follows the ambient rules (./media.tsx).
 *
 * The film sits behind the content; its pause button sits in front, as a
 * sibling — inside the film's layer the section's own band would cover it.
 */
export function SectionVideo({ background }: { background: Background }) {
  const t = useMessages();
  const ref = useRef<HTMLVideoElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const { playing, toggle } = useAmbientPlayback(ref, undefined, src);

  useEffect(() => {
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
    if (saveData) return;
    const query = window.matchMedia(PHONE);
    const pick = () => {
      const chosen = query.matches ? (background.videoMobile === 'poster' ? null : (background.videoMobileUrl ?? background.videoUrl)) : background.videoUrl;
      setSrc(chosen && SECTION_VIDEO.test(chosen) ? chosen : null);
    };
    pick();
    query.addEventListener('change', pick);
    return () => query.removeEventListener('change', pick);
  }, [background.videoUrl, background.videoMobileUrl, background.videoMobile]);

  const poster = background.videoPoster && /^\/[A-Za-z0-9._~\-/%]*$/.test(background.videoPoster) ? background.videoPoster : undefined;
  return (
    <>
      <div className="he-bgv" aria-hidden="true">
        {src ? (
          <video key={src} ref={ref} src={src} poster={poster} muted loop playsInline preload="metadata" className="he-bgv__media" />
        ) : poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={poster} alt="" className="he-bgv__media" loading="lazy" decoding="async" />
        ) : null}
      </div>
      {src && (
        <button type="button" className="he-media-pause" aria-label={playing ? t('media.pauseBackground') : t('media.playBackground')} onClick={toggle}>
          {playing ? <Icon.Pause size={16} /> : <Icon.Play size={16} />}
        </button>
      )}
    </>
  );
}
