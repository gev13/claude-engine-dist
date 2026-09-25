/* ═══════════════════════════════════════════════════════════════════════════
   What a video is, read from its header (T15, 2.17)
   ───────────────────────────────────────────────────────────────────────────
   An ambient video takes its shape from the file itself ("ratio: auto"), so
   the page reserves exactly the right box before a byte of it loads — no
   layout shift. Width, height and duration are read from the container at
   upload: an MP4's `moov` box, a WebM's EBML `Info` and `Tracks`. No ffprobe:
   a server should not need a media toolchain to accept a video.

   Pure and defensive — a truncated or odd file answers null, never throws,
   and the upload is stored all the same, just without the numbers.
   ═══════════════════════════════════════════════════════════════════════════ */

export type VideoInfo = { width: number; height: number; durationMs: number | null };

/* ── MP4 / ISO BMFF ───────────────────────────────────────────────────────── */

type Box = { type: string; start: number; end: number };

function* boxes(buf: Buffer, start: number, end: number): Generator<Box> {
  let at = start;
  while (at + 8 <= end) {
    let size = buf.readUInt32BE(at);
    const type = buf.toString('latin1', at + 4, at + 8);
    let header = 8;
    if (size === 1) {
      if (at + 16 > end) return;
      const big = buf.readBigUInt64BE(at + 8);
      if (big > BigInt(Number.MAX_SAFE_INTEGER)) return;
      size = Number(big);
      header = 16;
    } else if (size === 0) {
      size = end - at;
    }
    if (size < header || at + size > end) return;
    yield { type, start: at + header, end: at + size };
    at += size;
  }
}

function find(buf: Buffer, start: number, end: number, type: string): Box | null {
  for (const box of boxes(buf, start, end)) if (box.type === type) return box;
  return null;
}

function probeMp4(buf: Buffer): VideoInfo | null {
  const moov = find(buf, 0, buf.length, 'moov');
  if (!moov) return null;

  let durationMs: number | null = null;
  const mvhd = find(buf, moov.start, moov.end, 'mvhd');
  if (mvhd && mvhd.end - mvhd.start >= 20) {
    const version = buf.readUInt8(mvhd.start);
    const timescale = version === 1 ? buf.readUInt32BE(mvhd.start + 20) : buf.readUInt32BE(mvhd.start + 12);
    const duration = version === 1 ? Number(buf.readBigUInt64BE(mvhd.start + 24)) : buf.readUInt32BE(mvhd.start + 16);
    if (timescale > 0 && Number.isFinite(duration)) durationMs = Math.round((duration / timescale) * 1000);
  }

  for (const trak of boxes(buf, moov.start, moov.end)) {
    if (trak.type !== 'trak') continue;
    const tkhd = find(buf, trak.start, trak.end, 'tkhd');
    if (!tkhd) continue;
    const version = buf.readUInt8(tkhd.start);
    /* Version and flags, the times, track id, reserved, duration (24 bytes,
       36 in version 1); then 8 reserved; layer, group, volume and 2
       reserved (8); the 3×3 matrix (36); width and height. */
    const matrixAt = tkhd.start + (version === 1 ? 36 : 24) + 16;
    const sizeAt = matrixAt + 36;
    if (sizeAt + 8 > tkhd.end) continue;
    let width = Math.round(buf.readUInt32BE(sizeAt) / 65536);
    let height = Math.round(buf.readUInt32BE(sizeAt + 4) / 65536);
    if (!width || !height) continue; // an audio track
    // A phone video recorded upright is stored sideways with a 90° matrix.
    const a = buf.readInt32BE(matrixAt);
    const b = buf.readInt32BE(matrixAt + 4);
    if (a === 0 && Math.abs(b) === 65536) [width, height] = [height, width];
    return { width, height, durationMs };
  }
  return null;
}

/* ── WebM / Matroska (EBML) ───────────────────────────────────────────────── */

