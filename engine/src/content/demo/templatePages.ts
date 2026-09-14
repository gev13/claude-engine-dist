import type { PageDefinition } from '@/content/types';
import { PAGE_TEMPLATES, instantiate } from '@/content/templates';
import type { AnyBlock } from '@/lib/blocks';
import { b, link } from '@/content/templates/types';

/* ═══════════════════════════════════════════════════════════════════════════
   The page templates, published by the demo seed so they can be looked at
   — /templates and one page each at /templates/<id>. Out of search, like
   the block library. To use one: Pages → New page → start from a template.
   ═══════════════════════════════════════════════════════════════════════════ */

const SEO = { robots: 'noindex, follow' };

/** Stable ids, so a reseed keeps a form's submissions pointing at the same block. */
function stable(prefix: string, raws: Parameters<typeof instantiate>[0]): AnyBlock[] {
  let n = 0;
  return instantiate(raws, () => `${prefix}-${++n}`);
}

const index: PageDefinition = {
  path: '/templates',
  slug: 'templates',
  title: 'Page templates',
  excerpt: 'Ready-made pages built from the block library, to start a new page from.',
  seo: SEO,
  blocks: stable('tpl', [
    b('heading', {
      eyebrow: 'Page templates',
      title: 'Start a page from a template',
      titleAs: 'h1',
      subtitle:
        'Each template is a complete page made from the same blocks as everything else on the site. In the admin, open Pages → New page and pick one; it arrives as ordinary blocks with sample text and pictures, ready to be rewritten.',
    }),
    b('cardGrid', {
      variant: 'imageCards',
      title: `${PAGE_TEMPLATES.length} templates`,
      columns: 3,
      cards: PAGE_TEMPLATES.map((template) => ({
        title: template.name,
        body: template.description,
        href: `/templates/${template.id}`,
        imageUrl: template.image,
        alt: '',
        buttonLabel: 'Open the template',
      })),
    }),
    b('cta', {
      variant: 'inline',
      tone: 'raised',
      title: 'Ready sections, too',
      body: 'Smaller building blocks — an opening, a pricing table, opening hours and a map — can be added to any page from Add block → Ready sections.',
      links: [link('See every block', '/library')],
    }),
  ]),
};

export const demoTemplatePages: PageDefinition[] = [
  index,
  ...PAGE_TEMPLATES.map((template) => ({
    path: `/templates/${template.id}`,
    slug: `template-${template.id}`,
    title: `${template.page.title} — ${template.name} template`,
    excerpt: template.page.excerpt,
    seo: SEO,
    blocks: stable(`tpl-${template.id}`, template.blocks),
  })),
];
