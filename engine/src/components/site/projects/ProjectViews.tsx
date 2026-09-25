import Link from '@/components/ui/SiteLink';
import { BlockRenderer } from '@/components/blocks/Renderer';
import { BgVideo } from '@/components/blocks/library/media';
import { ProjectsBlock } from '@/components/blocks/library/showcase';
import { JsonLd } from '@/components/site/JsonLd';
import { Pagination } from '@/components/site/Pagination';
import { Heading } from '@/components/ui/Heading';
import { Prose } from '@/components/ui/Prose';
import { Section } from '@/components/ui/Section';
import { paginationLabels, PagingLinks } from '@/components/site/blog/BlogViews';
import { blockSchemas, type AnyBlock } from '@/lib/blocks';
import { safeCss } from '@/lib/customCode';
import { SITE_URL } from '@/lib/env';
import type { Locale } from '@/lib/locales';
import { messageReader } from '@/lib/messages';
import { absoluteWithSlash, pagedPath, projectPath, projectTermPath, type Permalinks } from '@/lib/permalinks';
import { projectItem, type ProjectTemplate } from '@/lib/projects';
import { breadcrumbs, graph, itemList, webPage, ORG_ID, type Crumb } from '@/lib/seo/jsonld';
import { isColor } from '@/lib/theme';
import { cn, isoDate } from '@/lib/utils';
import { getMessages } from '@/server/content/messages';
import { listProjectCards, type ProjectDetail, type ProjectTermRef } from '@/server/content/projects';
import type { Paging } from '@/server/content/resolve';
import { pageTrail } from '@/server/content/trail';
import { SiteImg } from '@/components/ui/SiteImg';

/* ═══════════════════════════════════════════════════════════════════════════
   A project's page, and a project category's or tag's archive (2.14)
   ───────────────────────────────────────────────────────────────────────────
   The layout is the site's (Projects → Page template); the content is the
   project's. In order: the header the template picks, the project's own
   blocks, "More projects" from the same category, then the template's call
   to action. The preview renders this same component.
   ═══════════════════════════════════════════════════════════════════════════ */

type T = ReturnType<typeof messageReader>;

/** The hero: a picture, or a video that plays muted and stops for anybody who asked for less motion. */
function HeroMedia({ project, className }: { project: ProjectDetail; className?: string }) {
  const media = project.hero ?? (project.coverUrl ? { url: project.coverUrl, mimeType: 'image/', width: null, height: null } : null);
  if (!media) return null;
  if (media.mimeType.startsWith('video/')) {
    return (
      <div className={cn('he-prj-hero__media', className)}>
        <BgVideo src={media.url} poster={project.coverUrl ?? undefined} className="he-fill" />
      </div>
    );
  }
  return (
    <div className={cn('he-prj-hero__media', className)}>
      <SiteImg
        src={media.url}
        alt=""
        className="he-fill"
        fetchPriority="high"
        priority
        {...(media.width && media.height ? { width: media.width, height: media.height } : {})}
      />
    </div>
  );
}

