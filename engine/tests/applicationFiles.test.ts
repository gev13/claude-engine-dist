import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/* ═══════════════════════════════════════════════════════════════════════════
   Applicant CVs
   ───────────────────────────────────────────────────────────────────────────
   This is the module that decides what a stranger may put on the server, so
   the tests are mostly about refusals. Two rules do the work:

     • the declared type, the extension and the magic bytes must all agree —
       a text file called `cv.pdf` is not a PDF;
     • nothing an applicant types ever reaches the filesystem. The name on disk
       is generated; theirs is kept in the database for the inbox to show.
   ═══════════════════════════════════════════════════════════════════════════ */

let directory: string;

beforeAll(async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'cv-test-'));
  process.env.APPLICATION_DIR = directory;
});

afterAll(async () => {
  await rm(directory, { recursive: true, force: true });
});

const {
  ATTACHMENT_KINDS,
  ApplicationFileError,
  CV_KINDS,
  CV_MAX_BYTES,
  cvContentType,
  cvPath,
  isSafeCvName,
  isSafeStoredName,
  saveCv,
  saveVisitorFile,
  storedContentType,
} = await import('@/server/applications/storage');

/** A real PDF as far as its magic bytes are concerned. */
const pdfBytes = () => new Uint8Array([...Buffer.from('%PDF-1.4\n'), ...Buffer.from('1 0 obj\n<<>>\nendobj\n'.repeat(4))]);

/* The view's own slice of its buffer, so the File constructor gets a plain
   ArrayBuffer — a Uint8Array's buffer is typed ArrayBufferLike, which includes
   SharedArrayBuffer and is not assignable here. */
const asFile = (bytes: Uint8Array, name: string, type: string) =>
  new File([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer], name, { type });

/** A real PNG as far as `file-type` is concerned: the signature plus an IHDR. */
const pngBytes = () =>
  new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89,
  ]);

const pngFile = (name: string) => asFile(pngBytes(), name, 'image/png');

describe('what is accepted', () => {
  it('stores a PDF under a generated name, keeping the applicant’s for display', async () => {
    const stored = await saveCv(asFile(pdfBytes(), 'My CV (final).pdf', 'application/pdf'));

    expect(stored.extension).toBe('pdf');
    expect(stored.originalName).toBe('My CV (final).pdf');
    // The name on disk is a uuid, never theirs.
    expect(stored.filename).toMatch(/^[0-9a-f-]{36}\.pdf$/);
    expect(stored.filename).not.toContain('My CV');
    expect((await readdir(directory)).includes(stored.filename)).toBe(true);
  });

  it('never lets a name reach the filesystem, however it is written', async () => {
    const stored = await saveCv(asFile(pdfBytes(), '../../etc/passwd.pdf', 'application/pdf'));
    expect(stored.filename).toMatch(/^[0-9a-f-]{36}\.pdf$/);
    // Kept for display, but stripped of its path.
    expect(stored.originalName).toBe('passwd.pdf');
    expect(stored.originalName).not.toContain('..');
  });

  it('accepts a file whose type the browser did not declare', async () => {
    // Some browsers send an empty type; the bytes still decide.
    const stored = await saveCv(asFile(pdfBytes(), 'cv.pdf', ''));
    expect(stored.extension).toBe('pdf');
  });
});

