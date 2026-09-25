import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { etagFor, ifRangeHolds, parseRange } from '@/lib/httpRange';
import { VARIANT_NAME, isResizable, requestedWidth, variantFilename } from '@/lib/responsive';
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
 *
 * 2.17: byte ranges (206, 416, `If-Range`) so iOS plays video; validators
 * (`ETag`, `Last-Modified`, 304); HEAD; `?w=` for a resized copy of a
 * picture (lib/responsive.ts); and SVG under a policy of its own.
 */

/** Uploaded files are served from this origin; nothing in one may run in its context. */
const SANDBOX = "default-src 'none'; sandbox";
/** An SVG draws with its own inline styles, and still runs nothing. */
const SVG_POLICY = "default-src 'none'; style-src 'unsafe-inline'; sandbox";

type Found = { absolute: string; relative: string; size: number; mtimeMs: number; variant: boolean };

async function statFile(relative: string): Promise<Found | null> {
  const absolute = resolveStoredPath(relative);
  if (!absolute) return null;
  try {
    const info = await stat(absolute);
    return info.isFile() ? { absolute, relative, size: info.size, mtimeMs: info.mtimeMs, variant: false } : null;
  } catch {
    return null;
  }
}

/**
 * The file to send: for `?w=` on a picture, the smallest generated copy at
 * least that wide — AVIF first when the browser takes it — and otherwise the
 * original itself.
 */
async function pick(relative: string, request: Request): Promise<{ file: Found | null; negotiated: boolean }> {
  const width = requestedWidth(new URL(request.url).searchParams.get('w'));
  if (!width || !isResizable(`/media/${relative}`) || VARIANT_NAME.test(relative)) {
    return { file: await statFile(relative), negotiated: false };
  }
  const avif = (request.headers.get('accept') ?? '').includes('image/avif');
  for (const format of avif ? (['avif', 'webp'] as const) : (['webp'] as const)) {
    const found = await statFile(variantFilename(relative, width, format));
    if (found) return { file: { ...found, variant: true }, negotiated: true };
  }
  return { file: await statFile(relative), negotiated: true };
}

async function serve(request: Request, ctx: { params: Promise<{ path: string[] }> }, head: boolean) {
  const { path } = await ctx.params;
  const relative = path.join('/');
  if (!contentTypeFor(relative)) return new Response('Not found', { status: 404 });

  const { file, negotiated } = await pick(relative, request);
  if (!file) return new Response('Not found', { status: 404 });
  const contentType = contentTypeFor(file.relative)!;

  const etag = etagFor(file.size, file.mtimeMs);
  const lastModified = new Date(file.mtimeMs).toUTCString();
  const headers: Record<string, string> = {
    'Content-Type': contentType,
    'Accept-Ranges': 'bytes',
    ETag: etag,
    'Last-Modified': lastModified,
    /* Filenames are generated on upload, so a given file never changes. A
       `?w=` answered with the original may be answered with a copy once
       sizes are generated, so that one is cached for an hour, not a year. */
    'Cache-Control': negotiated && !file.variant ? 'public, max-age=3600' : 'public, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': contentType === 'image/svg+xml' ? SVG_POLICY : SANDBOX,
    'Content-Disposition': 'inline',
  };
  if (negotiated) headers.Vary = 'Accept';

  const match = request.headers.get('if-none-match');
  if (match && match.split(',').some((tag) => tag.trim() === etag || tag.trim() === '*')) {
    return new Response(null, { status: 304, headers });
  }

  const asked = ifRangeHolds(request.headers.get('if-range'), etag, file.mtimeMs) ? parseRange(request.headers.get('range'), file.size) : null;
  if (asked === 'unsatisfiable') {
    return new Response(null, { status: 416, headers: { ...headers, 'Content-Range': `bytes */${file.size}` } });
  }

  const range = asked ?? { start: 0, end: Math.max(0, file.size - 1) };
  const length = file.size === 0 ? 0 : range.end - range.start + 1;
  headers['Content-Length'] = String(length);
  if (asked) headers['Content-Range'] = `bytes ${range.start}-${range.end}/${file.size}`;

  const body = head || length === 0 ? null : (Readable.toWeb(createReadStream(file.absolute, { start: range.start, end: range.end })) as ReadableStream);
  return new Response(body, { status: asked ? 206 : 200, headers });
}

export function GET(request: Request, ctx: { params: Promise<{ path: string[] }> }) {
  return serve(request, ctx, false);
}

export function HEAD(request: Request, ctx: { params: Promise<{ path: string[] }> }) {
  return serve(request, ctx, true);
}