function Details({ project, t }: { project: ProjectDetail; t: T }) {
  const rows = [
    project.client && { label: t('project.client'), value: project.client },
    project.year && { label: t('project.year'), value: project.year },
  ].filter(Boolean) as { label: string; value: string }[];
  const live = project.url && /^https?:\/\//i.test(project.url);
  if (rows.length === 0 && !live) return null;
  return (
    <div className="he-prj-details">
      {rows.length > 0 && (
        <dl className="he-prj-details__list">
          {rows.map((row) => (
            <div key={row.label}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {live && (
        <a href={project.url} target="_blank" rel="noopener noreferrer" className="he-prj-details__link">
          {t('project.visit')} ↗
        </a>
      )}
    </div>
  );
}

export async function ProjectArticle({
  project,
  template,
  permalinks,
  locale,
  preview = false,
}: {
  project: ProjectDetail;
  template: ProjectTemplate;
  permalinks: Permalinks;
  locale?: Locale;
  preview?: boolean;
}) {
  const t = messageReader(await getMessages(locale));
  const path = projectPath(permalinks, project.slug);
  const trail: Crumb[] = preview ? [] : await pageTrail(path, project.title);
  const primary = project.categories.find((c) => c.primary) ?? project.categories[0];

  /* "More projects": the same primary category, topped up with the newest
     when that category has too few. */
  let more: Awaited<ReturnType<typeof listProjectCards>> = [];
  if (template.more.enabled && !project.options.hideMore && !preview) {
    const count = template.more.count;
    if (template.more.source === 'category' && primary) {
      more = await listProjectCards({ categories: [primary.slug], excludeId: project.id, order: 'newest', limit: count, locale }, permalinks);
    }
    if (more.length < count) {
      const seen = new Set([project.id, ...more.map((card) => card.id)]);
      const latest = await listProjectCards({ order: 'newest', limit: count + seen.size, locale }, permalinks);
      more = [...more, ...latest.filter((card) => !seen.has(card.id))].slice(0, count);
    }
  }
  const moreBlock =
    more.length > 0
      ? blockSchemas.projects.safeParse({
          title: template.more.title,
          titleAs: 'h2',
          layout: template.more.layout === 'carousel' ? 'carousel' : 'classic',
          columns: Math.min(Math.max(more.length, 2), 3),
          filter: false,
          source: 'collection',
        })
      : null;

  const chips = template.showCategories && project.categories.length > 0 && (
    <ul className="he-prj-chips">
      {project.categories.map((category) => (
        <li key={category.slug}>
          <Link href={projectTermPath(permalinks, 'category', category.slug)}>{category.name}</Link>
        </li>
      ))}
    </ul>
  );
  const heading = (
    <>
      {chips}
      <Heading level={1} className="max-w-[20ch]">
        {project.title}
      </Heading>
      {project.intro && <Prose html={project.intro} className="he-prj-intro mt-6 max-w-[62ch]" />}
      {template.showDetails && <Details project={project} t={t} />}
    </>
  );

  const background = project.options.background && isColor(project.options.background) ? project.options.background : null;
  const cta = (template.cta ?? []) as AnyBlock[];

  return (
    <>
      <article className={cn('he-prj', `is-${template.header}`)}>
        {template.header === 'fullBleed' && (
          <header className="he-prj-hero he-bleed-top">
            <HeroMedia project={project} />
          </header>
        )}
        <Section size="lg">
          {template.header === 'split' ? (
            <div className="he-prj-split">
              <div>{heading}</div>
              <HeroMedia project={project} className="is-framed" />
            </div>
          ) : (
            heading
          )}
        </Section>
        <BlockRenderer blocks={project.blocks} trail={trail} currentProjectId={project.id} locale={locale} />
      </article>

      {moreBlock?.success && <ProjectsBlock {...moreBlock.data} items={more.map(projectItem)} />}
      {cta.length > 0 && <BlockRenderer blocks={cta} trail={trail} currentProjectId={project.id} locale={locale} />}

      {!preview && (
        <JsonLd
          data={graph([
            webPage({ path, name: project.title, description: project.excerpt, modified: isoDate(project.updatedAt), breadcrumbId: trail.length ? `${absoluteWithSlash(SITE_URL, path)}#breadcrumb` : undefined }),
            {
              '@type': 'CreativeWork',
              '@id': `${absoluteWithSlash(SITE_URL, path)}#work`,
              name: project.title,
              headline: project.title,
              description: project.excerpt || project.summary,
              url: absoluteWithSlash(SITE_URL, path),
              mainEntityOfPage: { '@id': `${absoluteWithSlash(SITE_URL, path)}#webpage` },
              creator: { '@id': ORG_ID },
              publisher: { '@id': ORG_ID },
              ...(project.publishedAt ? { datePublished: isoDate(project.publishedAt) } : {}),
              dateModified: isoDate(project.updatedAt),
              ...(project.coverUrl ? { image: [project.coverUrl.startsWith('http') ? project.coverUrl : `${SITE_URL}${project.coverUrl}`] } : {}),
              ...(project.categories.length ? { about: project.categories.map((c) => ({ '@type': 'Thing', name: c.name })) } : {}),
              ...(project.tags.length ? { keywords: project.tags.map((tag) => tag.name).join(', ') } : {}),
            },
            trail.length ? breadcrumbs(trail) : null,
          ])}
        />
      )}
      {background && (
        // One project's own page colour — a black page on a charcoal site. Checked as a colour twice.
        <style id="he-project-bg" dangerouslySetInnerHTML={{ __html: `body,.he-site{background-color:${background}}` }} />
      )}
      {project.customCss && <style id="he-page-css" dangerouslySetInnerHTML={{ __html: safeCss(project.customCss) }} />}
    </>
  );
}

/* ── A category's or a tag's archive ────────────────────────────────────── */

export async function ProjectArchiveView({
  term,
  paging,
  template,
  permalinks,
  locale,
}: {
  term: ProjectTermRef;
  paging: Paging;
  template: ProjectTemplate;
  permalinks: Permalinks;
  locale: Locale;
}) {
  const t = messageReader(await getMessages(locale));
  const cards = await listProjectCards(
    {
      ...(term.taxonomy === 'category' ? { categories: [term.slug] } : { tags: [term.slug] }),
      order: 'manual',
      limit: paging.perPage,
      offset: (paging.number - 1) * paging.perPage,
      locale,
    },
    permalinks,
  );
  const base = projectTermPath(permalinks, term.taxonomy, term.slug);
  const path = pagedPath(base, paging.number, permalinks);
  const trail: Crumb[] = [
    { name: t('chrome.home'), path: '/' },
    { name: term.name, path: base },
  ];
  const crumbs = breadcrumbs(trail);
  const grid = blockSchemas.projects.safeParse({
    layout: template.archive.layout,
    columns: template.archive.columns,
    filter: false,
    source: 'collection',
  });

  return (
    <>
      <Section size="lg">
        <Heading level={1} className="max-w-[20ch]">
          {term.name}
        </Heading>
        {term.description && <p className="mt-6 max-w-[62ch] text-[17px] text-ash">{term.description}</p>}
      </Section>
      {grid.success && <ProjectsBlock {...grid.data} items={cards.map(projectItem)} />}
      <Section size="sm" rule={false}>
        <Pagination
          current={paging.number}
          total={paging.total}
          href={(n) => pagedPath(base, n, permalinks)}
          labels={paginationLabels(t)}
        />
      </Section>
      <PagingLinks paging={paging} permalinks={permalinks} />
      <JsonLd
        data={graph([
          webPage({ path, name: term.name, description: term.description, breadcrumbId: crumbs['@id'] as string }),
          itemList({ path, name: term.name, items: cards.map((card) => ({ name: card.title, path: card.href })) }),
          crumbs,
        ])}
      />
    </>
  );
}
