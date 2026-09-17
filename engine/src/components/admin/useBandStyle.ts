'use client';

import { useEffect, useState } from 'react';
import { STYLE_BREAKPOINTS, type SpacingBox } from '@/lib/blockStyle';

/* ═══════════════════════════════════════════════════════════════════════════
   What styling does this block already have?
   ───────────────────────────────────────────────────────────────────────────
   Measured, never tabulated. Every block paints its own band in its own
   stylesheet, often at a different size per width, and a copy of those
   numbers in TypeScript would be right the day it was written — the same
   reasoning that makes `useThemeDefaults` read the document rather than keep
   a second set of defaults.

   The measuring is done in a hidden iframe because that is the only way to
   ask "what would this be at 768px" without resizing the admin. Media
   queries answer to a viewport, so the iframe *is* the viewport: it loads
   `/admin/band/<type>`, which renders the real component with the real
   stylesheets, and is set to each breakpoint's width in turn.

   Cached for the life of the tab. A block type's own padding cannot change
   without a deploy, and an editor opens the Design tab repeatedly.
   ═══════════════════════════════════════════════════════════════════════════ */

/** The widths the four tabs speak for. `base` is "large desktop", above them all. */
const TAB_WIDTH = {
  base: 1600,
  laptop: 1440,
  tablet: 1024,
  mobile: 768,
} as const;

export type BandTab = keyof typeof TAB_WIDTH;

/** Keyed exactly like the panel's own spacing fields, so a lookup is direct. */
type Sides = Partial<Record<keyof SpacingBox, string>>;

/** Background and border are not per-breakpoint in the panel, so neither is this. */
export type BandBox = {
  background?: string;
  topWidth?: string;
  rightWidth?: string;
  bottomWidth?: string;
  leftWidth?: string;
  color?: string;
  radius?: string;
};

export type BandStyle = { spacing: Partial<Record<BandTab, Sides>>; box: BandBox };

const EMPTY: BandStyle = { spacing: {}, box: {} };

/**
 * A computed colour as a hex the panel's swatch can show, or nothing.
 *
 * Computed style answers in `rgb()`, and the colour input speaks hex. Fully
 * transparent is not a colour anybody set — it is the absence of one, and
 * showing `#000000` for it would be a lie an editor then has to undo.
 */
export function toHex(value: string): string | undefined {
  const parts = value.match(/^rgba?\(([^)]+)\)$/);
  if (!parts) return undefined;
  const [r, g, b, a] = parts[1]!.split(',').map((n) => Number.parseFloat(n.trim()));
  if (a === 0 || [r, g, b].some((n) => !Number.isFinite(n))) return undefined;
  return `#${[r!, g!, b!].map((n) => Math.round(n).toString(16).padStart(2, '0')).join('')}`;
}

/* Only the vertical sides. A band's horizontal space comes from the shell,
   which this panel does not govern, so measuring it would name a number that
   editing these fields does not change. */
const MEASURED = [
  ['paddingTop', 'paddingTop'],
  ['paddingBottom', 'paddingBottom'],
  ['marginTop', 'marginTop'],
  ['marginBottom', 'marginBottom'],
] as const satisfies readonly (readonly [keyof SpacingBox, 'paddingTop' | 'paddingBottom' | 'marginTop' | 'marginBottom'])[];

const cache = new Map<string, BandStyle>();
const inFlight = new Map<string, Promise<BandStyle>>();

/** `88px` from a computed value, or nothing when it is absent or zero. */
function usable(value: string): string | undefined {
  const rounded = Math.round(Number.parseFloat(value));
  return Number.isFinite(rounded) && rounded > 0 ? `${rounded}px` : undefined;
}

async function measure(type: string): Promise<BandStyle> {
  const frame = document.createElement('iframe');
  /* Off-screen rather than `display:none`: a hidden frame is not laid out, so
     nothing would have a padding to read. */
  frame.setAttribute('aria-hidden', 'true');
  frame.tabIndex = -1;
  frame.style.cssText = 'position:fixed;left:-10000px;top:0;height:900px;border:0;visibility:hidden';
  frame.src = `/admin/band/${encodeURIComponent(type)}`;

  const result: BandStyle = { spacing: {}, box: {} };

  try {
    await new Promise<void>((resolve, reject) => {
      frame.addEventListener('load', () => resolve(), { once: true });
      frame.addEventListener('error', () => reject(new Error('probe failed')), { once: true });
      document.body.appendChild(frame);
      // A probe that never loads must not leave the panel waiting for ever.
      setTimeout(() => reject(new Error('probe timed out')), 8000);
    });

    const doc = frame.contentDocument;
    const band = doc?.getElementById('he-band')?.firstElementChild;
    if (!band) return result;

    for (const tab of ['base', ...STYLE_BREAKPOINTS] as BandTab[]) {
      frame.style.width = `${TAB_WIDTH[tab]}px`;
      // One frame for the media queries to re-evaluate against the new width.
      await new Promise((r) => requestAnimationFrame(r));

      const style = frame.contentWindow?.getComputedStyle(band);
      if (!style) continue;

      const sides: Sides = {};
      for (const [field, property] of MEASURED) {
        const value = usable(style[property]);
        if (value) sides[field] = value;
      }
      if (Object.keys(sides).length > 0) result.spacing[tab] = sides;

      /* Background and border have no breakpoint tabs in the panel, so they
         are read once, at the width the base tab speaks for. */
      if (tab === 'base') {
        result.box = {
          background: toHex(style.backgroundColor),
          topWidth: usable(style.borderTopWidth),
          rightWidth: usable(style.borderRightWidth),
          bottomWidth: usable(style.borderBottomWidth),
          leftWidth: usable(style.borderLeftWidth),
          /* Only meaningful when something is actually drawn: every element
             has a border colour, and nearly always one nobody chose. */
          color: [style.borderTopWidth, style.borderBottomWidth].some((w) => Number.parseFloat(w) > 0)
            ? toHex(style.borderTopColor)
            : undefined,
          radius: usable(style.borderTopLeftRadius),
        };
      }
    }

    return result;
  } catch {
    // A measurement that fails costs the hint, never the panel.
    return result;
  } finally {
    frame.remove();
  }
}

/**
 * The styling a block's own band carries — spacing per breakpoint, background
 * and border once — or nothing while it is being measured, and for ever if it
 * cannot be.
 *
 * The caller must treat "nothing" as the normal case, not an error: it is
 * what a block with no band of its own genuinely has.
 */
export function useBandStyle(type: string | undefined): BandStyle {
  const [style, setStyle] = useState<BandStyle>(() => (type ? (cache.get(type) ?? EMPTY) : EMPTY));

  useEffect(() => {
    if (!type) return;

    const known = cache.get(type);
    if (known) {
      setStyle(known);
      return;
    }

    let live = true;
    // One measurement per type even when several panels ask at once.
    const pending =
      inFlight.get(type) ??
      measure(type).then((result) => {
        cache.set(type, result);
        inFlight.delete(type);
        return result;
      });
    inFlight.set(type, pending);

    void pending.then((result) => {
      if (live) setStyle(result);
    });

    return () => {
      live = false;
    };
  }, [type]);

  return style;
}
