import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect, redirect } from 'next/navigation';
import { ApplicationForm } from '@/components/site/ApplicationForm';
import { JsonLd } from '@/components/site/JsonLd';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Heading } from '@/components/ui/Heading';
import { Prose } from '@/components/ui/Prose';
import { Section } from '@/components/ui/Section';
import { breadcrumbs, graph, jobPostingNode, webPage } from '@/lib/seo/jsonld';
import { buildMetadata } from '@/lib/seo/metadata';
import { CAREERS_PATH, JOB_META } from '@/lib/careers';
import { formatRelative, hasPassed } from '@/lib/relativeDate';
import { formatDate, isoDate } from '@/lib/utils';
import type { Locale } from '@/lib/locales';
import { findRedirect, recordNotFound } from '@/server/content/redirects';
import { allPublishedJobSlugs, getJob, getJobTranslations, listJobs } from '@/server/content/jobs';
import { getPageByPath } from '@/server/content/pages';
import { getSiteSettings } from '@/server/content/siteSettings';

export const revalidate = 300;
export const dynamicParams = true;

type Params = { locale: string; slug: string };

export async function generateStaticParams({ params }: { params: { locale: string } }) {
  const slugs = await allPublishedJobSlugs(params.locale as Locale);
  return slugs.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { locale, slug } = await params;
  const job = await getJob(slug, locale as Locale);
  if (!job) return { title: 'Not found' };

  const [settings, translations] = await Promise.all([
    getSiteSettings(),
    getJobTranslations(job.translationGroupId),
  ]);

  return buildMetadata({
    seo: job.seo,
    title: job.title,
    description: job.excerpt,
    path: `${CAREERS_PATH}/${job.slug}`,
    locale,
    translations: translations.map((t) => ({ locale: t.locale, path: `${CAREERS_PATH}/${t.slug}` })),
    publishedTime: isoDate(job.postedAt),
    modifiedTime: isoDate(job.updatedAt),
    imageUrl: job.coverUrl,
    siteName: settings.name,
    /* A filled role stays on the site so its URL keeps working, but there is
       nothing to gain by having it in an index — and a search result that
       sends somebody to a vacancy that no longer exists is worse than no
       result. Google's own guidance for JobPosting says the same. */
    noindex: !job.isOpen,
  });
}

/** Follow a managed redirect if one exists; otherwise log the miss and 404. */
async function handleMiss(path: string): Promise<never> {
  const target = await findRedirect(path);
  if (target) {
    if (target.status === 301) permanentRedirect(target.to);
    redirect(target.to);
  }
  await recordNotFound(path);
  notFound();
}

