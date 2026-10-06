import type { z } from 'zod';
import type { blockSchemas } from '@/lib/blocks';
import { mediaShape } from '@/server/media/lookup';
import { ImageBlock } from '.';

type P = z.output<(typeof blockSchemas)['image']>;

/**
 * 3.27 — the image block, with the picture's stored size filled in from the
 * library when the block holds only its address. Without a width and height
 * a lazy picture is 0px tall until it loads, and the page jumps as it does
 * (layout shift, anchors landing short, entrances firing early). A size the
 * block already carries wins; a picture outside the library renders as before.
 */
export async function ImageSource(p: P) {
  if (p.width && p.height) return <ImageBlock {...p} />;
  const shape = await mediaShape(p.url);
  return shape ? <ImageBlock {...p} width={shape.width} height={shape.height} /> : <ImageBlock {...p} />;
}
