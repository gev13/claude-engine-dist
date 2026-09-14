import 'server-only';
import type { Block } from '@/server/db/schema';

/**
 * The one page a freshly installed site starts with.
 *
 * Deliberately minimal and obviously placeholder: it exists so the site renders
 * something at its own root rather than a 404, and so a new editor has a real
 * page to open and learn the builder on. It is not a demo — nobody should have
 * to delete a fake case study before they can start.
 */
export function starterPage(siteName: string, tagline: string, authorId: string) {
  const blocks: Block[] = [
    {
      id: 'starter-hero',
      type: 'hero',
      props: {
        eyebrow: 'Welcome',
        title: tagline || siteName,
        body: 'This is the starter page. Open it in the admin, edit these blocks, or delete them and build your own.',
        links: [],
        figure: 'none',
        figureLabels: [],
        layout: 'wide',
      },
    },
    {
      id: 'starter-next',
      type: 'prose',
      props: {
        title: 'Next steps',
        paragraphs: [
          'Set your colours, type and logo in Appearance.',
          'Build the header and footer in Menus.',
          'Add pages, then arrange them into rows and columns.',
        ],
        columns: 'one',
      },
    },
  ] as Block[];

  return {
    slug: 'home',
    path: '/',
    // 'Home', not the site name: the title template already appends the site
    // name, and "Acme — Acme" is what happens when it does not.
    title: 'Home',
    navLabel: 'Home',
    summary: tagline,
    excerpt: tagline,
    status: 'published' as const,
    blocks,
    seo: {},
    template: 'default',
    isSystem: false,
    publishedAt: new Date(),
    authorId,
  };
}
