import 'server-only';
import type { Crumb } from '@/lib/seo/jsonld';
import { getPageByPath } from './pages';

/**
 * A page's breadcrumb trail: Home, then every ancestor path that is itself a
 * page (/library for /library/widgets), then the page. One trail feeds both
 * the BreadcrumbList structured data and the breadcrumbs block, so what a
 * visitor sees and what a search engine is told never disagree.
 *
 * An ancestor that is not a page is skipped rather than invented — except
 * /services, which the service catalogue always has.
 */
export async function pageTrail(path: string, title: string): Promise<Crumb[]> {
  const trail: Crumb[] = [{ name: 'Home', path: '/' }];
  if (path === '/') return trail;

  const parts = path.split('/').filter(Boolean);
  for (let i = 1; i < parts.length; i++) {
    const ancestor = `/${parts.slice(0, i).join('/')}`;
    const page = await getPageByPath(ancestor);
    if (page) trail.push({ name: page.title, path: ancestor });
    else if (ancestor === '/services') trail.push({ name: 'Services', path: ancestor });
  }

  trail.push({ name: title, path });
  return trail;
}
