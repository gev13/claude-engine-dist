import { getPermalinks } from '@/server/routing/config';
import type { Metadata } from 'next';
import Link from '@/components/ui/SiteLink';
import { BlockRenderer } from '@/components/blocks/Renderer';
import { JsonLd } from '@/components/site/JsonLd';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Heading } from '@/components/ui/Heading';
import { Section } from '@/components/ui/Section';
import { breadcrumbs, graph, itemList, webPage } from '@/lib/seo/jsonld';
import { buildMetadata } from '@/lib/seo/metadata';
import { CAREERS_PATH, JOB_META } from '@/lib/careers';
import { formatRelative, hasPassed } from '@/lib/relativeDate';
import { localeConfig, type Locale } from '@/lib/locales';
import { cn } from '@/lib/utils';
import { resolveCareersLook, type ResolvedCareersLook } from '@/lib/careersLook';
import { messageReader } from '@/lib/messages';
import { getMessages } from '@/server/content/messages';
import { getTheme } from '@/server/content/theme';
import { getPageByPath } from '@/server/content/pages';
import { listJobs, type JobCard } from '@/server/content/jobs';
import { getSiteSettings } from '@/server/content/siteSettings';

export const revalidate = 300;

type Params = { locale: string };

function fallbackDescription(siteName: string) {
  return `Open roles at ${siteName}.`;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  // The trailing-slash form every URL below is written in is a setting; load it first.
  await getPermalinks();
  const { locale } = await params;
  const [page, settings] = await Promise.all([getPageByPath(CAREERS_PATH, locale), getSiteSettings()]);
  const config = localeConfig();

  return buildMetadata({
    seo: page?.seo,
    title: page?.title ?? 'Careers',
    description: page?.excerpt || fallbackDescription(settings.name),
    path: CAREERS_PATH,
    locale,
    /* The listing exists in every language the site has, at the same path —
       unlike an advert, whose slug is translated. So the alternates are the
       configured languages, not a lookup — this one included (3.30.3): an
       hreflang set must name the page itself, or it is discarded. */
    translations: config.locales.map((code) => ({
      locale: code,
      path: CAREERS_PATH,
    })),
    siteName: settings.name,
  });
}

/** The six labels the advert shows, in order, skipping the ones left blank. */
function cardMeta(job: JobCard): string[] {
  const values: Record<string, string> = {
    location: job.location,
    department: job.department,
    contractType: job.contractType,
    workingTime: '',
    seniority: '',
    workweek: '',
  };
  return JOB_META.map(([key]) => values[key] ?? '').filter(Boolean);
}

type T = ReturnType<typeof messageReader>;

/** 3.29 — a card in the grid: "LOCATION · WORKING TIME", the title, the excerpt, when it was posted and a button. */
function JobCardItem({ job, locale, t, look }: { job: JobCard; locale: string; t: T; look: ResolvedCareersLook }) {
  const kicker = [job.location, job.workingTime].filter((v) => v && v.trim()).join(' · ');
  const href = `${CAREERS_PATH}/${job.slug}`;
  return (
    <li className={cn('he-jobc', !job.isOpen && 'is-closed')}>
      {look.kicker && kicker && <p className="he-jobc__kicker">{kicker}</p>}
      <h2 className="he-jobc__title">
        <Link href={href}>{job.title}</Link>
      </h2>
      {job.excerpt && <p className="he-jobc__excerpt">{job.excerpt}</p>}
      <div className="he-jobc__foot">
        <span className="he-jobc__when">
          {!job.isOpen ? t('careers.closed') : job.postedAt ? t('careers.posted', { when: formatRelative(new Date(job.postedAt), locale) }) : ''}
        </span>
        {look.button && (
          <span className="he-cbtn is-small is-outline he-jobc__btn" aria-hidden="true">
            {t('careers.explore')}
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l6-6M4 3h5v5" />
            </svg>
          </span>
        )}
      </div>
    </li>
  );
}