describe('what is refused', () => {
  const refuses = async (file: File, expected: RegExp) => {
    await expect(saveCv(file)).rejects.toThrow(expected);
  };

  it('refuses a text file wearing a .pdf extension', async () => {
    // The whole point of checking the bytes rather than the name.
    await refuses(asFile(Buffer.from('I am not a PDF'), 'cv.pdf', 'application/pdf'), /not really a PDF/i);
  });

  it('refuses a type that is not a CV', async () => {
    await refuses(asFile(pdfBytes(), 'photo.png', 'image/png'), /\.pdf and \.docx/i);
    await refuses(asFile(pdfBytes(), 'archive.zip', 'application/zip'), /\.pdf and \.docx/i);
    await refuses(asFile(pdfBytes(), 'script.sh', 'text/x-shellscript'), /\.pdf and \.docx/i);
  });

  it('refuses a PDF declared as something else', async () => {
    await refuses(asFile(pdfBytes(), 'cv.pdf', 'text/html'), /\.pdf and \.docx/i);
  });

  it('refuses an empty file', async () => {
    await refuses(asFile(new Uint8Array(), 'cv.pdf', 'application/pdf'), /empty/i);
  });

  it('refuses one that is too large', async () => {
    const big = new Uint8Array(CV_MAX_BYTES + 1);
    big.set(Buffer.from('%PDF-1.4\n'));
    await refuses(asFile(big, 'cv.pdf', 'application/pdf'), /larger than 8 MB/i);
  });

  it('says something an applicant can act on, not a stack trace', async () => {
    await expect(saveCv(asFile(pdfBytes(), 'cv.txt', 'text/plain'))).rejects.toBeInstanceOf(ApplicationFileError);
  });
});

describe('reading one back', () => {
  it('accepts only names this module generated', () => {
    expect(isSafeCvName('123e4567-e89b-12d3-a456-426614174000.pdf')).toBe(true);
    expect(isSafeCvName('123e4567-e89b-12d3-a456-426614174000.docx')).toBe(true);
  });

  it('refuses anything that could leave the directory', () => {
    for (const name of [
      '../secret.pdf',
      'a/b.pdf',
      '../../etc/passwd',
      'cv.pdf',
      '123e4567-e89b-12d3-a456-426614174000.exe',
      '123e4567-e89b-12d3-a456-426614174000.pdf ',
      '',
    ]) {
      expect(isSafeCvName(name), name).toBe(false);
      expect(cvPath(name), name).toBeNull();
    }
  });

  it('serves each type as itself', () => {
    expect(cvContentType('pdf')).toBe('application/pdf');
    expect(cvContentType('docx')).toContain('wordprocessingml');
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   The general attachment
   ───────────────────────────────────────────────────────────────────────────
   The form builder's file field accepts pictures as well as documents, and a
   CV still does not. The allowlist is per caller rather than global, which is
   what stops "we added images for the contact form" from quietly widening the
   careers form too.
   ═══════════════════════════════════════════════════════════════════════════ */

describe('what a general form attachment may be', () => {
  it('takes a picture that a CV would refuse', async () => {
    const png = await saveVisitorFile(pngFile('shot.png'), ATTACHMENT_KINDS);
    expect(png.extension).toBe('png');
    expect(isSafeStoredName(png.filename)).toBe(true);

    // The same file, offered as a CV, is refused.
    await expect(saveVisitorFile(pngFile('shot.png'), CV_KINDS)).rejects.toThrow(ApplicationFileError);
  });

  it('still judges a picture by its bytes', async () => {
    const liar = new File([new TextEncoder().encode('not a png')], 'shot.png', { type: 'image/png' });
    await expect(saveVisitorFile(liar, ATTACHMENT_KINDS)).rejects.toThrow(/not really a PNG/);
  });

  it('serves each type as itself, from the allowlist and not from the upload', () => {
    expect(storedContentType('png')).toBe('image/png');
    expect(storedContentType('jpg')).toBe('image/jpeg');
    expect(storedContentType('pdf')).toBe('application/pdf');
  });

  /* The CV route asks the narrower question on purpose, so it refuses to
     serve a picture even if one reached the column somehow. */
  it('keeps the CV name check narrower than the general one', () => {
    const png = `${'0'.repeat(8)}-0000-4000-8000-${'0'.repeat(12)}.png`;
    expect(isSafeStoredName(png)).toBe(true);
    expect(isSafeCvName(png)).toBe(false);
  });
});
