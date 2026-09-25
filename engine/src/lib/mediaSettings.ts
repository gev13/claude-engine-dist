import { z } from 'zod';
import { ROLES, type Role } from './roles';

/* ═══════════════════════════════════════════════════════════════════════════
   Media settings (T17/T18, 2.17)
   ───────────────────────────────────────────────────────────────────────────
   One `media` settings row. Responsive images are off until switched on, so
   an updated site renders the same `<img>` it did; SVG uploads are open to
   the roles that already run the site, and an administrator can widen or
   close that on the Security screen.
   ═══════════════════════════════════════════════════════════════════════════ */

export const MEDIA_SETTING_KEY = 'media';

export const mediaSettingsSchema = z.object({
  /** Smaller copies of every picture, and a `srcset` on every engine image. */
  responsive: z.boolean().default(false),
  /** Also make AVIF copies — smaller still, and slower to generate. */
  avif: z.boolean().default(false),
  /** Who may upload an SVG. The file is cleaned whoever uploads it. */
  svgRoles: z.array(z.enum(ROLES)).default(['admin', 'manager']),
});

export type MediaSettings = z.output<typeof mediaSettingsSchema>;

export function resolveMediaSettings(stored: unknown): MediaSettings {
  const parsed = mediaSettingsSchema.safeParse(stored ?? {});
  return parsed.success ? parsed.data : mediaSettingsSchema.parse({});
}

export const canUploadSvg = (settings: MediaSettings, role: Role) => settings.svgRoles.includes(role);

/** One generated copy of a picture, as recorded on its media row. */
export type MediaVariant = { width: number; height: number; format: 'webp' | 'avif'; bytes: number };
