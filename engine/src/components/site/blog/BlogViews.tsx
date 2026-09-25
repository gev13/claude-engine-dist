import Link from '@/components/ui/SiteLink';
import { BlockRenderer } from '@/components/blocks/Renderer';
import { BlogList } from '@/components/site/BlogList';
import { JsonLd } from '@/components/site/JsonLd';
import { Pagination, resultRange, type PaginationLabels } from '@/components/site/Pagination';
import { Card, CardGrid } from '@/components/ui/Card';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Heading } from '@/components/ui/Heading';
import { Section } from '@/components/ui/Section';
import type { AnyBlock } from '@/lib/blocks';
import { resolveBlog, type ResolvedBlog } from '@/lib/blog';
import type { ServerList } from '@/lib/listing';
import type { Locale } from '@/lib/locales';
import { messageReader } from '@/lib/messages';
import { absoluteWithSlash, blogIndexPath, categoryPath, feedPath, pagedPath, researchPath, type Permalinks } from '@/lib/permalinks';
import { SITE_URL } from '@/lib/env';
import { blogNode, breadcrumbs, graph, itemList, webPage, type Crumb } from '@/lib/seo/jsonld';
import { site } from '@/lib/site';
import { formatDate } from '@/lib/utils';
import type { CategoryRef } from '@/server/content/categories';
import { listCategories } from '@/server/content/categories';
import { getMessages } from '@/server/content/messages';
import type { PublicPage } from '@/server/content/pages';
import { countPosts, listPosts, postUrl, type PostListItem } from '@/server/content/posts';
import { getBlogArchive } from '@/server/content/blogArchive';
import { BreadcrumbsBlock } from '@/components/blocks/library/widgets';
import { SiteImg } from '@/components/ui/SiteImg';
import type { Paging } from '@/server/content/resolve';
import { getSiteSettings } from '@/server/content/siteSettings';
import { getTheme } from '@/server/content/theme';
import { searchPosts } from '@/server/search';
import { BlogSearch } from './BlogSearch';
import { ProjectsBlock } from '@/components/blocks/library/showcase';
import { blockSchemas } from '@/lib/blocks';
import { projectItem, type ProjectCard } from '@/lib/projects';
import { searchProjectCards } from '@/server/content/projects';
import { getProjectTemplate } from '@/server/content/projectTemplate';

/** Projects a search matched, as the projects block draws them. */
function ProjectsBlockResults({ items, title }: { items: ProjectCard[]; title: string }) {
  const block = blockSchemas.projects.safeParse({ title, titleAs: 'h2', layout: 'classic', columns: 3, filter: false, source: 'collection' });
  return block.success ? <ProjectsBlock {...block.data} items={items.map(projectItem)} /> : null;
}

/* ═══════════════════════════════════════════════════════════════════════════
   The blog's own pages
   ───────────────────────────────────────────────────────────────────────────
   These were four routes, each with `/blog` written into it. They are views
   now, rendered by whichever route resolved the address — the catch-all for
   the index, a category, research and their `/page/N`; the search route for
   `?q=`. Every address in them comes from the permalinks, so the same
   component renders `/blog/category/x` on one site and `/category/x/` on
   another.
   ═══════════════════════════════════════════════════════════════════════════ */

type T = ReturnType<typeof messageReader>;

export function paginationLabels(t: T): PaginationLabels {
  return {
    nav: t('archive.pagination'),
    previous: t('archive.previousPage'),
    next: t('archive.nextPage'),
    page: (n) => t('archive.page', { n }),
    loadMore: t('archive.loadMore'),
    loading: t('archive.loading'),
  };
}

/** The list's id, which "Load more" finds again in the next page's HTML. */
export const ARCHIVE_LIST_ID = 'he-archive-list';

/**
 * `/page/N` in the head, so a crawler walks an archive in order. React hoists
 * a `<link>` rendered anywhere into `<head>`; absolute and in the site's
 * trailing-slash form, like the canonical beside it.
 */
export function PagingLinks({ paging, permalinks }: { paging: Paging; permalinks: Permalinks }) {
  const href = (n: number) => absoluteWithSlash(SITE_URL, pagedPath(paging.base, n, permalinks));
  return (
    <>
      {paging.number > 1 && <link rel="prev" href={href(paging.number - 1)} />}
      {paging.number < paging.total && <link rel="next" href={href(paging.number + 1)} />}
    </>
  );
}

