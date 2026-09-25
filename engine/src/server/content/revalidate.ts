import 'server-only';
import { revalidatePath } from 'next/cache';
import { pingSearchEngines } from './ping';
import { localeConfig } from '@/lib/locales';

/**
 * A public path and the route paths the cache knows it by.
 *
 * The middleware rewrites every public address onto the `[locale]` segment,
 * so what Next caches for `/about` is `/en/about`, and a translation at
 * `/hy/about` is cached as itself. Revalidating only the public spelling left
 * the default language's cached copy in place until its timer ran out; this
 * names every spelling the one address can have.
 */
function spellings(path: string): string[] {
  const { locales, defaultLocale } = localeConfig();
  const bare = path.replace(/\/+$/, '') || '/';
  if (bare.includes('.') || bare.startsWith('/api')) return [bare];
  const out = new Set([bare, bare === '/' ? `/${defaultLocale}` : `/${defaultLocale}${bare}`]);
  const first = bare.split('/')[1] ?? '';
  // Already a translation's own address: that is what its cache entry is called.
  if (!locales.includes(first)) for (const locale of locales) out.add(bare === '/' ? `/${locale}` : `/${locale}${bare}`);
  return [...out];
}

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
    if (trimmed) for (const spelling of spellings(trimmed)) unique.add(spelling);
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
