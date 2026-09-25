/* ═══════════════════════════════════════════════════════════════════════════
   HTTP byte ranges (T14, 2.17)
   ───────────────────────────────────────────────────────────────────────────
   iOS Safari will not play an mp4 from a server that answers a `Range`
   request with the whole file: it asks for `bytes=0-1`, expects 206, and
   gives up otherwise. One range per request is all any player asks for, so a
   multi-range request is answered with the whole file — which the RFC
   allows — rather than a multipart body nobody uses.
   ═══════════════════════════════════════════════════════════════════════════ */

export type ByteRange = { start: number; end: number };

/**
 * The range a `Range` header asks for, clamped to the file:
 *
 * - `null` — no usable single range; serve the whole file with 200.
 * - `'unsatisfiable'` — a well-formed range that lies wholly past the end;
 *   answer 416 with `Content-Range: bytes *\/size`.
 * - `{ start, end }` — inclusive, as `Content-Range` writes it.
 */
export function parseRange(header: string | null, size: number): ByteRange | 'unsatisfiable' | null {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  // Not bytes, several ranges, or garbage: the whole file is a valid answer.
  if (!match) return null;
  const [, first, last] = match;
  if (first === '' && last === '') return null;
  if (size === 0) return 'unsatisfiable';

  if (first === '') {
    // `bytes=-500`: the last 500 bytes.
    const suffix = Number(last);
    if (!Number.isSafeInteger(suffix) || suffix === 0) return 'unsatisfiable';
    return { start: Math.max(0, size - suffix), end: size - 1 };
  }

  const start = Number(first);
  if (!Number.isSafeInteger(start)) return null;
  if (start >= size) return 'unsatisfiable';
  const end = last === '' ? size - 1 : Number(last);
  if (!Number.isSafeInteger(end) || end < start) return null;
  return { start, end: Math.min(end, size - 1) };
}

/** A strong validator from what a stored file cannot change without being a different file. */
export function etagFor(size: number, mtimeMs: number): string {
  return `"${size.toString(16)}-${Math.floor(mtimeMs).toString(16)}"`;
}

/**
 * Whether an `If-Range` precondition still holds, so the range may be served.
 * It holds when it names this ETag, or a date no earlier than the file's —
 * anything else means the client's partial copy is of an older file, and it
 * gets the whole new one.
 */
export function ifRangeHolds(header: string | null, etag: string, mtimeMs: number): boolean {
  if (!header) return true;
  const value = header.trim();
  if (value.startsWith('"') || value.startsWith('W/')) return value === etag;
  const date = Date.parse(value);
  return Number.isFinite(date) && Math.floor(mtimeMs / 1000) <= Math.floor(date / 1000);
}