/**
 * The chips under the blog's heading: All, Research, then each category —
 * or, as a site chooses (2.18), one "Categories" menu. The Research chip
 * shows only where there is research, unless the site says always or never.
 */
async function CategoryBar({ locale, permalinks, t, blog }: { locale: Locale; permalinks: Permalinks; t: T; blog: ResolvedBlog }) {
  const categories = await listCategories(locale);
  if (categories.length === 0) return null;
  const research =
    blog.chipResearch === 'show' || (blog.chipResearch === 'auto' && (await countPosts({ kind: 'research', locale })) > 0);

  if (blog.filterStyle === 'dropdown') {
    return (
      <Section size="sm">
        <nav aria-label={t('blog.categories')} className="he-catbar">
          {blog.chipAll && (
            <Link href={blogIndexPath(permalinks)} aria-current="page" className="he-catbar__all">
              {t('blog.all')}
            </Link>
          )}
          <details className="he-catmenu">
            <summary className="he-catmenu__button">
              {t('blog.categories')}
              <span aria-hidden="true">▾</span>
            </summary>
            <ul className="he-catmenu__list">
              {research && (
                <li>
                  <Link href={researchPath(permalinks)}>{t('blog.research')}</Link>
                </li>
              )}
              {categories.map((c) => (
                <li key={c.slug}>
                  <Link href={categoryPath(permalinks, c.slug)}>{c.name}</Link>
                </li>
              ))}
            </ul>
          </details>
        </nav>
      </Section>
    );
  }

  return (
    <Section size="sm">
      <nav aria-label={t('blog.categories')} className="flex flex-wrap items-center gap-2">
        <span className="label-mono mr-2">{t('blog.browse')}</span>
        {blog.chipAll && (
          <Link
            href={blogIndexPath(permalinks)}
            aria-current="page"
            className="he-chip border-2 border-flare bg-flare px-4 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-bone"
          >
            {t('blog.all')}
          </Link>
        )}
        {research && (
          <Link
            href={researchPath(permalinks)}
            className="he-chip border-2 border-hairline px-4 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-ash transition-colors hover:border-rule hover:text-bone"
          >
            {t('blog.research')}
          </Link>
        )}
        {categories.map((c) => (
          <Link
            key={c.slug}
            href={categoryPath(permalinks, c.slug)}
            className="he-chip border-2 border-hairline px-4 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-ash transition-colors hover:border-rule hover:text-bone"
          >
            {c.name}
          </Link>
        ))}
      </nav>
    </Section>
  );
}

/** The feed a reader can subscribe to, announced in the head (2.18). React hoists a `<link>` there. */
function FeedLink({ href, title }: { href: string | null; title: string }) {
  return href ? <link rel="alternate" type="application/rss+xml" title={title} href={absoluteWithSlash(SITE_URL, href)} /> : null;
}

/** Home › Blog › Category above an archive's title (2.18), from the same trail the structured data has. */
function ArchiveCrumbs({ trail }: { trail: Crumb[] }) {
  const props = blockSchemas.breadcrumbs.safeParse({ source: 'page' });
  return props.success ? (
    <div className="he-arch-crumbs">
      <BreadcrumbsBlock {...props.data} trail={trail} />
    </div>
  ) : null;
}

/** "Showing 1–12 of 110 results", when the site asks for it. */
function ResultCount({ paging, t }: { paging: Paging; t: T }) {
  const range = resultRange(paging.number, paging.perPage, paging.count);
  return <p className="he-result-count label-mono mb-8">{t('archive.resultCount', range)}</p>;
}

/* ── The blog index ─────────────────────────────────────────────────────── */

