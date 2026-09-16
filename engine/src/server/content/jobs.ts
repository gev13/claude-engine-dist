import 'server-only';
import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';
import { localeConfig, type Locale } from '@/lib/locales';
import { db } from '@/server/db';
import { jobs, media } from '@/server/db/schema';
import type { SeoFields } from '@/server/db/schema';

/* ═══════════════════════════════════════════════════════════════════════════
   Open roles
   ───────────────────────────────────────────────────────────────────────────
   The same shape as posts: published, not deleted, and with a publish date
   that has passed — so a job can be written today and appear on Monday
   without anything running on a timer.

   `isOpen` is separate from all of that. A role that has been filled is closed
   by hand; its page stays up, saying so, rather than 404ing on everybody who
   has the link. A deadline passing does not close it either — that is the
   client's decision, not the engine's.
   ═══════════════════════════════════════════════════════════════════════════ */

export type JobCard = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  location: string;
  contractType: string;
  department: string;
  postedAt: Date | null;
  deadline: Date | null;
  isOpen: boolean;
};

export type JobDetail = JobCard & {
  locale: Locale;
  translationGroupId: string;
  workingTime: string;
  seniority: string;
  workweek: string;
  description: string;
  responsibilities: string;
  benefits: string;
  coverUrl: string | null;
  seo: SeoFields;
  updatedAt: Date;
};

const isPublic = and(
  eq(jobs.status, 'published'),
  isNull(jobs.deletedAt),
  sql`${jobs.publishedAt} is not null and ${jobs.publishedAt} <= now()`,
);

const cardColumns = {
  id: jobs.id,
  slug: jobs.slug,
  title: jobs.title,
  excerpt: jobs.excerpt,
  location: jobs.location,
  contractType: jobs.contractType,
  department: jobs.department,
  postedAt: jobs.postedAt,
  deadline: jobs.deadline,
  isOpen: jobs.isOpen,
};

/**
 * The careers listing.
 *
 * Open roles first, then closed ones — a filled role is still worth showing
 * (it tells somebody the company hires for that) but it should never sit above
 * one they could actually apply for.
 */
export async function listJobs(
  opts: { locale?: Locale; limit?: number; openOnly?: boolean } = {},
): Promise<JobCard[]> {
  const locale = opts.locale ?? localeConfig().defaultLocale;
  const conditions = [isPublic, eq(jobs.locale, locale)];
  if (opts.openOnly) conditions.push(eq(jobs.isOpen, true));

  try {
    return await db
      .select(cardColumns)
      .from(jobs)
      .where(and(...conditions))
      .orderBy(desc(jobs.isOpen), asc(jobs.sortOrder), desc(jobs.postedAt))
      .limit(opts.limit ?? 48);
  } catch {
    // Database unreachable: the careers section is simply empty.
    return [];
  }
}

export async function getJob(slug: string, requested?: Locale): Promise<JobDetail | null> {
  const locale = requested ?? localeConfig().defaultLocale;
  try {
    const [row] = await db
      .select({
        ...cardColumns,
        locale: jobs.locale,
        translationGroupId: jobs.translationGroupId,
        workingTime: jobs.workingTime,
        seniority: jobs.seniority,
        workweek: jobs.workweek,
        description: jobs.description,
        responsibilities: jobs.responsibilities,
        benefits: jobs.benefits,
        seo: jobs.seo,
        updatedAt: jobs.updatedAt,
        coverUrl: media.url,
      })
      .from(jobs)
      .leftJoin(media, eq(media.id, jobs.coverMediaId))
      .where(and(eq(jobs.slug, slug), eq(jobs.locale, locale), isPublic))
      .limit(1);

    if (!row) return null;
    return {
      ...row,
      locale: row.locale as Locale,
      seo: (row.seo ?? {}) as SeoFields,
    };
  } catch {
    return null;
  }
}

/** Where else this role is advertised, for `hreflang` and the switcher. */
export async function getJobTranslations(translationGroupId: string): Promise<{ locale: Locale; slug: string }[]> {
  try {
    const rows = await db
      .select({ locale: jobs.locale, slug: jobs.slug })
      .from(jobs)
      .where(and(eq(jobs.translationGroupId, translationGroupId), isPublic));
    return rows.map((row) => ({ locale: row.locale as Locale, slug: row.slug }));
  } catch {
    return [];
  }
}

/** Slugs in one language, for static params. */
export async function allPublishedJobSlugs(requested?: Locale): Promise<{ slug: string; updatedAt: Date }[]> {
  const locale = requested ?? localeConfig().defaultLocale;
  try {
    return await db
      .select({ slug: jobs.slug, updatedAt: jobs.updatedAt })
      .from(jobs)
      .where(and(isPublic, eq(jobs.locale, locale)))
      .orderBy(desc(jobs.postedAt));
  } catch {
    return [];
  }
}

/**
 * Every language's jobs, grouped by translation — for the sitemap.
 *
 * `isOpen` travels with each row because the sitemap leaves filled roles out:
 * their pages are `noindex` and carry no JobPosting, so listing them would ask
 * a crawler to index the page the advert is asking it to skip.
 */
export async function allPublishedJobsByGroup(): Promise<
  {
    slug: string;
    locale: Locale;
    updatedAt: Date;
    isOpen: boolean;
    alternates: { locale: Locale; slug: string }[];
  }[]
> {
  try {
    const rows = await db
      .select({
        slug: jobs.slug,
        locale: jobs.locale,
        updatedAt: jobs.updatedAt,
        isOpen: jobs.isOpen,
        groupId: jobs.translationGroupId,
      })
      .from(jobs)
      .where(isPublic);

    const byGroup = new Map<string, { locale: Locale; slug: string }[]>();
    for (const row of rows) {
      const list = byGroup.get(row.groupId) ?? [];
      list.push({ locale: row.locale as Locale, slug: row.slug });
      byGroup.set(row.groupId, list);
    }

    return rows.map((row) => ({
      slug: row.slug,
      locale: row.locale as Locale,
      updatedAt: row.updatedAt,
      isOpen: row.isOpen,
      alternates: byGroup.get(row.groupId) ?? [],
    }));
  } catch {
    return [];
  }
}
