import 'server-only';
import { revalidatePath } from 'next/cache';
import { pingSearchEngines } from './ping';

/**
 * Paths whose output depends on *any* piece of content: the homepage pulls in
 * services and recent posts, and every sitemap enumerates the lot.
 */
const ALWAYS = ['/', '/sitemap.xml', '/sitemaps/pages.xml', '/sitemaps/services.xml', '/sitemaps/blog.xml'];

/**
 * Invalidate the ISR cache for the paths a mutation touched, plus the shared
 * ones above.
 *
 * Revalidation is a cache hint, not part of the write: `revalidatePath` throws
 * when it is called outside a request scope, and a stale cache entry is a far
 * smaller problem than a failed save the editor has to redo. So every call is
 * isolated — one bad path cannot stop the rest, and none of them can fail the
 * request.
 */
export function revalidateContent(paths: string[]): void {
  const unique = new Set<string>();
  for (const path of [...paths, ...ALWAYS]) {
    const trimmed = path?.trim();
    if (trimmed) unique.add(trimmed);
  }

  for (const path of unique) {
    try {
      revalidatePath(path);
    } catch (error) {
      console.error('[revalidate] failed', { path, error });
    }
  }

  // Fire-and-forget: search engines are told about the change, but nothing
  // about the save waits on them.
  void pingSearchEngines(paths.filter((p) => p && !p.includes('sitemap')));
}

/**
 * Invalidate every rendered page.
 *
 * A theme or brand change touches the shared layout rather than one route, so
 * there is no useful list of paths to pass — `revalidatePath('/', 'layout')`
 * drops the whole tree. Isolated for the same reason as above: a save must not
 * fail because a cache hint did.
 */
export function revalidateEverything(): void {
  try {
    revalidatePath('/', 'layout');
  } catch (error) {
    console.error('[revalidate] layout-wide revalidation failed', { error });
  }

  // Route handlers sit outside the layout tree, so the sweep above does not
  // reach them. They are the surfaces that enumerate content.
  for (const path of ['/llms.txt', '/robots.txt', '/manifest.webmanifest', ...ALWAYS.filter((p) => p.includes('sitemap'))]) {
    try {
      revalidatePath(path);
    } catch (error) {
      console.error('[revalidate] failed', { path, error });
    }
  }
}
