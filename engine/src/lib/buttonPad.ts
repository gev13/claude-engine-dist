import { z } from 'zod';
import { length } from './blockStyle';
import { isLength } from './theme';

/**
 * 3.14 — one button's own padding, on every screen and on tablets and phones.
 *
 * Every button reads `--he-btn-py` / `--he-btn-px` (the theme's, on :root).
 * A button with its own values redefines them on itself, so the padding —
 * and anything else drawn from those two, such as the arrow's compartment —
 * follows. Each value travels as its own custom property, switched on by its
 * own class (library-upgrades.css), so an unset one leaves the theme's alone.
 */
export const buttonPadSchema = z
  .object({
    y: length.optional(),
    x: length.optional(),
    yTablet: length.optional(),
    xTablet: length.optional(),
    yMobile: length.optional(),
    xMobile: length.optional(),
  })
  .optional();

export type ButtonPad = z.infer<typeof buttonPadSchema>;

const KEYS = [
  ['y', 'py'],
  ['x', 'px'],
  ['yTablet', 'py-t'],
  ['xTablet', 'px-t'],
  ['yMobile', 'py-m'],
  ['xMobile', 'px-m'],
] as const;

/** The class and custom properties for a button's own padding; nothing for none. */
export function buttonPadProps(pad: ButtonPad | undefined): { className?: string; style?: Record<string, string> } {
  if (!pad) return {};
  const style: Record<string, string> = {};
  const classes: string[] = [];
  for (const [key, suffix] of KEYS) {
    const value = pad[key];
    // Checked again: it lands in a style attribute.
    if (!value || !isLength(value)) continue;
    style[`--he-own-${suffix}`] = value;
    classes.push(`he-own-${suffix}`);
  }
  return classes.length ? { className: classes.join(' '), style } : {};
}
