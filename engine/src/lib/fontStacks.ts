import { FONT_CATALOGUE, type CatalogueRole } from './fontCatalogue';

/* ═══════════════════════════════════════════════════════════════════════════
   The faces an editor may choose, as CSS stacks (3.37: out of theme.ts, so
   lib/typeStyle.ts can check a face against the same list without importing
   the theme, which imports it). theme.ts re-exports all three.
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * The five the engine was built with: three self-hosted brand faces and two
 * that resolve to whatever the reader's device has.
 *
 * These keep their short names because they are stored in every theme and
 * every block style already written — `display` means Bricolage Grotesque and
 * always will.
 */
export const BRAND_STACKS = {
  display: "'Bricolage Grotesque', 'Archivo', system-ui, sans-serif",
  sans: "'Archivo', system-ui, -apple-system, sans-serif",
  mono: "'JetBrains Mono', ui-monospace, 'SFMono-Regular', monospace",
  system: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  serif: "Georgia, 'Times New Roman', Times, serif",
} as const;

/** What a catalogue family falls back to while its file loads, or if it fails. */
const FALLBACK: Record<CatalogueRole, string> = {
  sans: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  serif: "Georgia, 'Times New Roman', Times, serif",
  display: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  mono: "ui-monospace, 'SFMono-Regular', monospace",
};

/**
 * Every face an editor may choose: the five above plus the self-hosted Google
 * Fonts catalogue.
 *
 * Built from `fontCatalogue.ts`, which `scripts/fetch-fonts.mjs` generates
 * beside the files themselves — so a family cannot be offered unless its
 * `.woff2` is actually on disk, which is the mistake this arrangement exists
 * to make impossible.
 */
export const FONT_STACKS: Record<string, string> = {
  ...BRAND_STACKS,
  ...Object.fromEntries(FONT_CATALOGUE.map((f) => [f.key, `'${f.family}', ${FALLBACK[f.role]}`])),
};