export async function BlogIndexView({
  page,
  paging,
  list,
  locale,
  permalinks,
  query,
}: {
  page: PublicPage | null;
  paging: Paging;
  list?: ServerList;
  locale: Locale;
  permalinks: Permalinks;
  /** Set on the search route; the index itself is never dynamic. */
  query?: string;
}) {
  const [settings, theme, messages] = await Promise.all([getSiteSettings(), getTheme(), getMessages(locale)]);
  const t = messageReader(messages);
  const blog = resolveBlog(theme.blog);
  const indexPath = blogIndexPath(permalinks);
  const description = page?.excerpt || t('blog.indexIntro', { site: settings.name });
  const trail: Crumb[] = [
    { name: t('chrome.home'), path: '/' },
    { name: site.blogLabel, path: indexPath },
  ];
  const crumbs = breadcrumbs(trail);
  const blocks = (page?.blocks ?? []) as AnyBlock[];
  const [first, ...rest] = blocks;

  /* A site with no page at the blog's address still has a blog. It gets a
     plain heading and the posts, so the route never renders without an h1 or
     a list. */
  const latest =
    !page && !query ? await listPosts({ limit: paging.perPage, offset: (paging.number - 1) * paging.perPage, locale }) : [];
  const results = query ? await searchPosts(query, 24) : [];
  // Projects join the results when Projects → Page template says they belong in search (2.14).
  const projectResults =
    query && (await getProjectTemplate(locale)).inSearch ? await searchProjectCards(query, permalinks, 12) : [];

  return (
    <>
      {first ? (
        <BlockRenderer blocks={[first]} trail={trail} locale={locale} />
      ) : (
        <Section size="lg">
          {blog.archiveBreadcrumbs && <ArchiveCrumbs trail={trail} />}
          <Heading level={1} className="max-w-[18ch]">
            {site.blogLabel}
          </Heading>
          <p className="mt-6 max-w-[62ch] text-[17px] text-ash">{description}</p>
        </Section>
      )}

      <CategoryBar locale={locale} permalinks={permalinks} t={t} blog={blog} />

      <Section size="sm" rule={!query}>
        <BlogSearch
          initialQuery={query ?? ''}
          action={indexPath}
          labels={{
            label: t('chrome.search'),
            placeholder: t('blog.searchArticles'),
            submit: t('chrome.search'),
            clear: t('blog.clear'),
          }}
        />
      </Section>

      {query ? (
        <>
          {projectResults.length > 0 && (
            <ProjectsBlockResults items={projectResults} title={t('project.projects')} />
          )}
          <SearchResults query={query} results={results} permalinks={permalinks} t={t} />
        </>
      ) : page ? (
        <BlockRenderer
          blocks={rest}
          trail={trail}
          paging={list ? { blockId: list.blockId, ...paging } : undefined}
          locale={locale}
        />
      ) : (
        <Section size="lg">
          {latest.length === 0 ? (
            <p className="m-0 text-[16px] text-smoke">{t('blog.nothingYet')}</p>
          ) : (
            <>
              {blog.resultCount && <ResultCount paging={paging} t={t} />}
              <BlogList
                posts={latest}
                blog={blog}
                fallbackEyebrow={site.blogLabel}
                permalinks={permalinks}
                listId={paging.total > 1 ? ARCHIVE_LIST_ID : undefined}
                labels={{ research: t('blog.research'), article: t('blog.article'), minRead: t('blog.minRead'), readMore: t('blog.readMore') }}
              />
              <Pagination
                current={paging.number}
                total={paging.total}
                href={(n) => blogIndexPath(permalinks, n)}
                style={blog.archivePager}
                labels={paginationLabels(t)}
                listId={ARCHIVE_LIST_ID}
              />
            </>
          )}
        </Section>
      )}

      {!query && <PagingLinks paging={paging} permalinks={permalinks} />}
      <FeedLink href={feedPath(permalinks)} title={site.blogLabel} />
      <JsonLd
        data={graph([
          webPage({
            path: pagedPath(indexPath, paging.number, permalinks),
            name: page?.seo.title ?? site.blogLabel,
            description,
            breadcrumbId: crumbs['@id'] as string,
          }),
          blogNode({ path: indexPath, name: site.blogLabel, description }),
          crumbs,
        ])}
      />
    </>
  );
}

function SearchResults({
  query,
  results,
  permalinks,
  t,
}: {
  query: string;
  results: Awaited<ReturnType<typeof searchPosts>>;
  permalinks: Permalinks;
  t: T;
}) {
  return (
    <Section size="lg">
      <p className="label-mono mb-8">
        {results.length === 0
          ? t('blog.nothingMatches', { query })
          : results.length === 1
            ? t('blog.oneResultFor', { query })
            : t('blog.resultsFor', { count: results.length, query })}
      </p>
      {results.length > 0 && (
        <CardGrid cols={3}>
          {results.map((p) => (
            <Card
              key={p.id}
              eyebrow={
                <>
                  {p.kind === 'research' ? t('blog.research') : (p.categoryName ?? t('blog.article'))}
                  {p.publishedAt ? ` — ${formatDate(p.publishedAt)}` : ''}
                </>
              }
              title={p.title}
              href={postUrl(permalinks, p)}
            >
              {p.excerpt}
            </Card>
          ))}
        </CardGrid>
      )}
    </Section>
  );
}

