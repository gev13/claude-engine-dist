import { z } from 'zod';
import type { Theme } from './theme';
import { isColor } from './theme';
import { colorDecls } from './theme-css';

/* ═══════════════════════════════════════════════════════════════════════════
   One page's own colours (T31, 2.19)
   ───────────────────────────────────────────────────────────────────────────
   A page, a post or a project can take its own background — black
   project pages on a charcoal site, say — and the site's alternate
   palette (Appearance → Colours), which moves every token, so the header,
   the rails and the cursor follow. Stored as `appearance` on the row and
   written into one `<style>` after the page's blocks, like a project's
   background always was.
   ═══════════════════════════════════════════════════════════════════════════ */

export const pageAppearanceSchema = z.object({
  background: z
    .string()
    .trim()
    .max(60)
    .refine((value) => value === '' || isColor(value), 'A colour such as #000000')
    .optional(),
  /** `alt` — the site's alternate palette, for this page. */
  scheme: z.enum(['inherit', 'alt']).optional(),
});

export type PageAppearance = z.output<typeof pageAppearanceSchema>;

export function readPageAppearance(value: unknown): PageAppearance {
  const parsed = pageAppearanceSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : {};
}

/** The CSS for one page's colours, or '' when it has none of its own. Every value checked twice. */
export function pageAppearanceCss(appearance: PageAppearance, theme: Theme): string {
  const parts: string[] = [];
  if (appearance.scheme === 'alt') {
    const decls = colorDecls(theme, 'colorsAlt');
    if (decls.length) parts.push(`:root{${decls.map(([k, v]) => `${k}:${v}`).join(';')}}`);
  }
  if (appearance.background && isColor(appearance.background)) {
    // Every section paints the base tone (`--color-ink`) as its own band, so
    // the page's colour has to *be* the base tone inside `main` — painting the
    // body alone is covered edge to edge. Raised sections keep their surface,
    // and the header and footer, outside `main`, keep the site's.
    parts.push(`body,.he-site{background-color:${appearance.background}}#main{--color-ink:${appearance.background};background-color:${appearance.background}}`);
  }
  return parts.join('');
}
