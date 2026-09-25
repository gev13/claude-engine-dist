import 'server-only';
import { createHash } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileTypeFromBuffer } from 'file-type';
import { nanoid } from 'nanoid';
import sharp from 'sharp';
import { env } from '@/lib/env';
import { LOTTIE_MAX_BYTES, checkLottie } from '@/lib/lottie';
import { RESPONSIVE_WIDTHS, isResizable, variantFilename } from '@/lib/responsive';
import { probeVideo } from './probe';
import { SVG_MAX_BYTES, cleanSvg } from './svg';

/**
 * Everything that touches the media directory lives here, so the traversal and
 * type checks exist in exactly one place. An upload is trusted for nothing: the
 * declared mime type, the original extension AND the magic bytes must all agree
 * before a byte is written, and the stored name is always generated.
 */

export type MediaKind = 'image' | 'video' | 'document' | 'animation';

type AllowedEntry = { mimes: readonly string[]; kind: MediaKind };

/** Canonical extension → the mime types a client may legitimately declare. */
const ALLOWED = {
  webp: { mimes: ['image/webp'], kind: 'image' },
  png: { mimes: ['image/png'], kind: 'image' },
  // Some clients still send the non-standard image/jpg.
  jpg: { mimes: ['image/jpeg', 'image/jpg'], kind: 'image' },
  gif: { mimes: ['image/gif'], kind: 'image' },
  mp4: { mimes: ['video/mp4'], kind: 'video' },
  webm: { mimes: ['video/webm'], kind: 'video' },
  pdf: { mimes: ['application/pdf', 'application/x-pdf'], kind: 'document' },
  // Lottie animations (P3-F). JSON has no magic bytes, so these are checked by parsing instead.
  json: { mimes: ['application/json'], kind: 'animation' },
  // 2.17 — text too, so parsed and rebuilt from an allowlist (./svg.ts), never sniffed.
  svg: { mimes: ['image/svg+xml'], kind: 'image' },
} as const satisfies Record<string, AllowedEntry>;

const SUPPORTED = 'Allowed: webp, png, jpg, gif, svg, mp4, webm, pdf and Lottie json.';

export type AllowedExtension = keyof typeof ALLOWED;

/** The canonical content type a stored file is served with. */
const SERVE_TYPE: Record<AllowedExtension, string> = {
  webp: 'image/webp',
  png: 'image/png',
  jpg: 'image/jpeg',
  gif: 'image/gif',
  mp4: 'video/mp4',
  webm: 'video/webm',
  pdf: 'application/pdf',
  json: 'application/json',
  svg: 'image/svg+xml',
};

/** Served but never uploaded: the AVIF copies generated beside a picture (2.17). */
const SERVE_ONLY: Record<string, string> = { avif: 'image/avif' };

export const ALLOWED_EXTENSIONS = Object.keys(ALLOWED) as AllowedExtension[];

/** Extensions sharp is asked to read dimensions from. */
const RASTER: ReadonlySet<string> = new Set(['webp', 'png', 'jpg', 'gif']);

/** A rejected upload, reported per file so one bad file cannot fail a batch. */
export class MediaUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MediaUploadError';
  }
}

export type StoredUpload = {
  /** Relative path inside the storage directory, e.g. 2026/09/V1StGXR8.png. */
  filename: string;
  originalName: string;
  mimeType: string;
  extension: AllowedExtension;
  byteSize: number;
  width: number | null;
  height: number | null;
  /** A video's length, when its header could be read (2.17). */
  durationMs?: number | null;
  url: string;
  checksum: string;
};

/* ── Paths ────────────────────────────────────────────────────────────────── */

/** Absolute, normalised root of the media directory. */
export function mediaRoot(): string {
  return path.resolve(process.cwd(), env.MEDIA_STORAGE_DIR);
}

/**
 * Resolve a stored relative path to an absolute one, or null when it is not a
 * plain relative path inside the media root. Every read, write and delete goes
 * through this — it is the only traversal guard.
 */
export function resolveStoredPath(relative: string): string | null {
  if (!relative || relative.includes('\0')) return null;

  const segments = relative.split('/');
  if (segments.length < 1 || segments.length > 8) return null;
  for (const segment of segments) {
    if (!segment || segment === '.' || segment === '..') return null;
    // A conservative charset: nothing that could be a separator, a drive letter
    // or a shell surprise ever reaches the filesystem.
    if (!/^[A-Za-z0-9._-]+$/.test(segment)) return null;
  }

  const root = mediaRoot();
  const absolute = path.resolve(root, relative);

  // Belt and braces: the resolved path must still sit under the root.
  if (!absolute.startsWith(root + path.sep)) return null;

  return absolute;
}

