import { z } from 'zod';
import { isUsableLength } from './theme';

/* ═══════════════════════════════════════════════════════════════════════════
   3.37 — the form block's space under its heading (to the first question, or
   the card) and above the send button, on every screen and on phones
   (≤768px; unset there, the wider value holds). Classes and custom
   properties on the section, read by library-form-details.css.
   ═══════════════════════════════════════════════════════════════════════════ */

const length = z.string().trim().max(40).refine(isUsableLength, 'A CSS length, such as 40px');

/** Spread into the `form` schema. */
export const formSpacingFields = {
  titleGap: length.optional(),
  titleGapMobile: length.optional(),
  submitGap: length.optional(),
  submitGapMobile: length.optional(),
};

type Spacing = { titleGap?: string; titleGapMobile?: string; submitGap?: string; submitGapMobile?: string };

const len = (v: unknown): string | undefined => (typeof v === 'string' && isUsableLength(v.trim()) && !/[;{}<>]/.test(v) ? v.trim() : undefined);

const PARTS = [
  ['titleGap', 'has-title-gap', '--he-fb-tgap'],
  ['titleGapMobile', 'has-title-gap-m', '--he-fb-tgap-m'],
  ['submitGap', 'has-submit-gap', '--he-fb-sgap'],
  ['submitGapMobile', 'has-submit-gap-m', '--he-fb-sgap-m'],
] as const;

/** The section's extra classes and custom properties; empty for nothing set. */
export function formSpacing(p: Spacing): { classes: string[]; style: Record<string, string> } {
  const classes: string[] = [];
  const style: Record<string, string> = {};
  for (const [key, cls, property] of PARTS) {
    const value = len(p[key]);
    if (!value) continue;
    classes.push(cls);
    style[property] = value;
  }
  return { classes, style };
}
