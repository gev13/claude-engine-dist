/* ═══════════════════════════════════════════════════════════════════════════
   The Content-Security-Policy, built from parts (2.16)
   ───────────────────────────────────────────────────────────────────────────
   One builder for every policy the engine sends. The admin's and the band
   probe's are fixed and set in `next.config.ts`; the public site's is built
   per request by the middleware, because it grows with what an administrator
   switches on — a tag manager, a pixel, a CAPTCHA — and a static policy
   either blocks those or permits every vendor on every site.

   Imports nothing: `next.config.ts` loads it before any of the app exists.
   ═══════════════════════════════════════════════════════════════════════════ */

export type CspSources = {
  script?: readonly string[];
  connect?: readonly string[];
  img?: readonly string[];
  frame?: readonly string[];
  style?: readonly string[];
  font?: readonly string[];
  media?: readonly string[];
};

/** Video players and maps, loaded only when a visitor asks (lib/embeds.ts — a test holds them together). */
export const EMBED_FRAME_SOURCES = [
  'https://www.youtube-nocookie.com',
  'https://player.vimeo.com',
  'https://www.openstreetmap.org',
  'https://www.google.com',
] as const;

/**
 * What an origin may look like in a policy: `https://host` or
 * `https://*.host`, no path, no quotes, no semicolons. Anything else would be
 * a way to rewrite the policy from a settings field.
 */
export const CSP_ORIGIN = /^(https|wss):\/\/(\*\.)?[a-z0-9-]+(\.[a-z0-9-]+)+(:\d{2,5})?$/i;

const unique = (list: readonly string[]) => [...new Set(list.filter((s) => s === "'self'" || CSP_ORIGIN.test(s) || /^'[a-z-]+'$/.test(s) || /^(data|blob):$/.test(s)))];

/**
 * A full policy. `extra` adds sources to a directive; nothing here can remove
 * one, and `frame-ancestors`, `form-action`, `base-uri` and `object-src` are
 * not extendable at all.
 */
export function buildCsp(opts: {
  isProd: boolean;
  extra?: CspSources;
  frameAncestors?: "'none'" | "'self'";
  /** The admin frames its own band probe. */
  frameSelf?: boolean;
}): string {
  const x = opts.extra ?? {};
  const join = (base: readonly string[], add: readonly string[] | undefined) => unique([...base, ...(add ?? [])]).join(' ');
  return [
    "default-src 'self'",
    `script-src ${join(["'self'", "'unsafe-inline'", ...(opts.isProd ? [] : ["'unsafe-eval'"])], x.script)}`,
    `style-src ${join(["'self'", "'unsafe-inline'"], x.style)}`,
    `font-src ${join(["'self'", 'data:'], x.font)}`,
    `img-src ${join(["'self'", 'data:', 'blob:'], x.img)}`,
    `media-src ${join(["'self'", 'blob:'], x.media)}`,
    `connect-src ${join(["'self'"], x.connect)}`,
    `frame-src ${join([...(opts.frameSelf ? ["'self'"] : []), ...EMBED_FRAME_SOURCES], x.frame)}`,
    `frame-ancestors ${opts.frameAncestors ?? "'none'"}`,
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    'upgrade-insecure-requests',
  ].join('; ');
}

/** Merge several source lists — every integration's, the CAPTCHA's, the custom snippets'. */
export function mergeSources(...lists: CspSources[]): CspSources {
  const out: Required<CspSources> = { script: [], connect: [], img: [], frame: [], style: [], font: [], media: [] };
  for (const list of lists) {
    for (const key of Object.keys(out) as (keyof CspSources)[]) out[key] = [...new Set([...out[key], ...(list[key] ?? [])])];
  }
  return out;
}