/* ── A category, and research ───────────────────────────────────────────── */

export async function ArchiveView({
  kind,
  category,
  paging,
  locale,
  permalinks,
}: {
  kind: 'category' | 'research';
  category?: CategoryRef;
  paging: Paging;
  locale: Locale;
  permalinks: Permalinks;
}) {
  const [settings, theme, messages, template] = await Promise.all([getSiteSettings(), getTheme(), getMessages(locale), getBlogArchive(locale)]);
  const t = messageReader(messages);
  const blog = resolveBlog(theme.blog);
  const offset = (paging.number - 1) * paging.perPage;

  const posts: PostListItem[] =
    kind === 'category' && category
      ? await listPosts({ categorySlug: category.slug, limit: paging.perPage, offset, locale })
      : await listPosts({ kind: 'research', limit: paging.perPage, offset, locale });

  const title = kind === 'category' && category ? category.name : t('blog.research');
  const description =
    kind === 'category' && category ? category.description : t('blog.researchIntro');
  const base = paging.base;
  const path = pagedPath(base, paging.number, permalinks);
  const trail: Crumb[] = [
    { name: t('chrome.home'), path: '/' },
    { name: site.blogLabel, path: blogIndexPath(permalinks) },
    { name: title, path: base },
  ];
  const crumbs = breadcrumbs(trail);
  const empty = kind === 'category' ? t('blog.nothingFiled') : t('blog.noResearch');
  // 2.18 — a category's full heading: its description and picture beside the name.
  const picture = kind === 'category' && blog.categoryHero === 'full' ? category?.imageUrl : null;
  const around = kind === 'category' ? template : { before: [], after: [] };

  return (
    <>
      <Section size="lg">
        {blog.archiveBreadcrumbs && <ArchiveCrumbs trail={trail} />}
        {picture ? (
          <div className="he-arch-hero">
            <div>
              <Eyebrow>{site.blogLabel}</Eyebrow>
              <Heading level={1} className="max-w-[20ch]">
                {title}
              </Heading>
              {description && <p className="mt-6 max-w-[62ch] text-[17px] text-ash">{description}</p>}
            </div>
            <div className="he-arch-hero__media">
              <SiteImg src={picture} alt="" className="he-fill" sizes="half" priority />
            </div>
          </div>
        ) : (
          <>
            <Eyebrow>{site.blogLabel}</Eyebrow>
            <Heading level={1} className={kind === 'category' ? 'max-w-[20ch]' : 'max-w-[18ch]'}>
              {title}
            </Heading>
            {description && <p className="mt-6 max-w-[62ch] text-[17px] text-ash">{description}</p>}
          </>
        )}
      </Section>
      {around.before.length > 0 && <BlockRenderer blocks={around.before} trail={trail} locale={locale} />}

      <Section size="lg">
        {posts.length === 0 ? (
          <p className="m-0 text-[16px] text-smoke">{empty}</p>
        ) : (
          <>
            {blog.resultCount && <ResultCount paging={paging} t={t} />}
            <BlogList
              posts={posts}
              blog={blog}
              fallbackEyebrow={kind === 'category' ? title : t('blog.research')}
              permalinks={permalinks}
              listId={paging.total > 1 ? ARCHIVE_LIST_ID : undefined}
              labels={{ research: t('blog.research'), article: t('blog.article'), minRead: t('blog.minRead'), readMore: t('blog.readMore') }}
            />
            <Pagination
              current={paging.number}
              total={paging.total}
              href={(n) => pagedPath(base, n, permalinks)}
              style={blog.archivePager}
              labels={paginationLabels(t)}
              listId={ARCHIVE_LIST_ID}
            />
          </>
        )}
      </Section>

      {around.after.length > 0 && <BlockRenderer blocks={around.after} trail={trail} locale={locale} />}
      <PagingLinks paging={paging} permalinks={permalinks} />
      <FeedLink href={kind === 'category' && category ? feedPath(permalinks, category.slug) : feedPath(permalinks)} title={title} />
      <JsonLd
        data={graph([
          webPage({ path, name: title, description, breadcrumbId: crumbs['@id'] as string }),
          ...(kind === 'research'
            ? [blogNode({ path: base, name: `${settings.name} ${t('blog.research').toLowerCase()}`, description })]
            : []),
          itemList({ path, name: title, items: posts.map((p) => ({ name: p.title, path: postUrl(permalinks, p) })) }),
          crumbs,
        ])}
      />
    </>
  );
}

