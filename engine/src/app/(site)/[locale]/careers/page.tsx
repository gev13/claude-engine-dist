import type { Metadata } from 'next';
import Link from 'next/link';
import { BlockRenderer } from '@/components/blocks/Renderer';
import { JsonLd } from '@/components/site/JsonLd';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Heading } from '@/components/ui/Heading';
import { Section } from '@/components/ui/Section';
import { breadcrumbs, graph, itemList, webPage } from '@/lib/seo/jsonld';
import { buildMetadata } from '@/lib/seo/metadata';
import { CAREERS_PATH, JOB_META } from '@/lib/careers';
import { formatRelative, hasPassed } from '@/lib/relativeDate';
import { localeConfig, otherLocales, type Locale } from '@/lib/locales';
import { cn } from '@/lib/utils';
import { getPageByPath } from '@/server/content/pages';
import { listJobs, type JobCard } from '@/server/content/jobs';
import { getSiteSettings } from '@/server/content/siteSettings';

export const revalidate = 300;

type Params = { locale: string };

function fallbackDescription(siteName: string) {
  return `Open roles at ${siteName}.`;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
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
       configured languages, not a lookup. */
    translations: otherLocales(locale as Locale, config).map((other) => ({
      locale: other,
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

function JobRow({ job, locale }: { job: JobCard; locale: string }) {
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
        <span className={cn('he-job-tag', job.isOpen && 'is-open')}>{job.isOpen ? 'Open' : 'Closed'}</span>
        {job.isOpen && closing && (
          <span className="he-job-card__when">Closes {formatRelative(new Date(job.deadline!), locale)}</span>
        )}
        {job.isOpen && !closing && job.postedAt && (
          <span className="he-job-card__when">Posted {formatRelative(new Date(job.postedAt), locale)}</span>
        )}
      </div>
    </li>
  );
}

export default async function CareersIndex({ params }: { params: Promise<Params> }) {
  const { locale } = await params;
  const [page, jobs, settings] = await Promise.all([
    getPageByPath(CAREERS_PATH, locale),
    listJobs({ locale: locale as Locale, limit: 96 }),
    getSiteSettings(),
  ]);

  const description = page?.excerpt || fallbackDescription(settings.name);
  const open = jobs.filter((job) => job.isOpen);

  const crumbs = breadcrumbs([
    { name: 'Home', path: '/' },
    { name: page?.title ?? 'Careers', path: CAREERS_PATH },
  ]);

  /* A `/careers` page in the admin owns the top of this screen — its own
     heading, copy, whatever blocks it carries. Without one the route still
     works and still has exactly one h1, because a careers section with no
     landing page written for it is the normal starting state. */
  return (
    <>
      {page ? (
        <BlockRenderer blocks={page.blocks} />
      ) : (
        <Section size="lg">
          <Eyebrow>Careers</Eyebrow>
          <Heading level={1} className="max-w-[18ch]">
            Open roles
          </Heading>
          <p className="mt-6 max-w-[62ch] text-[19px] text-ash">{description}</p>
        </Section>
      )}

      <Section tone={page ? 'raised' : 'base'} size="lg">
        {/* The page's own blocks may already have used h1, so this is h2 when
            one exists and the listing's own heading otherwise. */}
        {page && (
          <Heading level={2} className="mb-8">
            Open roles
          </Heading>
        )}

        {jobs.length === 0 ? (
          <p className="m-0 max-w-[62ch] text-[17px] text-ash">
            There are no open roles just now. It is worth looking again — or writing to us anyway.
          </p>
        ) : (
          <>
            <ul className="he-jobs">
              {jobs.map((job) => (
                <JobRow key={job.id} job={job} locale={locale} />
              ))}
            </ul>
            {open.length === 0 && (
              <p className="mt-8 max-w-[62ch] text-[15px] text-smoke">
                Every role above has been filled. They are left here so the pages people have bookmarked still work.
              </p>
            )}
          </>
        )}
      </Section>

      <JsonLd
        data={graph([
          webPage({
            path: CAREERS_PATH,
            name: page?.title ?? 'Careers',
            description,
            breadcrumbId: crumbs['@id'] as string,
          }),
          /* An ItemList of the adverts, not a list of JobPostings: each
             advert carries its own JobPosting on its own page, and repeating
             them here would have two URLs claiming the same vacancy. */
          itemList({
            path: CAREERS_PATH,
            name: 'Open roles',
            items: open.map((job) => ({ name: job.title, path: `${CAREERS_PATH}/${job.slug}` })),
          }),
          crumbs,
        ])}
      />
    </>
  );
}