/** Content type for a stored path, or null when the extension is not allowed. */
export function contentTypeFor(relative: string): string | null {
  const ext = normaliseExtension(path.extname(relative).slice(1));
  return ext in SERVE_TYPE ? SERVE_TYPE[ext as AllowedExtension] : (SERVE_ONLY[ext] ?? null);
}

export function kindForMime(mime: string): MediaKind {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime === 'application/json') return 'animation';
  return 'document';
}

/* ── Validation helpers ───────────────────────────────────────────────────── */

function normaliseExtension(raw: string): string {
  const ext = raw.toLowerCase().replace(/^\./, '');
  return ext === 'jpeg' ? 'jpg' : ext;
}

function declaredMime(file: File): string {
  return (file.type || '').split(';')[0]!.trim().toLowerCase();
}

/** Strip any directory component and control characters from a client name. */
function safeOriginalName(raw: string): string {
  const base = (raw ?? '').split(/[\\/]/).pop() ?? '';
  const cleaned = base.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return (cleaned || 'upload').slice(0, 300);
}

function formatBytes(bytes: number): string {
  if (bytes >= 1_048_576) return `${Math.round(bytes / 1_048_576)}MB`;
  return `${Math.round(bytes / 1024)}KB`;
}

/* ── Write ────────────────────────────────────────────────────────────────── */

/**
 * Validate and store one uploaded file, returning the values for a `media` row.
 * Throws {@link MediaUploadError} with a message that is safe to show the
 * person who uploaded it.
 */
