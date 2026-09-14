/* ═══════════════════════════════════════════════════════════════════════════
   P3-F — Lottie animations
   ───────────────────────────────────────────────────────────────────────────
   A Lottie file is an animation exported as JSON (from After Effects,
   LottieFiles and similar). It is uploaded to the media library like a
   picture, checked here, and played by the Lottie block with the light SVG
   player, which runs no expressions and so needs no eval under the CSP.
   ═══════════════════════════════════════════════════════════════════════════ */

export const LOTTIE_PLAY = ['loop', 'once', 'hover', 'scroll'] as const;
export type LottiePlay = (typeof LOTTIE_PLAY)[number];

export const LOTTIE_PLAY_LABELS: Record<LottiePlay, string> = {
  loop: 'On a loop while in view',
  once: 'Once, when it comes into view',
  hover: 'On hover, backwards on leave',
  scroll: 'Following the scroll',
};

/** Animation files are small; anything larger is almost always embedded video frames. */
export const LOTTIE_MAX_BYTES = 2 * 1024 * 1024;

/** A same-site path to a .json file, e.g. /media/2026/09/abc.json. Never another origin. */
export const LOTTIE_PATH = /^\/(?!\/)(?!.*\.\.)[A-Za-z0-9._~\/-]+\.json$/;

export type LottieInfo = { width: number; height: number; frames: number; fps: number };

const isNum = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/**
 * Whether parsed JSON looks like a Lottie animation the player can draw, and
 * its size and length. It checks the fields every Lottie file has; the
 * player itself copes with the rest.
 */
export function checkLottie(data: unknown): { ok: true; info: LottieInfo } | { ok: false; error: string } {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { ok: false, error: 'The file is not a Lottie animation.' };
  const d = data as Record<string, unknown>;
  if (typeof d.v !== 'string' || !Array.isArray(d.layers)) return { ok: false, error: 'The file is not a Lottie animation.' };
  if (!isNum(d.w) || !isNum(d.h) || d.w <= 0 || d.h <= 0 || d.w > 8000 || d.h > 8000) {
    return { ok: false, error: 'The animation has no usable width and height.' };
  }
  if (!isNum(d.fr) || d.fr <= 0 || d.fr > 240) return { ok: false, error: 'The animation has no usable frame rate.' };
  if (!isNum(d.ip) || !isNum(d.op) || d.op <= d.ip) return { ok: false, error: 'The animation has no frames.' };
  if (d.layers.length === 0) return { ok: false, error: 'The animation has no layers.' };
  if (d.layers.length > 500) return { ok: false, error: 'The animation has too many layers.' };
  return { ok: true, info: { width: Math.round(d.w), height: Math.round(d.h), frames: Math.round(d.op - d.ip), fps: d.fr } };
}

/**
 * How far an element has travelled through the viewport: 0 as its top enters
 * at the bottom, 1 as its bottom leaves at the top.
 */
export function scrollProgress(top: number, height: number, viewport: number): number {
  const span = viewport + height;
  if (span <= 0) return 0;
  return Math.min(1, Math.max(0, (viewport - top) / span));
}
