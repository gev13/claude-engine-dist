import 'server-only';
import { randomUUID } from 'node:crypto';
import { mkdir, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileTypeFromBuffer } from 'file-type';

/* ═══════════════════════════════════════════════════════════════════════════
   Where an applicant's CV goes — and where it does not
   ───────────────────────────────────────────────────────────────────────────
   Not the media library. That is browsable by every editor, appears in every
   image picker, and is served from a public route: a CV in there would be one
   careless click away from being attached to a blog post.

   So these live in their own directory, under a generated name, reachable only
   through an admin route that checks the permission and audits the download.
   The applicant's own filename is kept in the database for the inbox to show,
   and never used on disk — somebody called their CV `../../etc/passwd.pdf` is
   not a filesystem problem.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Every type a visitor may send, and each is checked three ways. */
const ALLOWED = {
  pdf: {
    mimes: ['application/pdf', 'application/x-pdf'],
    magic: ['pdf'],
    contentType: 'application/pdf',
  },
  docx: {
    mimes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    /* `file-type` tells a real .docx from a plain .zip — measured, not
       assumed — so a zip renamed to .docx is refused here. */
    magic: ['docx'],
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  },
  /* Images are for the general form field, never for a CV. Raster only:
     an SVG is a script host, and no form needs one. */
  jpg: { mimes: ['image/jpeg'], magic: ['jpg'], contentType: 'image/jpeg' },
  png: { mimes: ['image/png'], magic: ['png'], contentType: 'image/png' },
} as const;

export type AllowedExtension = keyof typeof ALLOWED;
/** Kept under its old name: the careers form and its download route want exactly these two. */
export type AllowedCvExtension = 'pdf' | 'docx';

/** A CV is a document. An attachment on a general form may also be a picture. */
export const CV_KINDS = ['pdf', 'docx'] as const satisfies readonly AllowedExtension[];
export const ATTACHMENT_KINDS = ['pdf', 'docx', 'jpg', 'png'] as const satisfies readonly AllowedExtension[];

export const ALLOWED_CV_EXTENSIONS: AllowedCvExtension[] = [...CV_KINDS];

/** What the form tells a visitor, and what the server enforces. */
export const CV_MAX_BYTES = 8 * 1024 * 1024;
export const CV_SUPPORTED = 'Supported files: .pdf and .docx, up to 8 MB.';
export const ATTACHMENT_SUPPORTED = 'Supported files: .pdf, .docx, .jpg and .png, up to 8 MB.';

export class ApplicationFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApplicationFileError';
  }
}

export function applicationDir(): string {
  return path.resolve(process.cwd(), process.env.APPLICATION_DIR ?? './storage/applications');
}

/**
 * Only ever a name this module generated: a uuid and one of two extensions.
 * It is the one thing standing between a stored value and the filesystem.
 */
export function isSafeStoredName(name: string): boolean {
  return /^[0-9a-f-]{36}\.(pdf|docx|jpg|png)$/.test(name) && !name.includes('/') && !name.includes('..');
}

/**
 * The same check, narrowed to the two types a CV may be.
 *
 * Kept separate on purpose: the CV download route should refuse to serve a
 * picture even if one somehow ended up in the column, and a route that asks
 * the narrower question cannot be widened by a change somewhere else.
 */
export function isSafeCvName(name: string): boolean {
  return /^[0-9a-f-]{36}\.(pdf|docx)$/.test(name) && !name.includes('/') && !name.includes('..');
}

/** The path a stored name resolves to, or null if it tries to leave the directory. */
export function storedPath(filename: string): string | null {
  if (!isSafeStoredName(filename)) return null;
  const full = path.join(applicationDir(), filename);
  return full.startsWith(applicationDir() + path.sep) ? full : null;
}

/** The CV-only path, for the route that serves CVs and nothing else. */
export function cvPath(filename: string): string | null {
  if (!isSafeCvName(filename)) return null;
  return storedPath(filename);
}

export type StoredFile = {
  /** The generated name on disk. */
  filename: string;
  /** What the visitor called it, for the inbox to show. */
  originalName: string;
  bytes: number;
  extension: AllowedExtension;
};

/** The careers form's name for the same thing. */
export type StoredCv = StoredFile & { extension: AllowedCvExtension };

