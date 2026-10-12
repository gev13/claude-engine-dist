import { getPermalinks } from '@/server/routing/config';
import type { Metadata } from 'next';
import Link from '@/components/ui/SiteLink';
import { ApplicationForm } from '@/components/site/ApplicationForm';
import { BlockRenderer } from '@/components/blocks/Renderer';
import { JsonLd } from '@/components/site/JsonLd';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Heading } from '@/components/ui/Heading';
import { Prose } from '@/components/ui/Prose';
import { Section } from '@/components/ui/Section';
import { breadcrumbs, graph, jobPostingNode, webPage } from '@/lib/seo/jsonld';
import { buildMetadata } from '@/lib/seo/metadata';
import { CAREERS_PATH, JOB_META } from '@/lib/careers';
import { formatAbsolute, formatAmount, formatRelative, hasPassed } from '@/lib/relativeDate';
import { resolveCareersLook } from '@/lib/careersLook';
import type { InfoIconName } from '@/lib/infoIcons';
import { messageReader } from '@/lib/messages';
import { InfoIcon } from '@/components/site/InfoIcon';
import { SiteImg } from '@/components/ui/SiteImg';
import { getMessages } from '@/server/content/messages';
import { getTheme } from '@/server/content/theme';
import { cn, formatDate, isoDate } from '@/lib/utils';
import type { Locale } from '@/lib/locales';
import { handleMiss } from '@/server/content/miss';
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
  // The trailing-slash form every URL below is written in is a setting; load it first.
  await getPermalinks();
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