export default async function JobPage({ params }: { params: Promise<Params> }) {
  const { locale, slug } = await params;
  const job = await getJob(slug, locale as Locale);
  if (!job) return handleMiss(`${CAREERS_PATH}/${slug}`);

  const [settings, others, careersPage] = await Promise.all([
    getSiteSettings(),
    listJobs({ locale: locale as Locale, limit: 6, openOnly: true }),
    getPageByPath(CAREERS_PATH, locale),
  ]);

  const related = others.filter((other) => other.slug !== job.slug).slice(0, 3);
  const deadlineGone = job.deadline ? hasPassed(new Date(job.deadline)) : false;

  /* The six labels, in the design's order, with the blanks left out rather
     than printed empty. */
  const values: Record<string, string> = {
    location: job.location,
    department: job.department,
    contractType: job.contractType,
    workingTime: job.workingTime,
    seniority: job.seniority,
    workweek: job.workweek,
  };
  const meta = JOB_META.filter(([key]) => (values[key] ?? '').trim() !== '');

  const path = `${CAREERS_PATH}/${job.slug}`;
  const careersName = careersPage?.title ?? 'Careers';
  const crumbs = breadcrumbs([
    { name: 'Home', path: '/' },
    { name: careersName, path: CAREERS_PATH },
    { name: job.title, path },
  ]);

  const sections: [string, string][] = [
    ['About the role', job.description],
    ['Responsibilities', job.responsibilities],
    ['What we offer', job.benefits],
  ];

  return (
    <>
      <article className="he-job">
        <Section size="lg">
          <Eyebrow>
            <Link href={CAREERS_PATH} className="hover:text-flare-soft">
              {careersName}
            </Link>
            {job.department ? ` — ${job.department}` : ''}
          </Eyebrow>
          <Heading level={1} className="max-w-[20ch]">
            {job.title}
          </Heading>
          {job.excerpt && <p className="mt-6 max-w-[62ch] text-[19px] text-ash">{job.excerpt}</p>}

          {meta.length > 0 && (
            <dl className="he-job__meta">
              {meta.map(([key, label]) => (
                <div key={key}>
                  <dt>{label}</dt>
                  <dd>{values[key]}</dd>
                </div>
              ))}
            </dl>
          )}

          <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.12em] text-smoke">
            {job.postedAt && (
              <span title={formatDate(job.postedAt)}>Posted {formatRelative(new Date(job.postedAt), locale)}</span>
            )}
            {job.deadline && (
              <span className="ml-5" title={formatDate(job.deadline)}>
                {deadlineGone ? 'Closed ' : 'Closes '}
                {formatRelative(new Date(job.deadline), locale)}
              </span>
            )}
          </p>

          {sections
            .filter(([, html]) => html.trim() !== '')
            .map(([heading, html]) => (
              <div key={heading} className="he-job__section">
                <Heading level={2}>{heading}</Heading>
                <Prose html={html} className="max-w-[72ch]" />
              </div>
            ))}
        </Section>

        <Section tone="raised" size="lg">
          <Heading level={2} className="mb-8">
            {job.isOpen ? 'Apply for this role' : 'This role has been filled'}
          </Heading>

          {job.isOpen ? (
            <div className="he-fb__box">
              <ApplicationForm
                jobId={job.id}
                jobTitle={job.title}
                privacyPath={(await getPageByPath('/privacy', locale)) ? '/privacy' : null}
              />
            </div>
          ) : (
            /* The page stays up and says so. Somebody following a months-old
               link gets an answer instead of a 404, and a pointer to what is
               open now. */
            <div className="he-job__closed">
              <p>
                {job.title} is no longer taking applications.
                {deadlineGone && job.deadline ? ` The deadline was ${formatDate(job.deadline)}.` : ''}
              </p>
              <p>
                <Link href={CAREERS_PATH} className="he-link">
                  See the roles that are open
                </Link>
                .
              </p>
            </div>
          )}
        </Section>
      </article>

      {related.length > 0 && (
        <Section size="lg">
          <Heading level={2} className="mb-8">
            Other open roles
          </Heading>
          <ul className="he-jobs">
            {related.map((other) => (
              <li key={other.id} className="he-job-card">
                <div>
                  <h3 className="he-job-card__title">
                    <Link href={`${CAREERS_PATH}/${other.slug}`}>{other.title}</Link>
                  </h3>
                  {other.excerpt && <p className="he-job-card__excerpt">{other.excerpt}</p>}
                </div>
                <div className="he-job-card__side">
                  {other.location && <span className="he-job-tag">{other.location}</span>}
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <JsonLd
        data={graph([
          webPage({
            path,
            name: job.title,
            description: job.excerpt,
            modified: isoDate(job.updatedAt),
            breadcrumbId: crumbs['@id'] as string,
          }),
          /* Only while the role is open. A search engine that indexes a
             JobPosting keeps sending people to it, so a filled role must stop
             emitting one — the same reason the page goes `noindex`. */
          job.isOpen
            ? jobPostingNode({
                path,
                title: job.title,
                description: job.excerpt || job.title,
                datePosted: isoDate(job.postedAt),
                validThrough: isoDate(job.deadline),
                location: job.location,
                contractType: job.contractType,
                department: job.department,
                organisationName: settings.name,
              })
            : null,
          crumbs,
        ])}
      />
    </>
  );
}
