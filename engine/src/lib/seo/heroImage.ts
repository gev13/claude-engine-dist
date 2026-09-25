/**
 * The picture a page opens with — its first hero's image, or the first slide
 * of a hero slider — for sharing a page that has not chosen one (2.18).
 * Only the page's own top-level blocks: a picture deep in a row is not what
 * the page is.
 */
export function heroImage(blocks: readonly unknown[] | undefined): string | undefined {
  for (const block of (blocks ?? []).slice(0, 3)) {
    const b = block as { type?: string; props?: Record<string, unknown> } | null;
    if (!b?.props) continue;
    if (b.type === 'hero' && typeof b.props.imageUrl === 'string' && b.props.imageUrl) return b.props.imageUrl;
    if (b.type === 'carousel' && b.props.mode === 'hero') {
      const first = (b.props.slides as { imageUrl?: unknown }[] | undefined)?.[0];
      if (typeof first?.imageUrl === 'string' && first.imageUrl) return first.imageUrl;
    }
  }
  return undefined;
}
