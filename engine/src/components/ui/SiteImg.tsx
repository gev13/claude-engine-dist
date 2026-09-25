import type { ImgHTMLAttributes } from 'react';
import { responsiveAttrs, responsiveImages, type SizesHint } from '@/lib/responsive';

/**
 * Every engine image goes through here (2.17).
 *
 * With responsive images off — the default — it renders exactly the `<img>`
 * it was given, attribute for attribute, so an updated site's markup does
 * not change. Switched on (Settings → Media), a picture from the library
 * gains a `srcset` of its generated sizes and a `sizes` for where it sits,
 * loads lazily and decodes off the main thread — except a `priority` image,
 * the first hero, which is fetched first.
 *
 * No hooks, so server and client components both use it; the switch is read
 * the same way on both sides (lib/responsive.ts), so hydration agrees.
 */
export function SiteImg({
  sizes = 'full',
  priority = false,
  ...props
}: ImgHTMLAttributes<HTMLImageElement> & { sizes?: SizesHint | string; priority?: boolean }) {
  if (!responsiveImages()) {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />;
  }
  const src = typeof props.src === 'string' ? props.src : undefined;
  return (
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    <img
      {...props}
      {...responsiveAttrs(src, sizes)}
      loading={priority ? 'eager' : (props.loading ?? 'lazy')}
      fetchPriority={priority ? 'high' : props.fetchPriority}
      decoding="async"
    />
  );
}
