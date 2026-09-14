import 'server-only';
import { createHash } from 'node:crypto';
import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import sharp from 'sharp';
import { DEMO_ANIMATIONS, type DemoAnimation, demoAnimationFile } from '@/content/demo/animations';
import { DEMO_IMAGES, type DemoImage, demoImageFile } from '@/content/demo/images';
import { db } from '@/server/db';
import { media } from '@/server/db/schema';
import { resolveStoredPath } from './storage';

/* ═══════════════════════════════════════════════════════════════════════════
   Demo media
   ───────────────────────────────────────────────────────────────────────────
   The demo pictures and Lottie animations are drawn in code
   (src/content/demo). The demo seed writes all of them; a page template or
   ready section writes only the ones it uses, when it is used — so a site
   that never ran the demo seed still gets working pictures from a template.
   ═══════════════════════════════════════════════════════════════════════════ */

async function store(filename: string, buffer: Buffer) {
  const absolute = resolveStoredPath(filename);
  if (!absolute) throw new Error(`Unsafe demo media path: ${filename}`);
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, buffer);
}

const checksum = (buffer: Buffer) => createHash('sha256').update(buffer).digest('hex');

/** Render one demo picture into the media directory; returns the values for its media row. */
export async function writeDemoImage(image: DemoImage) {
  const filename = demoImageFile(image);
  const raster = sharp(Buffer.from(image.svg)).resize(image.width, image.height);
  const buffer = await (image.format === 'png' ? raster.png({ compressionLevel: 9 }) : raster.webp({ quality: 82 })).toBuffer();
  await store(filename, buffer);
  return {
    filename,
    originalName: `${image.name}.${image.format}`,
    mimeType: image.format === 'png' ? 'image/png' : 'image/webp',
    extension: image.format,
    byteSize: buffer.byteLength,
    width: image.width,
    height: image.height,
    url: `/media/${filename}`,
    altText: image.alt,
    caption: '',
    checksum: checksum(buffer),
  };
}

/** Write one demo Lottie animation into the media directory; returns the values for its media row. */
export async function writeDemoAnimation(animation: DemoAnimation) {
  const filename = demoAnimationFile(animation);
  const buffer = Buffer.from(JSON.stringify(animation.data));
  await store(filename, buffer);
  return {
    filename,
    originalName: `${animation.name}.json`,
    mimeType: 'application/json',
    extension: 'json',
    byteSize: buffer.byteLength,
    width: animation.data.w,
    height: animation.data.h,
    url: `/media/${filename}`,
    altText: animation.alt,
    caption: '',
    checksum: checksum(buffer),
  };
}

const DEMO_URL = /\/media\/(demo\/[a-z0-9-]+\.(?:webp|png|json))/g;

/**
 * Makes sure every demo picture or animation that `tree` points at is in the
 * media library and on disk, creating the missing ones. Anything else it
 * points at is left alone. Returns how many were created.
 */
export async function ensureDemoMedia(tree: unknown): Promise<number> {
  const wanted = new Set([...JSON.stringify(tree).matchAll(DEMO_URL)].map((match) => match[1]!));
  let created = 0;

  for (const filename of wanted) {
    const image = DEMO_IMAGES.find((candidate) => demoImageFile(candidate) === filename);
    const animation = image ? undefined : DEMO_ANIMATIONS.find((candidate) => demoAnimationFile(candidate) === filename);
    if (!image && !animation) continue;

    const absolute = resolveStoredPath(filename);
    if (!absolute) continue;
    const [row] = await db.select({ id: media.id }).from(media).where(eq(media.filename, filename)).limit(1);
    const onDisk = await access(absolute).then(
      () => true,
      () => false,
    );
    if (row && onDisk) continue;

    const values = image ? await writeDemoImage(image) : await writeDemoAnimation(animation!);
    if (row) await db.update(media).set(values).where(eq(media.id, row.id));
    else await db.insert(media).values(values);
    created += 1;
  }

  return created;
}
