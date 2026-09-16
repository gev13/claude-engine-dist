'use client';

import { useEffect, useState } from 'react';
import { BUTTON_VARIANTS, TYPE_ROLES } from '@/lib/theme';
import { COLOR_TOKENS } from '@/lib/theme-css';

/* ═══════════════════════════════════════════════════════════════════════════
   What a value is, when nobody has set it
   ───────────────────────────────────────────────────────────────────────────
   Every field on the Appearance screen is optional, and an empty one used to
   say "inherit" — true, and useless: inherit *what*? An editor could not tell
   whether the H1 they were about to change was 40px or 66px without leaving
   the screen and measuring the site.

   The honest answer is already in the document. `globals.css` declares every
   `--he-*` and `--color-*` property in `@layer base` with the shipped value,
   and the admin loads that stylesheet — but the admin never emits the site's
   own theme at `:root` (its preview panel is scoped to a class), so reading
   the root here gives the value a *cleared* field would fall back to. Which is
   exactly what the field needs to show.

   Reading the document beats keeping a second copy of the defaults in
   TypeScript, which would be right the day it was written and wrong by the
   next stylesheet edit.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Theme value → the custom property it writes. Mirrors `theme-css.ts`. */
export const typeVar = (
  role: string,
  field: 'size' | 'weight' | 'style' | 'color' | 'transform' | 'decoration' | 'lineHeight' | 'letterSpacing' | 'family',
) => {
  const suffix =
    field === 'lineHeight' ? 'line' : field === 'letterSpacing' ? 'tracking' : field;
  return `--he-${role}-${suffix}`;
};

export const colorVar = (key: string) => COLOR_TOKENS[key];

/* The whole list is static, so the hook takes no arguments and the effect has
   no dependencies — no array identity to get wrong. */
const PROPERTIES: string[] = [
  ...Object.values(COLOR_TOKENS),
  '--container-shell',
  '--spacing-gutter',
  '--he-radius',
  '--he-logo-height',
  '--he-btn-radius',
  '--he-btn-px',
  '--he-btn-py',
  '--he-btn-size',
  '--he-btn-tracking',
  '--he-btn-transform',
  ...TYPE_ROLES.flatMap((role) =>
    (['size', 'weight', 'style', 'color', 'transform', 'decoration', 'lineHeight', 'letterSpacing'] as const).map(
      (field) => typeVar(role, field),
    ),
  ),
  ...BUTTON_VARIANTS.flatMap((variant) => [
    `--he-btn-${variant}-bg`,
    `--he-btn-${variant}-text`,
    `--he-btn-${variant}-border`,
    `--he-btn-${variant}-border-width`,
    `--he-btn-${variant}-hover-bg`,
    `--he-btn-${variant}-hover-text`,
    `--he-btn-${variant}-hover-border`,
  ]),
];

export type ThemeDefaults = Record<string, string | undefined>;

/**
 * The shipped value of every property the Appearance screen can set.
 *
 * Empty on the server and on the first render, so a field falls back to the
 * word it showed before — the screen is never blocked on this.
 */
export function useThemeDefaults(): ThemeDefaults {
  const [values, setValues] = useState<ThemeDefaults>({});

  useEffect(() => {
    const computed = getComputedStyle(document.documentElement);
    const next: ThemeDefaults = {};
    for (const property of PROPERTIES) {
      // A custom property's computed value has its var() references already
      // substituted, so `--he-body-color` arrives as a colour, not as
      // "var(--color-bone)".
      const value = computed.getPropertyValue(property).trim();
      if (value) next[property] = value;
    }
    setValues(next);
  }, []);

  return values;
}
