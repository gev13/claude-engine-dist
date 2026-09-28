import { brotliDecompressSync } from 'node:zlib';

/*
 * 3.17.1 — a woff2's weight axis, read from its `fvar` table.
 *
 * Google answers a request for 400 and 700 of a variable family with the same
 * variable file twice, each declared a single weight — and a font declared
 * `font-weight: 400` then draws 500 and 600 as 400. The fetcher reads the
 * file's real range here and declares it once (`font-weight: 200 800`).
 */
const KNOWN = [
  'cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm', 'glyf', 'loca', 'prep', 'CFF ', 'VORG', 'EBDT',
  'EBLC', 'gasp', 'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE', 'GDEF', 'GPOS', 'GSUB', 'EBSC', 'JSTF', 'MATH',
  'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ', 'sbix', 'acnt', 'avar', 'bdat', 'bloc', 'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar',
  'gvar', 'hsty', 'just', 'lcar', 'mort', 'morx', 'opbd', 'prop', 'trak', 'Zapf', 'Silf', 'Glat', 'Gloc', 'Feat', 'Sill',
];

function base128(buf, at) {
  let value = 0;
  for (let i = 0; i < 5; i++) {
    const byte = buf[at.i++];
    value = (value << 7) | (byte & 0x7f);
    if ((byte & 0x80) === 0) return value >>> 0;
  }
  throw new Error('bad UIntBase128');
}

/** `[min, max]` of the `wght` axis, or null for a static font (or anything unreadable). */
export function weightRange(buf) {
  try {
    if (buf.subarray(0, 4).toString('latin1') !== 'wOF2') return null;
    const numTables = buf.readUInt16BE(12);
    const at = { i: 48 };
    const tables = [];
    for (let n = 0; n < numTables; n++) {
      const flags = buf[at.i++];
      const index = flags & 0x3f;
      const version = (flags >> 6) & 0x03;
      const tag = index === 63 ? buf.subarray(at.i, (at.i += 4)).toString('latin1') : KNOWN[index];
      const orig = base128(buf, at);
      const transformed = tag === 'glyf' || tag === 'loca' ? version === 0 : version !== 0;
      const length = transformed ? base128(buf, at) : orig;
      tables.push({ tag, length });
    }
    const data = brotliDecompressSync(buf.subarray(at.i));
    let offset = 0;
    for (const table of tables) {
      if (table.tag === 'fvar') {
        const fvar = data.subarray(offset, offset + table.length);
        const axesAt = fvar.readUInt16BE(4);
        const count = fvar.readUInt16BE(8);
        const size = fvar.readUInt16BE(10);
        for (let a = 0; a < count; a++) {
          const r = axesAt + a * size;
          if (fvar.subarray(r, r + 4).toString('latin1') !== 'wght') continue;
          return [Math.round(fvar.readInt32BE(r + 4) / 65536), Math.round(fvar.readInt32BE(r + 12) / 65536)];
        }
        return null;
      }
      offset += table.length;
    }
    return null;
  } catch {
    return null;
  }
}
