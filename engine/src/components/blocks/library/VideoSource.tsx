import type { z } from 'zod';
import type { blockSchemas } from '@/lib/blocks';
import { parseVideoUrl } from '@/lib/embeds';
import { cn } from '@/lib/utils';
import { mediaShape } from '@/server/media/lookup';
import { BlockHead } from '../parts';
import { AmbientVideo } from './AmbientVideo';
import { VideoBlock } from './showcase';

type P = z.output<(typeof blockSchemas)['video']>;

const TONES = { base: '', raised: 'is-raised', flare: 'is-flare' } as const;

/**
 * The video block. Players render as they always have; an ambient film
 * (2.17) is looked up in the library here, on the server, so its box has the
 * file's own shape in the HTML. A YouTube or Vimeo link cannot be ambient —
 * it has no file to loop — so it gets the ordinary player.
 */
export async function VideoSource(p: P) {
  if (p.display !== 'ambient') return <VideoBlock {...p} />;
  if (parseVideoUrl(p.source)?.kind !== 'file') return <VideoBlock {...p} display="inline" />;
  const shape = p.ratio === 'auto' ? await mediaShape(p.source) : null;
  const head = (p.eyebrow || p.title || p.intro) && <BlockHead eyebrow={p.eyebrow} title={p.title} titleAs={p.titleAs} intro={p.intro} className="mb-9" />;
  // 3.22 — edge to edge of the screen, and with no space of its own above and below.
  if (p.bleed) {
    return (
      <section className={cn('he-lsec he-video-sec is-bleed', TONES[p.tone ?? 'base'], p.flush && 'is-flush')}>
        {head && <div className="shell">{head}</div>}
        <AmbientVideo p={p} shape={shape} />
      </section>
    );
  }
  return (
    <section className={cn('he-lsec he-video-sec', TONES[p.tone ?? 'base'], p.flush && 'is-flush')}>
      <div className="shell">
        {head}
        <AmbientVideo p={p} shape={shape} />
      </div>
    </section>
  );
}
