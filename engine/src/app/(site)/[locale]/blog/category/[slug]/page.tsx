import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { JsonLd } from '@/components/site/JsonLd';
import { BlogList } from '@/components/site/BlogList';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Heading } from '@/components/ui/Heading';
import { Section } from '@/components/ui/Section';
import { breadcrumbs, graph, itemList, webPage } from '@/lib/seo/jsonld';
import { buildMetadata } from '@/lib/seo/metadata';
import { resolveBlog } from '@/lib/blog';
import { site } from '@/lib/site';
import { getCategory, getCategoryTranslations, listCategories } from '@/server/content/categories';
import { getTheme } from '@/server/content/theme';
import { listPosts } from '@/server/content/posts';
import { getSiteSettings } from '@/server/content/siteSettings';
import type { SeoFields } from '@/server/db/schema';

export const revalidate = 300;
export const dynamicParams = true;

type Params = { locale: string; slug: string };

export async function generateStaticParams({ params }: { params: { locale: string } }) {
  const cats = await listCategories(params.locale);
  return cats.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { locale, slug } = await params;
  const category = await getCategory(slug, locale);
  if (!category) return { title: "Not found" };
  const [settings, translations] = await Promise.all([
    getSiteSettings(),
    getCategoryTranslations(category.translationGroupId),
  ]);

  return buildMetadata({
    seo: category.seo as SeoFields,
    title: `${category.name} — ${site.blogLabel}`,
    description: category.description || `Writing from ${settings.name} filed under ${category.name}.`,
    path: `/blog/category/${category.slug}`,
    locale,
    translations: translations.map((t) => ({ locale: t.locale, path: `/blog/category/${t.slug}` })),
    siteName: settings.name,
  });
}

export default async function CategoryPage({ params }: { params: Promise<Params> }) {
  const { locale, slug } = await params;
  const category = await getCategory(slug, locale);
  if (!category) notFound();

  const [posts, theme] = await Promise.all([listPosts({ categorySlug: slug, limit: 48, locale }), getTheme()]);
  const blog = resolveBlog(theme.blog);
  const path = `/blog/category/${category.slug}`;
  const crumbs = breadcrumbs([
    { name: 'Home', path: '/' },
    { name: site.blogLabel, path: '/blog' },
    { name: category.name, path },
  ]);

  return (
    <>
      <Section size="lg">
        <Eyebrow>{site.blogLabel}</Eyebrow>
        <Heading level={1} className="max-w-[20ch]">
          {category.name}
        </Heading>
        {category.description && <p className="mt-6 max-w-[62ch] text-[17px] text-ash">{category.description}</p>}
      </Section>

      <Section size="lg">
        {posts.length === 0 ? (
          <p className="m-0 text-[16px] text-smoke">Nothing filed here yet.</p>
        ) : (
          <BlogList posts={posts} blog={blog} fallbackEyebrow={category.name} />
        )}
      </Section>

      <JsonLd
        data={graph([
          webPage({
            path,
            name: category.name,
            description: category.description,
            breadcrumbId: crumbs['@id'] as string,
          }),
          itemList({
            path,
            name: category.name,
            items: posts.map((p) => ({ name: p.title, path: `/blog/${p.slug}` })),
          }),
          crumbs,
        ])}
      />
    </>
  );
}
