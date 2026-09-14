import 'server-only';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { type ServiceRef, services as bundledServices } from '@/lib/site';
import { db } from '@/server/db';
import { pages } from '@/server/db/schema';

/* ═══════════════════════════════════════════════════════════════════════════
   The service catalogue
   ───────────────────────────────────────────────────────────────────────────
   Derived from the pages table, not stored twice.

   A service *is* a page with `template = 'service'`. Everything the catalogue
   needs is already a column on that page:

     slug       → page.slug          title  → page.title
     shortTitle → page.navLabel      blurb  → page.summary
     tier       → page.priorityTier  order  → page.sortOrder

   So adding a service is creating a page, which the admin has always been able
   to do — and there is no second list to keep in step. Until now this was a
   constant in `src/lib/site.ts` and adding a service meant a deploy.
   ═══════════════════════════════════════════════════════════════════════════ */

export type Service = ServiceRef & { pageId: string };

function fromBundled(): Service[] {
  return bundledServices.map((s) => ({ ...s, pageId: `def:${s.slug}` }));
}

/**
 * Every published service, in `sortOrder`.
 *
 * Database first, bundled constants second — the same rule pages and menus
 * follow. A database outage leaves the site with the catalogue it shipped
 * with rather than an empty services index.
 */
export async function getServices(): Promise<Service[]> {
  try {
    const rows = await db
      .select({
        id: pages.id,
        slug: pages.slug,
        title: pages.title,
        navLabel: pages.navLabel,
        summary: pages.summary,
        excerpt: pages.excerpt,
        tier: pages.priorityTier,
        sortOrder: pages.sortOrder,
      })
      .from(pages)
      .where(
        and(
          eq(pages.template, 'service'),
          eq(pages.status, 'published'),
          isNull(pages.deletedAt),
          // Same rule as the page itself: a service scheduled for next week
          // must not appear in the catalogue before its page exists.
          sql`${pages.publishedAt} is not null and ${pages.publishedAt} <= now()`,
        ),
      )
      .orderBy(asc(pages.sortOrder), asc(pages.title));

    if (rows.length === 0) return fromBundled();

    return rows.map((row) => ({
      pageId: row.id,
      slug: row.slug,
      title: row.title,
      // `navLabel` is exactly "the short name for menus"; fall back to the full
      // title so a page created without one still renders sensibly.
      shortTitle: row.navLabel?.trim() || row.title,
      // `summary` is the one-line card text; `excerpt` is the meta description
      // and is far too long for a card. Fall back only if summary is unset.
      blurb: row.summary?.trim() || row.excerpt || '',
      tier: row.tier === 'secondary' ? 'secondary' : 'primary',
      mockup: '',
    }));
  } catch {
    return fromBundled();
  }
}

export type ServiceCatalogue = {
  all: Service[];
  primary: Service[];
  secondary: Service[];
};

export async function getServiceCatalogue(): Promise<ServiceCatalogue> {
  const all = await getServices();
  return {
    all,
    primary: all.filter((s) => s.tier === 'primary'),
    secondary: all.filter((s) => s.tier === 'secondary'),
  };
}

export async function getServiceBySlug(slug: string): Promise<Service | null> {
  const all = await getServices();
  return all.find((s) => s.slug === slug) ?? null;
}