/** Trim a name for display. Never used to build a path. */
function tidyName(name: string, extension: string): string {
  const base = name.replace(/\\/g, '/').split('/').pop() ?? '';
  const cleaned = base.replace(/[^\w .\-()]+/g, '').trim() || `cv.${extension}`;
  return cleaned.slice(0, 120);
}

/**
 * Check a visitor's file and store it.
 *
 * `kinds` is what this particular form will accept, so a CV cannot be a
 * picture and an attachment can — the allowlist is per caller rather than
 * global, which is what stops "we added images for the contact form" from
 * quietly widening the careers form too.
 *
 * Three checks, and all three must agree: the extension the visitor's file
 * claims, the MIME type the browser declared, and the magic bytes. The first
 * two are client-supplied; the bytes decide.
 *
 * Throws {@link ApplicationFileError} with a message that is safe to show a
 * visitor — they should be told their file is too big, not shown a stack
 * trace or a path.
 */
export async function saveVisitorFile(
  file: File,
  kinds: readonly AllowedExtension[] = CV_KINDS,
): Promise<StoredFile> {
  const supported = kinds === CV_KINDS ? CV_SUPPORTED : ATTACHMENT_SUPPORTED;

  if (file.size <= 0) throw new ApplicationFileError('That file is empty.');
  if (file.size > CV_MAX_BYTES) {
    throw new ApplicationFileError(`That file is larger than 8 MB. ${supported}`);
  }

  const declaredExtension = (file.name.split('.').pop() ?? '').toLowerCase();
  if (!kinds.includes(declaredExtension as AllowedExtension)) {
    throw new ApplicationFileError(supported);
  }
  const allowed = ALLOWED[declaredExtension as AllowedExtension];

  // `file.size` and `file.type` are both client-supplied; the bytes decide.
  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.byteLength === 0) throw new ApplicationFileError('That file is empty.');
  if (buffer.byteLength > CV_MAX_BYTES) {
    throw new ApplicationFileError(`That file is larger than 8 MB. ${supported}`);
  }

  const declaredMime = (file.type || '').toLowerCase();
  if (declaredMime && !(allowed.mimes as readonly string[]).includes(declaredMime)) {
    throw new ApplicationFileError(supported);
  }

  const sniffed = await fileTypeFromBuffer(buffer);
  if (!sniffed || !(allowed.magic as readonly string[]).includes(sniffed.ext)) {
    throw new ApplicationFileError(
      `That file is not really a ${declaredExtension.toUpperCase()}. ${supported}`,
    );
  }

  const filename = `${randomUUID()}.${declaredExtension}`;
  const directory = applicationDir();
  await mkdir(directory, { recursive: true });
  // 0600: readable by the account that runs the site and nobody else.
  await writeFile(path.join(directory, filename), buffer, { mode: 0o600 });

  return {
    filename,
    originalName: tidyName(file.name, declaredExtension),
    bytes: buffer.byteLength,
    extension: declaredExtension as AllowedExtension,
  };
}

/** A CV: the same store, narrowed to the two types a CV may be. */
export async function saveCv(file: File): Promise<StoredCv> {
  return (await saveVisitorFile(file, CV_KINDS)) as StoredCv;
}

/** Remove one, when the thing that held it is deleted or expires. Never throws. */
export async function deleteStoredFile(filename: string): Promise<void> {
  const full = storedPath(filename);
  if (!full) return;
  await unlink(full).catch(() => {});
}

/** The careers form's name for the same thing. */
export const deleteCv = deleteStoredFile;

/** Size on disk, or null when it is gone — so the inbox can say so. */
export async function storedSize(filename: string): Promise<number | null> {
  const full = storedPath(filename);
  if (!full) return null;
  return stat(full).then(
    (info) => info.size,
    () => null,
  );
}

export const cvSize = storedSize;

/**
 * The content type to serve a stored file with.
 *
 * Read from the allowlist rather than from the visitor's declared MIME: the
 * extension is one this module generated, so this is the only source of truth
 * that cannot be influenced from outside.
 */
export function storedContentType(extension: AllowedExtension): string {
  return ALLOWED[extension].contentType;
}

export const cvContentType = (extension: AllowedCvExtension): string => storedContentType(extension);
