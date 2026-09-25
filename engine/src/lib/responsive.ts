/* ═══════════════════════════════════════════════════════════════════════════
   Responsive images (T18, 2.17)
   ───────────────────────────────────────────────────────────────────────────
   An uploaded picture gets smaller copies beside it — `abc.png` gains
   `abc.w480.webp`, `abc.w768.webp`, … (and `.avif` when that is on) — and a
   page asks for one with `?w=`: `/media/2026/09/abc.png?w=768`. The media
   route answers with the smallest copy at least that wide, or the original
   when there is none, so a `srcset` can be written from the address alone,
   with no lookup, in a server component or a client one.

   Off by default (Settings → Media): a site that updates renders exactly the
   `<img>` it rendered before. Switched on, every engine image gains a
   `srcset` and a `sizes`. Like the trailing slash, the switch is one
   process-wide value on the server (`setImageMode`, set by the routing
   config) and `<html data-img>` in the browser, so a client component
   renders the same markup during hydration as the server did.
   ═══════════════════════════════════════════════════════════════════════════ */

/** The widths generated, and offered in a `srcset`. Never wider than the original. */
export const RESPONSIVE_WIDTHS = [480, 768, 1024, 1440, 1920, 2560] as const;
export type ResponsiveWidth = (typeof RESPONSIVE_WIDTHS)[number];

export type VariantFormat = 'webp' | 'avif';

/** Pictures that are resized. A GIF keeps its animation; an SVG has no pixels to save. */
const RESIZABLE = /^\/media\/[A-Za-z0-9._\-/]+\.(webp|png|jpe?g)$/i;

export function isResizable(url: string | undefined | null): url is string {
  return !!url && RESIZABLE.test(url) && !url.includes('..');
}

/** `2026/09/abc.png` → `2026/09/abc.w480.webp`. */
export function variantFilename(filename: string, width: number, format: VariantFormat): string {
  return `${filename.replace(/\.[A-Za-z0-9]+$/, '')}.w${width}.${format}`;
}

/** A variant's own filename is never itself resized again. */
export const VARIANT_NAME = /\.w\d{2,4}\.(webp|avif)$/;

/** The widths worth generating for an original this wide. */
export function widthsFor(originalWidth: number | null | undefined): ResponsiveWidth[] {
  if (!originalWidth) return [];
  return RESPONSIVE_WIDTHS.filter((width) => width < originalWidth);
}

/** The width a `?w=` asks for, snapped up to one that is generated; null for anything else. */
export function requestedWidth(raw: string | null): ResponsiveWidth | null {
  if (!raw || !/^\d{2,4}$/.test(raw)) return null;
  const wanted = Number(raw);
  return RESPONSIVE_WIDTHS.find((width) => width >= wanted) ?? null;
}

/* ── The switch ───────────────────────────────────────────────────────────── */

type ImageGlobal = { __heImageMode?: boolean };

export function setImageMode(responsive: boolean): void {
  (globalThis as ImageGlobal).__heImageMode = responsive;
}

export function responsiveImages(): boolean {
  if (typeof document !== 'undefined') return document.documentElement.dataset.img === 'responsive';
  return (globalThis as ImageGlobal).__heImageMode ?? false;
}

/* ── Markup ───────────────────────────────────────────────────────────────── */

/** Common `sizes` for where an image sits. A component passes its own when it knows better. */
export const SIZES = {
  full: '100vw',
  wide: '(max-width: 1024px) 100vw, 1200px',
  half: '(max-width: 768px) 100vw, 50vw',
  third: '(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw',
  quarter: '(max-width: 768px) 50vw, 25vw',
  thumb: '160px',
} as const;
export type SizesHint = keyof typeof SIZES;

/**
 * The attributes that make one `<img>` responsive, or nothing at all when
 * the switch is off or the picture is not one that is resized — so an
 * untouched site's markup does not change by a character.
 */
export function responsiveAttrs(src: string | undefined, sizes: SizesHint | string = 'full'): { srcSet?: string; sizes?: string } {
  if (!responsiveImages() || !isResizable(src)) return {};
  return {
    srcSet: RESPONSIVE_WIDTHS.map((width) => `${src}?w=${width} ${width}w`).join(', '),
    sizes: sizes in SIZES ? SIZES[sizes as SizesHint] : sizes,
  };
}