export async function saveUpload(file: File, uploaderId: string, options: { allowSvg?: boolean } = {}): Promise<StoredUpload> {
  // The uploader is recorded on the row by the caller; it is part of the
  // signature so future per-user quotas have somewhere to live.
  void uploaderId;

  if (file.size <= 0) throw new MediaUploadError('The file is empty.');
  if (file.size > env.MEDIA_MAX_FILE_BYTES) {
    throw new MediaUploadError(`The file is larger than the ${formatBytes(env.MEDIA_MAX_FILE_BYTES)} limit.`);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  // file.size is client-supplied metadata; the real length decides.
  if (buffer.byteLength === 0) throw new MediaUploadError('The file is empty.');
  if (buffer.byteLength > env.MEDIA_MAX_FILE_BYTES) {
    throw new MediaUploadError(`The file is larger than the ${formatBytes(env.MEDIA_MAX_FILE_BYTES)} limit.`);
  }

  const originalName = safeOriginalName(file.name);

  // JSON has no magic bytes, so a .json file is parsed and checked as a
  // Lottie animation instead of sniffed.
  if (normaliseExtension(path.extname(originalName).slice(1)) === 'json') {
    return saveLottie(buffer, declaredMime(file), originalName);
  }
  if (normaliseExtension(path.extname(originalName).slice(1)) === 'svg') {
    if (!options.allowSvg) throw new MediaUploadError('Your role cannot upload SVG files. An administrator can allow it under Security.');
    return saveSvg(buffer, declaredMime(file), originalName);
  }

  // 1. What the bytes actually are.
  const sniffed = await fileTypeFromBuffer(buffer);
  if (!sniffed) throw new MediaUploadError(`That file type is not supported. ${SUPPORTED}`);

  const extension = normaliseExtension(sniffed.ext);
  if (!(extension in ALLOWED) || extension === 'json' || extension === 'svg') {
    throw new MediaUploadError(`That file type is not supported. ${SUPPORTED}`);
  }
  const entry: AllowedEntry = ALLOWED[extension as AllowedExtension];

  // 2. What the client declared. Both must name the same type.
  const declared = declaredMime(file);
  if (!declared) throw new MediaUploadError('The upload did not declare a content type.');
  if (!entry.mimes.includes(declared)) {
    throw new MediaUploadError(`This file is really a ${extension.toUpperCase()}, but it was sent as ${declared}.`);
  }

  // 3. What the name claimed. A .png that is really something else stops here.
  const namedExtension = normaliseExtension(path.extname(originalName).slice(1));
  if (!namedExtension) throw new MediaUploadError('The file name has no extension.');
  if (namedExtension !== extension) {
    throw new MediaUploadError(
      `The file is named .${namedExtension} but its contents are ${extension.toUpperCase()}.`,
    );
  }

  const checksum = createHash('sha256').update(buffer).digest('hex');

  let width: number | null = null;
  let height: number | null = null;
  let durationMs: number | null = null;
  if (entry.kind === 'video') {
    // The shape an ambient video reserves before it loads (2.17).
    const info = probeVideo(buffer, extension);
    if (info) ({ width, height, durationMs } = info);
  }
  if (RASTER.has(extension)) {
    try {
      const meta = await sharp(buffer).metadata();
      width = meta.width ?? null;
      height = meta.height ?? null;
    } catch {
      // A decode failure is not fatal: the file is still a valid stored asset,
      // it simply has no dimensions recorded.
    }
  }

  const relative = await writeStored(buffer, extension as AllowedExtension);

  return {
    filename: relative,
    originalName,
    mimeType: SERVE_TYPE[extension as AllowedExtension],
    extension: extension as AllowedExtension,
    byteSize: buffer.byteLength,
    width,
    height,
    durationMs,
    url: `/media/${relative}`,
    checksum,
  };
}

/**
 * An SVG upload: declared as one, parsed as XML, rebuilt from the allowlist
 * in ./svg.ts, and stored as the cleaned text — what is kept is exactly what
 * was checked, like a Lottie file.
 */
async function saveSvg(raw: Buffer, declared: string, originalName: string): Promise<StoredUpload> {
  if (raw.byteLength > SVG_MAX_BYTES) throw new MediaUploadError(`An SVG can be at most ${formatBytes(SVG_MAX_BYTES)}.`);
  if (!declared) throw new MediaUploadError('The upload did not declare a content type.');
  if (!(ALLOWED.svg.mimes as readonly string[]).includes(declared)) {
    throw new MediaUploadError(`The file is named .svg, but it was sent as ${declared}.`);
  }
  const cleaned = cleanSvg(raw.toString('utf8'));
  if (!cleaned) throw new MediaUploadError('The file is not an SVG image.');
  const buffer = Buffer.from(cleaned.svg);
  const relative = await writeStored(buffer, 'svg');
  return {
    filename: relative,
    originalName,
    mimeType: SERVE_TYPE.svg,
    extension: 'svg',
    byteSize: buffer.byteLength,
    width: cleaned.width,
    height: cleaned.height,
    url: `/media/${relative}`,
    checksum: createHash('sha256').update(buffer).digest('hex'),
  };
}

/** Write bytes under a fresh generated name in this month's folder; returns the relative path. */
async function writeStored(buffer: Buffer, extension: AllowedExtension): Promise<string> {
  const now = new Date();
  const shard = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const relative = `${shard}/${nanoid(16)}.${extension}`;

  const absolute = resolveStoredPath(relative);
  if (!absolute) throw new MediaUploadError('Could not build a safe storage path.');

  await mkdir(path.dirname(absolute), { recursive: true });
  // wx: never silently overwrite an existing asset.
  await writeFile(absolute, buffer, { flag: 'wx' });
  return relative;
}

/**
 * A Lottie upload: declared as JSON, parsed, checked for the fields every
 * Lottie file has, and stored re-serialised — so what is kept is exactly what
 * was checked. It is served as application/json with nosniff, never run.
 */
async function saveLottie(raw: Buffer, declared: string, originalName: string): Promise<StoredUpload> {
  if (raw.byteLength > LOTTIE_MAX_BYTES) {
    throw new MediaUploadError(`A Lottie file can be at most ${formatBytes(LOTTIE_MAX_BYTES)}.`);
  }
  if (!declared) throw new MediaUploadError('The upload did not declare a content type.');
  if (!(ALLOWED.json.mimes as readonly string[]).includes(declared)) {
    throw new MediaUploadError(`The file is named .json, but it was sent as ${declared}.`);
  }

  let data: unknown;
  try {
    data = JSON.parse(raw.toString('utf8').replace(/^﻿/, ''));
  } catch {
    throw new MediaUploadError('The file is not valid JSON.');
  }
  const checked = checkLottie(data);
  if (!checked.ok) throw new MediaUploadError(checked.error);

  const buffer = Buffer.from(JSON.stringify(data));
  const relative = await writeStored(buffer, 'json');
  return {
    filename: relative,
    originalName,
    mimeType: SERVE_TYPE.json,
    extension: 'json',
    byteSize: buffer.byteLength,
    width: checked.info.width,
    height: checked.info.height,
    url: `/media/${relative}`,
    checksum: createHash('sha256').update(buffer).digest('hex'),
  };
}

/** Remove a stored file, and any smaller copies made of it (2.17). A missing file is not an error — the row is going anyway. */
export async function deleteStored(filename: string): Promise<void> {
  const absolute = resolveStoredPath(filename);
  if (!absolute) return;
  const gone = async (target: string | null) => {
    if (!target) return;
    try {
      await unlink(target);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  };
  await gone(absolute);
  if (isResizable(`/media/${filename}`)) {
    for (const width of RESPONSIVE_WIDTHS) {
      for (const format of ['webp', 'avif'] as const) await gone(resolveStoredPath(variantFilename(filename, width, format)));
    }
  }
}
