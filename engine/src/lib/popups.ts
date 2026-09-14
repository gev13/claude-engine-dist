import { z } from 'zod';

/* ═══════════════════════════════════════════════════════════════════════════
   Popups (package 3, phase D)
   ───────────────────────────────────────────────────────────────────────────
   A popup is content built from ordinary blocks, shown over the site: where
   it sits, what opens it, how often, and on which pages. They live in one
   `popups` settings row, edited at /admin/popups. The arithmetic here is
   pure, so it can be tested; the browser half is PopupShell.
   ═══════════════════════════════════════════════════════════════════════════ */

export const POPUP_POSITIONS = ['center', 'bottom-right', 'bottom-left', 'side-right', 'top-bar', 'bottom-bar', 'fullscreen'] as const;
export const POPUP_TRIGGERS = ['delay', 'exit', 'scroll', 'click'] as const;
export const POPUP_FREQUENCIES = ['always', 'session', 'days'] as const;
export type PopupPosition = (typeof POPUP_POSITIONS)[number];

export const POPUP_POSITION_LABELS: Record<PopupPosition, string> = {
  center: 'Centred, over a dimmed page',
  'bottom-right': 'Bottom-right corner',
  'bottom-left': 'Bottom-left corner',
  'side-right': 'A panel down the right-hand side',
  'top-bar': 'A bar across the top',
  'bottom-bar': 'A bar across the bottom',
  fullscreen: 'Full screen',
};

/** "/pricing" is one page; "/blog/*" is /blog and everything under it. */
const pathPattern = z
  .string()
  .trim()
  .max(200)
  .regex(/^\/[A-Za-z0-9._~\-/%]*\*?$/, 'Start with / — end with * to include every page below it');

const popupBlock = z.object({ id: z.string(), type: z.string(), props: z.record(z.string(), z.unknown()), style: z.unknown().optional() }).passthrough();

export const popupSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{1,40}$/),
  name: z.string().trim().min(1).max(80),
  /** A link to `#popup-<slug>` anywhere on the site opens it. */
  slug: z.string().trim().regex(/^[a-z0-9-]{1,40}$/, 'Use lower-case letters, digits and dashes'),
  enabled: z.boolean().default(true),
  blocks: z.array(popupBlock).max(12).default([]),
  position: z.enum(POPUP_POSITIONS).default('center'),
  size: z.enum(['small', 'medium', 'large']).default('medium'),
  trigger: z.enum(POPUP_TRIGGERS).default('delay'),
  /** Seconds, for `delay`. */
  delay: z.number().int().min(0).max(120).default(5),
  /** Per cent of the page, for `scroll`. */
  scroll: z.number().int().min(5).max(100).default(50),
  frequency: z.enum(POPUP_FREQUENCIES).default('session'),
  /** For `days`: how long after it was closed before it may show again. */
  days: z.number().int().min(1).max(365).default(7),
  pages: z.enum(['all', 'only', 'except']).default('all'),
  paths: z.array(pathPattern).max(20).default([]),
  devices: z.enum(['all', 'desktop', 'mobile']).default('all'),
  /** Dim the page behind a centred popup; a click on the dimmed page closes it. */
  overlay: z.boolean().default(true),
});

export type Popup = z.infer<typeof popupSchema>;
export type PopupSettings = Omit<Popup, 'blocks'>;

const unique = (list: string[]) => new Set(list).size === list.length;

export const popupsSchema = z
  .array(popupSchema)
  .max(10)
  .refine((list) => unique(list.map((p) => p.id)), 'Two popups share an id')
  .refine((list) => unique(list.map((p) => p.slug)), 'Two popups share a link name');

/** Whether `path` is the page a pattern names, or under it for a pattern ending in `*`. */
export function matchesPath(pattern: string, path: string): boolean {
  const trim = (p: string) => (p.length > 1 ? p.replace(/\/+$/, '') : p);
  if (pattern.endsWith('*')) {
    const base = trim(pattern.slice(0, -1)) || '/';
    return base === '/' || trim(path) === base || path.startsWith(`${base}/`);
  }
  return trim(pattern) === trim(path);
}

/** Whether a popup is meant for this page at all. */
export function popupOnPage(popup: Pick<Popup, 'pages' | 'paths'>, path: string): boolean {
  if (popup.pages === 'all') return true;
  const hit = popup.paths.some((pattern) => matchesPath(pattern, path));
  return popup.pages === 'only' ? hit : !hit;
}

/**
 * Whether a popup may open by itself again. `lastClosed` is read from the
 * browser's session storage for `session` and its local storage for `days`,
 * so a session popup that has been closed stays closed until the tab does.
 */
export function dueAgain(frequency: Popup['frequency'], days: number, lastClosed: number | null, now: number): boolean {
  if (frequency === 'always' || lastClosed === null) return true;
  if (frequency === 'session') return false;
  return now - lastClosed >= days * 86_400_000;
}
