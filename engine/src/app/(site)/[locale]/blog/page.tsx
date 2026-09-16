import type { Metadata } from 'next';
import Link from 'next/link';
import { BlockRenderer } from '@/components/blocks/Renderer';
import { JsonLd } from '@/components/site/JsonLd';
import { Heading } from '@/components/ui/Heading';
import { Section } from '@/components/ui/Section';
import { blogNode, breadcrumbs, graph, webPage } from '@/lib/seo/jsonld';
import { buildMetadata } from '@/lib/seo/metadata';
import { site } from '@/lib/site';
import { listCategories } from '@/server/content/categories';
import { getPageByPath } from '@/server/content/pages';
import { listPosts } from '@/server/content/posts';
import { getSiteSettings } from '@/server/content/siteSettings';
import { searchPosts } from '@/server/search';
import { Card, CardGrid } from '@/components/ui/Card';
import { formatDate } from '@/lib/utils';
import { BlogList } from '@/components/site/BlogList';
import { resolveBlog } from '@/lib/blog';
import { getTheme } from '@/server/content/theme';
import { BlogSearch } from './BlogSearch';

export const revalidate = 300;

/** Used until somebody writes a description for a `/blog` page. */
function fallbackDescription(siteName: string) {
  return `Articles and updates from ${siteName}.`;
}

export async function generateMetadata(): Promise<Metadata> {
  const [page, settings] = await Promise.all([getPageByPath('/blog'), getSiteSettings()]);
  return buildMetadata({
    seo: page?.seo,
    title: page?.title ?? site.blogLabel,
    description: page?.excerpt || fallbackDescription(settings.name),
    path: '/blog',
    siteName: settings.name,
  });
}

export default async function BlogIndex({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const [{ locale }, { q }] = await Promise.all([params, searchParams]);
  const query = (q ?? '').trim();
  const results = query ? await searchPosts(query, 24) : [];
  const page = await getPageByPath('/blog', locale);
  const categories = await listCategories(locale);
  const settings = await getSiteSettings();
  const blog = resolveBlog((await getTheme()).blog);
  const description = page?.excerpt || fallbackDescription(settings.name);

  /* A site with no `/blog` page still has a blog. It gets a plain heading and
     the latest posts, so the route never renders without an h1 or a list — a
     blank site used to serve a page with nothing on it but a search box. */
  const latest = !page && !query ? await listPosts({ limit: 24, locale }) : [];

  const trail = [
    { name: 'Home', path: '/' },
    { name: site.blogLabel, path: '/blog' },
  ];
  const crumbs = breadcrumbs(trail);

  const blocks = page?.blocks ?? [];
  const [first, ...rest] = blocks;

  return (
    <>
      {first ? (
        <BlockRenderer blocks={[first]} trail={trail} />
      ) : (
        <Section size="lg">
          <Heading level={1} className="max-w-[18ch]">
            {site.blogLabel}
          </Heading>
          <p className="mt-6 max-w-[62ch] text-[17px] text-ash">{description}</p>
        </Section>
      )}

      {categories.length > 0 && (
        <Section size="sm">
          <nav aria-label="Categories" className="flex flex-wrap items-center gap-2">
            <span className="label-mono mr-2">Browse</span>
            <Link
              href="/blog"
              aria-current="page"
              className="border-2 border-flare bg-flare px-4 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-bone"
            >
              All
            </Link>
            <Link
              href="/blog/research"
              className="border-2 border-hairline px-4 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-ash transition-colors hover:border-rule hover:text-bone"
            >
              Research
            </Link>
            {categories.map((c) => (
              <Link
                key={c.slug}
                href={`/blog/category/${c.slug}`}
                className="border-2 border-hairline px-4 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-ash transition-colors hover:border-rule hover:text-bone"
              >
                {c.name}
              </Link>
            ))}
          </nav>
        </Section>
      )}

      <Section size="sm" rule={!query}>
        <BlogSearch initialQuery={query} />
      </Section>

      {query ? (
        <Section size="lg">
          <p className="label-mono mb-8">
            {results.length === 0
              ? `Nothing matches “${query}”`
              : `${results.length} result${results.length === 1 ? '' : 's'} for “${query}”`}
          </p>
          {results.length > 0 && (
            <CardGrid cols={3}>
              {results.map((p) => (
                <Card
                  key={p.id}
                  eyebrow={
                    <>
                      {p.kind === 'research' ? 'Research' : (p.categoryName ?? 'Article')}
                      {p.publishedAt ? ` — ${formatDate(p.publishedAt)}` : ''}
                    </>
                  }
                  title={p.title}
                  href={`/blog/${p.slug}`}
                >
                  {p.excerpt}
                </Card>
              ))}
            </CardGrid>
          )}
        </Section>
      ) : page ? (
        <BlockRenderer blocks={rest} trail={trail} />
      ) : (
        <Section size="lg">
          {latest.length === 0 ? (
            <p className="m-0 text-[16px] text-smoke">Nothing published yet.</p>
          ) : (
            <BlogList posts={latest} blog={blog} fallbackEyebrow={site.blogLabel} />
          )}
        </Section>
      )}

      <JsonLd
        data={graph([
          webPage({
            path: '/blog',
            name: page?.seo.title ?? site.blogLabel,
            description,
            breadcrumbId: crumbs['@id'] as string,
          }),
          blogNode({ path: '/blog', name: site.blogLabel, description }),
          crumbs,
        ])}
      />
    </>
  );
}
