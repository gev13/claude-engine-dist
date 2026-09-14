import type { Metadata } from 'next';
import { JsonLd } from '@/components/site/JsonLd';
import { BlogList } from '@/components/site/BlogList';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Heading } from '@/components/ui/Heading';
import { Section } from '@/components/ui/Section';
import { resolveBlog } from '@/lib/blog';
import { blogNode, breadcrumbs, graph, itemList, webPage } from '@/lib/seo/jsonld';
import { buildMetadata } from '@/lib/seo/metadata';
import { site } from '@/lib/site';
import { listPosts } from '@/server/content/posts';
import { getSiteSettings } from '@/server/content/siteSettings';
import { getTheme } from '@/server/content/theme';

export const revalidate = 300;

const TITLE = 'Research';
const DESCRIPTION = 'Original research, written up in full.';

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  return buildMetadata({ title: TITLE, description: DESCRIPTION, path: '/blog/research', siteName: settings.name });
}

export default async function ResearchIndex() {
  const [posts, settings, theme] = await Promise.all([listPosts({ kind: 'research', limit: 48 }), getSiteSettings(), getTheme()]);
  const crumbs = breadcrumbs([
    { name: 'Home', path: '/' },
    { name: site.blogLabel, path: '/blog' },
    { name: TITLE, path: '/blog/research' },
  ]);

  return (
    <>
      <Section size="lg">
        <Eyebrow>{site.blogLabel}</Eyebrow>
        <Heading level={1} className="max-w-[18ch]">
          {TITLE}
        </Heading>
        <p className="mt-6 max-w-[62ch] text-[17px] text-ash">{DESCRIPTION}</p>
      </Section>

      <Section size="lg">
        {posts.length === 0 ? (
          <p className="m-0 text-[16px] text-smoke">No research published yet.</p>
        ) : (
          <BlogList posts={posts} blog={resolveBlog(theme.blog)} fallbackEyebrow="Research" />
        )}
      </Section>

      <JsonLd
        data={graph([
          webPage({ path: '/blog/research', name: TITLE, description: DESCRIPTION, breadcrumbId: crumbs['@id'] as string }),
          blogNode({ path: '/blog/research', name: `${settings.name} research`, description: DESCRIPTION }),
          itemList({
            path: '/blog/research',
            name: TITLE,
            items: posts.map((p) => ({ name: p.title, path: `/blog/${p.slug}` })),
          }),
          crumbs,
        ])}
      />
    </>
  );
}
