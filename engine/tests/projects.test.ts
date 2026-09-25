import { describe, expect, it } from 'vitest';
import { blockSchemas } from '../src/lib/blocks';
import { findServerList } from '../src/lib/listing';
import { DEFAULT_PERMALINKS, matchBlogPath, permalinksSchema, projectPath, projectTermPath } from '../src/lib/permalinks';
import { projectItem, projectQueryString, readProjectOptions, resolveProjectTemplate } from '../src/lib/projects';

/* Projects (2.14): the addresses, the template's defaults, what one project
   can change for itself, and the projects block reading from the collection. */

const wp = permalinksSchema.parse({ projectBase: '/portfolio', projectCategoryBase: '/portfolio-category', projectTagBase: '/portfolio-tag' });

describe('project addresses', () => {
  it('defaults to /projects for a new site, and follows a WordPress portfolio when set', () => {
    expect(projectPath(DEFAULT_PERMALINKS, 'fortune')).toBe('/projects/fortune');
    expect(projectTermPath(DEFAULT_PERMALINKS, 'category', 'branding')).toBe('/projects/category/branding');
    expect(projectPath(wp, 'fortune')).toBe('/portfolio/fortune');
    expect(projectTermPath(wp, 'tag', 'logo-design', 2)).toBe('/portfolio-tag/logo-design/page/2');
  });

  it('reads a project, a category archive and a tag archive back', () => {
    expect(matchBlogPath(wp, '/portfolio/fortune')).toContainEqual({ kind: 'project', slug: 'fortune' });
    expect(matchBlogPath(wp, '/portfolio-category/branding/page/3')).toContainEqual({
      kind: 'projectTerm',
      taxonomy: 'category',
      slug: 'branding',
      page: 3,
    });
    expect(matchBlogPath(wp, '/portfolio-tag/3d-animation')).toContainEqual({ kind: 'projectTerm', taxonomy: 'tag', slug: '3d-animation', page: 1 });
  });

  it('refuses two families on one address', () => {
    expect(permalinksSchema.safeParse({ projectBase: '/blog' }).success).toBe(false);
    expect(permalinksSchema.safeParse({ projectCategoryBase: '/projects/tag' }).success).toBe(false);
  });
});

describe('the page template', () => {
  it('is a plain portfolio when nothing is saved, and never throws on a bad row', () => {
    const template = resolveProjectTemplate(undefined);
    expect(template.header).toBe('fullBleed');
    expect(template.more).toEqual({ enabled: true, title: 'More projects', source: 'category', count: 3, layout: 'grid' });
    expect(template.archive).toEqual({ layout: 'classic', columns: 3, perPage: 12 });
    expect(template.inSearch).toBe(false);
    expect(resolveProjectTemplate({ header: 'nonsense' })).toEqual(template);
  });
});

describe('what a project changes for itself', () => {
  it('keeps a colour and drops anything that is not one — it lands in a style element', () => {
    expect(readProjectOptions({ background: '#000000', hideMore: true })).toEqual({ background: '#000000', hideMore: true });
    expect(readProjectOptions({ background: 'red;}body{display:none' })).toEqual({});
  });
});

describe('the projects block, from the collection', () => {
  it('keeps every stored block parsing as a manual list', () => {
    const stored = blockSchemas.projects.parse({ items: [{ title: 'Old' }] });
    expect(stored.source).toBe('manual');
    expect(stored.pagination).toBe('none');
    expect(stored.items).toHaveLength(1);
  });

  it('turns a card into an item with linked category chips', () => {
    const item = projectItem({
      id: 'x',
      slug: 'fortune',
      title: 'Fortune To Win',
      summary: 'A slot.',
      year: '2025',
      client: 'Acme',
      coverUrl: '/media/a.webp',
      hoverUrl: null,
      href: '/portfolio/fortune',
      categories: [{ slug: 'game-design', name: 'Game Design', href: '/portfolio-category/game-design' }],
    });
    expect(item).toMatchObject({ title: 'Fortune To Win', category: 'Game Design', href: '/portfolio/fortune', imageUrl: '/media/a.webp' });
    expect(item.chips).toEqual([{ label: 'Game Design', href: '/portfolio-category/game-design' }]);
  });

  it('puts only the block’s own filters in the load-more query', () => {
    const query = projectQueryString({ categories: ['a', 'b'], tags: ['t'], featuredOnly: true, order: 'newest', limit: 12 });
    expect(query).toBe('category=a&category=b&tag=t&featured=1&order=newest&limit=12');
  });

  it('pages on the server when set to real pages', () => {
    const blocks = [{ id: 'p', type: 'projects', props: { source: 'collection', pagination: 'pages', limit: 12, categories: ['branding'] } }];
    expect(findServerList(blocks as never)).toMatchObject({
      blockId: 'p',
      type: 'projects',
      limit: 12,
      projects: { categories: ['branding'], tags: [], featuredOnly: false },
    });
  });
});
