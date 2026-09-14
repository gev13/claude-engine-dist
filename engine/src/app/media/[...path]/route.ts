import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { contentTypeFor, resolveStoredPath } from '@/server/media/storage';

export const runtime = 'nodejs';

/**
 * Serves uploaded media from disk.
 *
 * In production this should sit behind a CDN or be replaced by object storage;
 * it exists so the CMS is fully functional on a single box with no external
 * dependency. `resolveStoredPath` is the security boundary: it rejects any
 * path that escapes the media root, so a crafted `..` segment cannot read
 * arbitrary files.
 */
export async function GET(_request: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const relative = path.join('/');

  const absolute = resolveStoredPath(relative);
  if (!absolute) return new Response('Not found', { status: 404 });

  const contentType = contentTypeFor(relative);
  if (!contentType) return new Response('Not found', { status: 404 });

  let size: number;
  try {
    const info = await stat(absolute);
    if (!info.isFile()) return new Response('Not found', { status: 404 });
    size = info.size;
  } catch {
    return new Response('Not found', { status: 404 });
  }

  const stream = Readable.toWeb(createReadStream(absolute)) as ReadableStream;

  return new Response(stream, {
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(size),
      // Filenames are content-addressed on upload, so a given URL never changes.
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      // Uploaded files are served from the same origin; stop anything that
      // slipped past validation from executing in that origin's context.
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Content-Disposition': 'inline',
    },
  });
}