function JobRow({ job, locale, t }: { job: JobCard; locale: string; t: T }) {
  const meta = cardMeta(job);
  const closing = job.deadline && !hasPassed(new Date(job.deadline));

  return (
    <li className={cn('he-job-card', !job.isOpen && 'is-closed')}>
      <div>
        <h2 className="he-job-card__title">
          <Link href={`${CAREERS_PATH}/${job.slug}`}>{job.title}</Link>
        </h2>
        {job.excerpt && <p className="he-job-card__excerpt">{job.excerpt}</p>}
        {meta.length > 0 && (
          <p className="he-job-card__meta">
            {meta.map((value) => (
              <span key={value}>{value}</span>
            ))}
          </p>
        )}
      </div>

      <div className="he-job-card__side">
        <span className={cn('he-job-tag', job.isOpen && 'is-open')}>{job.isOpen ? t('careers.open') : t('careers.closed')}</span>
        {job.isOpen && closing && <span className="he-job-card__when">{t('careers.closes', { when: formatRelative(new Date(job.deadline!), locale) })}</span>}
        {job.isOpen && !closing && job.postedAt && <span className="he-job-card__when">{t('careers.posted', { when: formatRelative(new Date(job.postedAt), locale) })}</span>}
      </div>
    </li>
  );
}

export default async function CareersIndex({ params }: { params: Promise<Params> }) {
  // The trailing-slash form every URL below is written in is a setting; load it first.
  await getPermalinks();
  const { locale } = await params;
  const [page, jobs, settings, messages, theme] = await Promise.all([
    getPageByPath(CAREERS_PATH, locale),
    listJobs({ locale: locale as Locale, limit: 96 }),
    getSiteSettings(),
    getMessages(locale as Locale),
    getTheme(),
  ]);
  const t = messageReader(messages);
  const look = resolveCareersLook(theme.careers);

  const description = page?.excerpt || fallbackDescription(settings.name);
  const open = jobs.filter((job) => job.isOpen);

  const crumbs = breadcrumbs([
    { name: t('chrome.home'), path: '/' },
    { name: page?.title ?? t('careers.title'), path: CAREERS_PATH },
  ]);

  /* A `/careers` page in the admin owns the top of this screen — its own
     heading, copy, whatever blocks it carries. Without one the route still
     works and still has exactly one h1, because a careers section with no
     landing page written for it is the normal starting state. */
  return (
    <>
      {page ? (
        <BlockRenderer blocks={page.blocks} locale={locale} />
      ) : (
        <Section size="lg">
          <Eyebrow>{t('careers.title')}</Eyebrow>
          <Heading level={1} className="max-w-[18ch]">
            {t('careers.openRoles')}
          </Heading>
          <p className="mt-6 max-w-[62ch] text-[19px] text-ash">{description}</p>
        </Section>
      )}

      <Section tone={page ? 'raised' : 'base'} size="lg">
        {/* The page's own blocks may already have used h1, so this is h2 when
            one exists and the listing's own heading otherwise. */}
        {/* 3.29 — with cards, the page's own blocks carry the heading (the design's "Join our team"). */}
        {page && look.list === 'rows' && (
          <Heading level={2} className="mb-8">
            {t('careers.openRoles')}
          </Heading>
        )}

        {jobs.length === 0 ? (
          <p className="m-0 max-w-[62ch] text-[17px] text-ash">{t('careers.none')}</p>
        ) : (
          <>
            {look.list === 'cards' ? (
              <ul className="he-jobcards he-swipe-track" style={{ '--cols': look.columns } as React.CSSProperties}>
                {jobs.map((job) => (
                  <JobCardItem key={job.id} job={job} locale={locale} t={t} look={look} />
                ))}
              </ul>
            ) : (
              <ul className="he-jobs">
                {jobs.map((job) => (
                  <JobRow key={job.id} job={job} locale={locale} t={t} />
                ))}
              </ul>
            )}
            {open.length === 0 && <p className="mt-8 max-w-[62ch] text-[15px] text-smoke">{t('careers.allFilled')}</p>}
          </>
        )}
      </Section>

      <JsonLd
        data={graph([
          webPage({
            path: CAREERS_PATH,
            name: page?.title ?? t('careers.title'),
            description,
            breadcrumbId: crumbs['@id'] as string,
          }),
          /* An ItemList of the adverts, not a list of JobPostings: each
             advert carries its own JobPosting on its own page, and repeating
             them here would have two URLs claiming the same vacancy. */
          itemList({
            path: CAREERS_PATH,
            name: t('careers.openRoles'),
            items: open.map((job) => ({ name: job.title, path: `${CAREERS_PATH}/${job.slug}` })),
          }),
          crumbs,
        ])}
      />
    </>
  );
}