export default async function JobPage({ params }: { params: Promise<Params> }) {
  // The trailing-slash form every URL below is written in is a setting; load it first.
  await getPermalinks();
  const { locale, slug } = await params;
  const job = await getJob(slug, locale as Locale);
  if (!job) return handleMiss(`${CAREERS_PATH}/${slug}`);

  const [settings, others, careersPage, messages, theme, privacyPage] = await Promise.all([
    getSiteSettings(),
    listJobs({ locale: locale as Locale, limit: 6, openOnly: true }),
    getPageByPath(CAREERS_PATH, locale),
    getMessages(locale as Locale),
    getTheme(),
    getPageByPath('/privacy', locale),
  ]);
  const t = messageReader(messages);
  const look = resolveCareersLook(theme.careers);

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
  // 3.29 — each detail's label and icon, in the page's language.
  const META_ICONS: Record<string, InfoIconName> = { location: 'pin', department: 'people', contractType: 'document', workingTime: 'clock', seniority: 'briefcase', workweek: 'calendar' };
  const metaLabel = (key: string) => t(`careers.meta.${key}` as Parameters<typeof t>[0]);

  const path = `${CAREERS_PATH}/${job.slug}`;
  const careersName = careersPage?.title ?? t('careers.title');
  const crumbs = breadcrumbs([
    { name: t('chrome.home'), path: '/' },
    { name: careersName, path: CAREERS_PATH },
    { name: job.title, path },
  ]);

  const sections: [string, string][] = [
    [t('careers.about'), job.description],
    [t('careers.responsibilities'), job.responsibilities],
    [t('careers.offer'), job.benefits],
  ];
  const privacyPath = privacyPage ? '/privacy' : null;
  const applyForm = (
    <ApplicationForm
      jobId={job.id}
      jobTitle={job.title}
      privacyPath={privacyPath}
      placeholders={look.form === 'placeholders'}
      dropZone={look.dropZone}
      doneLinks={look.doneButtons ? { home: '/', careers: CAREERS_PATH } : undefined}
    />
  );
  const closedNote = (
    /* The page stays up and says so. Somebody following a months-old link
       gets an answer instead of a 404, and a pointer to what is open now. */
    <div className="he-job__closed">
      <p>
        {t('careers.filledText', { title: job.title })}
        {deadlineGone && job.deadline ? ` ${t('careers.deadlineWas', { date: formatDate(job.deadline) })}` : ''}
      </p>
      <p>
        <Link href={CAREERS_PATH} className="he-link">
          {t('careers.seeOpen')}
        </Link>
        .
      </p>
    </div>
  );
  /* 3.29 — the details with an icon each, and the posted date and deadline as
     the date with how long ago or how long is left. */
  const metaGrid = meta.length > 0 && (
    <dl className={cn('he-job__meta', look.icons && 'has-icons')}>
      {meta.map(([key]) => (
        <div key={key}>
          {look.icons && <InfoIcon name={META_ICONS[key] ?? 'document'} className="he-job__icon" />}
          <dt className={look.icons ? 'sr-only' : undefined}>{metaLabel(key)}</dt>
          <dd>{values[key]}</dd>
        </div>
      ))}
    </dl>
  );
  const left = job.deadline ? formatAmount(new Date(job.deadline), locale) : '';
  const dates = (job.postedAt || job.deadline) && (
    <dl className="he-job__dates">
      {job.postedAt && (
        <div>
          <dt>{t('careers.postedLabel')}</dt>
          <dd>
            {formatAbsolute(new Date(job.postedAt), locale)} <span className="he-job__ago">({formatRelative(new Date(job.postedAt), locale)})</span>
          </dd>
        </div>
      )}
      {job.deadline && (
        <div>
          <dt>{t('careers.deadlineLabel')}</dt>
          <dd>
            {formatAbsolute(new Date(job.deadline), locale)}{' '}
            <span className="he-job__ago">({deadlineGone || !left ? t('careers.closed') : t('careers.left', { time: left })})</span>
          </dd>
        </div>
      )}
    </dl>
  );

  // 3.29 — the saved block shown after every advert (Appearance → Careers).
  const after = look.afterSavedBlock ? (
    <BlockRenderer blocks={[{ id: 'careers-after', type: 'savedBlock', props: { savedBlockId: look.afterSavedBlock } }]} locale={locale} />
  ) : null;

  const jsonLd = (
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
  );

  if (look.page === 'aside') {
    return (
      <>
        <article className="he-job is-aside">
          <Section size="lg">
            <div className="he-job-aside">
              <div className="he-job-aside__head">
                <Heading level={1} className="he-job-aside__title">
                  {job.title}
                </Heading>
                {job.coverUrl && (
                  <div className="he-job-aside__cover">
                    <SiteImg src={job.coverUrl} alt="" className="he-fill" sizes="half" priority />
                  </div>
                )}
              </div>
              <div className="he-job-aside__panel">
                {metaGrid}
                {sections
                  .filter(([, html]) => html.trim() !== '')
                  .map(([heading, html]) => (
                    <div key={heading} className="he-job__section">
                      <Heading level={2}>{heading}</Heading>
                      <Prose html={html} />
                    </div>
                  ))}
                {dates}
                <div className="he-job-aside__apply">
                  <Heading level={2} className="he-job-aside__applytitle">
                    {job.isOpen ? t('careers.apply') : t('careers.filled')}
                  </Heading>
                  {job.isOpen ? applyForm : closedNote}
                </div>
              </div>
            </div>
          </Section>
        </article>
        {after}
        {jsonLd}
      </>
    );
  }

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
              {meta.map(([key]) => (
                <div key={key}>
                  <dt>{metaLabel(key)}</dt>
                  <dd>{values[key]}</dd>
                </div>
              ))}
            </dl>
          )}

          <p className="mt-6 text-[length:var(--he-label-size,11px)] tracking-[var(--he-label-tracking,0.12em)] text-[color:var(--he-label-color,var(--color-smoke))] he-lbl">
            {job.postedAt && (
              <span title={formatDate(job.postedAt)}>{t('careers.posted', { when: formatRelative(new Date(job.postedAt), locale) })}</span>
            )}
            {job.deadline && (
              <span className="ml-5" title={formatDate(job.deadline)}>
                {t(deadlineGone ? 'careers.closedWhen' : 'careers.closes', { when: formatRelative(new Date(job.deadline), locale) })}
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
            {job.isOpen ? t('careers.apply') : t('careers.filled')}
          </Heading>

          {job.isOpen ? <div className="he-fb__box">{applyForm}</div> : closedNote}
        </Section>
      </article>
      {after}

      {related.length > 0 && (
        <Section size="lg">
          <Heading level={2} className="mb-8">
            {t('careers.others')}
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

      {jsonLd}
    </>
  );
}