const EBML = 0x1a45dfa3;
const SEGMENT = 0x18538067;
const INFO = 0x1549a966;
const TIMECODE_SCALE = 0x2ad7b1;
const DURATION = 0x4489;
const TRACKS = 0x1654ae6b;
const TRACK_ENTRY = 0xae;
const VIDEO = 0xe0;
const PIXEL_WIDTH = 0xb0;
const PIXEL_HEIGHT = 0xba;
const CLUSTER = 0x1f43b675;

/** A variable-length integer: `id` keeps its marker bit, a size drops it. */
function vint(buf: Buffer, at: number, keepMarker: boolean): { value: number; length: number; unknown: boolean } | null {
  if (at >= buf.length) return null;
  const first = buf[at]!;
  let length = 1;
  while (length <= 8 && !(first & (0x80 >> (length - 1)))) length++;
  if (length > 8 || at + length > buf.length) return null;
  let value = keepMarker ? first : first & (0xff >> length);
  let allOnes = value === (0xff >> length);
  for (let i = 1; i < length; i++) {
    const byte = buf[at + i]!;
    value = value * 256 + byte;
    if (byte !== 0xff) allOnes = false;
  }
  return { value, length, unknown: !keepMarker && allOnes };
}

type Element = { id: number; start: number; end: number };

function* elements(buf: Buffer, start: number, end: number): Generator<Element> {
  let at = start;
  while (at < end) {
    const id = vint(buf, at, true);
    if (!id) return;
    const size = vint(buf, at + id.length, false);
    if (!size) return;
    const dataStart = at + id.length + size.length;
    const dataEnd = size.unknown ? end : dataStart + size.value;
    if (dataEnd > end && !size.unknown) {
      // A truncated element: read what is there, then stop.
      yield { id: id.value, start: dataStart, end };
      return;
    }
    yield { id: id.value, start: dataStart, end: dataEnd };
    if (size.unknown) return;
    at = dataEnd;
  }
}

const uint = (buf: Buffer, e: Element) => {
  let value = 0;
  for (let i = e.start; i < e.end && i < e.start + 6; i++) value = value * 256 + buf[i]!;
  return value;
};

function probeWebm(buf: Buffer): VideoInfo | null {
  const top = [...elements(buf, 0, buf.length)];
  if (top[0]?.id !== EBML) return null;
  const segment = top.find((e) => e.id === SEGMENT);
  if (!segment) return null;

  let scale = 1_000_000;
  let duration: number | null = null;
  let width = 0;
  let height = 0;

  for (const child of elements(buf, segment.start, segment.end)) {
    if (child.id === CLUSTER) break; // the media itself: everything needed comes before it
    if (child.id === INFO) {
      for (const field of elements(buf, child.start, child.end)) {
        if (field.id === TIMECODE_SCALE) scale = uint(buf, field) || scale;
        if (field.id === DURATION) {
          const bytes = field.end - field.start;
          duration = bytes === 4 ? buf.readFloatBE(field.start) : bytes === 8 ? buf.readDoubleBE(field.start) : null;
        }
      }
    }
    if (child.id === TRACKS) {
      for (const entry of elements(buf, child.start, child.end)) {
        if (entry.id !== TRACK_ENTRY) continue;
        for (const part of elements(buf, entry.start, entry.end)) {
          if (part.id !== VIDEO) continue;
          for (const field of elements(buf, part.start, part.end)) {
            if (field.id === PIXEL_WIDTH) width = uint(buf, field);
            if (field.id === PIXEL_HEIGHT) height = uint(buf, field);
          }
        }
        if (width && height) break;
      }
    }
  }

  if (!width || !height) return null;
  const durationMs = duration !== null && Number.isFinite(duration) ? Math.round((duration * scale) / 1_000_000) : null;
  return { width, height, durationMs };
}

/** Width, height and duration of an mp4 or webm, or null when they cannot be read. */
export function probeVideo(buf: Buffer, extension: string): VideoInfo | null {
  try {
    const info = extension === 'mp4' ? probeMp4(buf) : extension === 'webm' ? probeWebm(buf) : null;
    if (!info || info.width > 16384 || info.height > 16384) return null;
    return info;
  } catch {
    return null;
  }
}
